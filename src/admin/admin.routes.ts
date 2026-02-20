import { Router } from 'express';
import db from '../db';
import bcrypt from 'bcryptjs';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { generateTempPassword, generateSetPasswordToken, notifyStaffCredentials } from '../utils/staff_notify';

const router = Router();
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

const STAFF_ROLES = ['subadmin', 'secretary', 'chairman'] as const;

const requireAdmin = (req: AuthRequest, res: any, next: () => void) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const logAudit = async (actorId: number, action: string, targetId?: number, details?: object) => {
  await db('audit_logs').insert({
    actor_id: actorId,
    action,
    target_id: targetId ?? null,
    details: details ? JSON.stringify(details) : null
  });
};

// ----- Stats / Dashboard -----
router.get('/stats', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userCounts = (await db('users')
      .select('role')
      .count('* as count')
      .whereNot('role', 'admin')
      .where(b => b.whereNull('suspended').orWhere('suspended', false))
      .groupBy('role')) as { role: string; count: string }[];

    const totalUsers = await db('users').whereNot('role', 'admin').count('* as c').first();
    const totalFarmers = Number(userCounts.find(r => r.role === 'farmer')?.count ?? 0);
    const totalVets = Number(userCounts.find(r => r.role === 'vet')?.count ?? 0);
    const totalAgrovets = Number(userCounts.find(r => r.role === 'agrovet')?.count ?? 0);

    const [providers] = await db('providers').count('* as c');
    const [pendingProviders] = await db('providers')
      .where('verification_status', 'pending')
      .count('* as c')
      .catch(() => [{ c: 0 }]);

    const [appointments] = await db('appointments').count('* as c');
    const [symptomReports] = await db('symptom_reports').count('* as c');
    const [animals] = await db('animals').count('* as c');

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const licensesExpiringSoon = await db('providers')
      .where('verification_status', 'verified')
      .whereNotNull('license_expiry')
      .where('license_expiry', '<=', thirtyDaysFromNow.toISOString().slice(0, 10))
      .count('* as c')
      .first()
      .catch(() => ({ c: 0 }));

    const usersByCounty = await db('users')
      .select('county')
      .count('* as count')
      .whereNotNull('county')
      .whereNot('role', 'admin')
      .groupBy('county')
      .orderBy('count', 'desc')
      .limit(20);

    res.json({
      users: { total: Number(totalUsers?.c ?? 0), farmers: totalFarmers, vets: totalVets, agrovets: totalAgrovets },
      providers: { total: Number(providers?.c ?? 0), pending: Number((pendingProviders as any)?.c ?? 0) },
      appointments: Number(appointments?.c ?? 0),
      symptomReports: Number(symptomReports?.c ?? 0),
      animals: Number(animals?.c ?? 0),
      licensesExpiringSoon: Number((licensesExpiringSoon as any)?.c ?? 0),
      usersByCounty: usersByCounty || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// ----- Users -----
router.get('/users', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { role, county, search, status, page = 1, limit = 20 } = req.query;
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 20));
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;

    // Join providers so we can expose verification status for vets/agrovets on the admin dashboard.
    let q = db('users as u')
      .leftJoin('providers as p', 'p.user_id', 'u.id')
      .select(
        'u.id',
        'u.name',
        'u.email',
        'u.phone',
        'u.role',
        'u.county',
        'u.sub_county',
        'u.suspended',
        'u.created_at',
        'p.id as provider_id',
        'p.verification_status'
      )
      .whereNot('u.role', 'admin');

    if (role && String(role) !== 'all') q = q.where('u.role', String(role));
    if (county && String(county) !== 'all') {
      // Counties may vary in casing ("Nairobi" vs "NAIROBI"), so match case-insensitively
      q = q.where((b: any) => b.where('u.county', 'ilike', String(county)));
    }
    if (status && String(status) !== 'all') {
      const st = String(status);
      if (st === 'active') q = q.where((b: any) => b.whereNull('u.suspended').orWhere('u.suspended', false));
      if (st === 'suspended') q = q.where('u.suspended', true);
    }
    if (search && String(search).trim()) {
      const s = `%${String(search).trim()}%`;
      q = q.where((b: any) =>
        b.where('u.name', 'ilike', s).orWhere('u.email', 'ilike', s).orWhere('u.phone', 'ilike', s)
      );
    }

    // IMPORTANT (Postgres): don't mix selected columns with COUNT(*) unless grouped.
    const [total] = await q.clone().clearSelect().clearOrder().count('* as c');
    const users = await q.orderBy('u.created_at', 'desc').limit(safeLimit).offset(offset);

    res.json({ users, total: Number((total as any)?.c ?? 0), page: safePage, limit: safeLimit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// High-level analytics for the Admin Users dashboard:
// - usersPerCountyByRole: bar chart of role distribution per county
// - monthlyRegistrations: line chart of user registrations over time
// - roleDistribution: pie chart for overall role mix
router.get('/users/analytics', authMiddleware, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const usersPerCountyByRole = await db('users')
      .select('county', 'role')
      .count('* as count')
      .whereNotNull('county')
      .whereNot('role', 'admin')
      .groupBy('county', 'role')
      .orderBy('county')
      .orderBy('role');

    const monthlyRegistrations = await db('users')
      .select(
        db.raw("to_char(date_trunc('month', created_at), 'YYYY-MM') as month"),
        'role'
      )
      .count('* as count')
      .whereNot('role', 'admin')
      .groupByRaw("date_trunc('month', created_at), role")
      .orderByRaw("date_trunc('month', created_at) asc");

    const roleDistribution = await db('users')
      .select('role')
      .count('* as count')
      .whereNot('role', 'admin')
      .groupBy('role')
      .orderBy('count', 'desc');

    res.json({
      usersPerCountyByRole: usersPerCountyByRole || [],
      monthlyRegistrations: monthlyRegistrations || [],
      roleDistribution: roleDistribution || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.put('/users/:id/suspend', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const { suspended } = req.body;

    await db('users')
      .where({ id: userId })
      .whereNot('role', 'admin')
      .update({
        suspended: !!suspended,
        suspended_at: suspended ? db.fn.now() : null,
        suspended_by: suspended ? req.user!.id : null
      });

    await logAudit(req.user!.id, suspended ? 'user_suspend' : 'user_unsuspend', userId, { suspended });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// ----- Counties (for dropdowns) -----
router.get('/counties', authMiddleware, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const counties = await db('counties').select('id', 'name').orderBy('name');
    res.json(counties);
  } catch (err) {
    if ((err as any)?.code === '42P01') {
      return res.json([]);
    }
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Public counties for registration (no admin required)
router.get('/counties/public', async (_req, res) => {
  try {
    const counties = await db('counties').select('id', 'name').orderBy('name');
    res.json(counties);
  } catch (err) {
    if ((err as any)?.code === '42P01') {
      return res.json([]);
    }
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// ----- Staff Management (admin creates secretary, subadmin, chairman) -----
router.get('/staff', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const staff = await db('users')
      .select('id', 'name', 'email', 'phone', 'role', 'assigned_county', 'must_change_password', 'created_at', 'created_by')
      .whereIn('role', STAFF_ROLES)
      .orderBy('created_at', 'desc');
    res.json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.post('/staff', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, email, phone, role, assigned_county } = req.body || {};

    if (!name || !email) {
      return res.status(400).json({ error: 'name and email required' });
    }
    const roleStr = String(role || 'secretary').toLowerCase();
    if (!STAFF_ROLES.includes(roleStr as any)) {
      return res.status(400).json({ error: `role must be one of: ${STAFF_ROLES.join(', ')}` });
    }
    if (roleStr === 'subadmin' && !assigned_county) {
      return res.status(400).json({ error: 'assigned_county required for subadmin' });
    }

    if (roleStr === 'subadmin') {
      const countyStr = String(assigned_county).trim();
      const activeSubadmin = await db('users')
        .where('role', 'subadmin')
        .where('assigned_county', 'ilike', countyStr)
        .where(b => b.whereNull('suspended').orWhere('suspended', false))
        .first();
      if (activeSubadmin) {
        return res.status(409).json({
          error: `County "${countyStr}" already has an active subadmin. Suspend or deactivate the current subadmin before assigning a new one.`,
        });
      }
    }

    const existing = await db('users').where({ email: String(email).trim() }).first();
    if (existing) {
      return res.status(409).json({ error: 'email already exists' });
    }

    const tempPassword = generateTempPassword();
    const password_hash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
    const setPasswordToken = generateSetPasswordToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const [user] = await db('users')
      .insert({
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        phone: phone ? String(phone).trim() : null,
        password_hash,
        role: roleStr,
        assigned_county: roleStr === 'subadmin' ? String(assigned_county).trim() : null,
        must_change_password: true,
        county: roleStr === 'subadmin' ? String(assigned_county).trim() : null,
        created_by: req.user!.id,
        password_reset_token: setPasswordToken,
        password_reset_expires_at: expiresAt,
      })
      .returning(['id', 'name', 'email', 'phone', 'role', 'assigned_county', 'created_at']);

    await logAudit(req.user!.id, 'staff_create', user.id, {
      role: roleStr,
      assigned_county: user.assigned_county,
    });

    await notifyStaffCredentials({
      name: user.name,
      email: user.email,
      phone: user.phone,
      tempPassword,
      role: roleStr,
      setPasswordToken,
    }).catch(err => console.error('[Admin] Staff notify failed:', err));

    res.status(201).json({
      user: { ...user, mustChangePassword: true },
      message: 'Staff created. Temporary credentials sent via email/SMS.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// ----- Staff: resend invite (regenerate temp password & notify) -----
// Route: POST /resend-staff-invite/:id (works reliably with Express 5)
router.post('/resend-staff-invite/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const staffId = Number(req.params.id);
    if (!Number.isFinite(staffId)) {
      return res.status(400).json({ error: 'invalid staff id' });
    }

    const user = await db('users')
      .where({ id: staffId })
      .whereIn('role', STAFF_ROLES)
      .first();

    if (!user) {
      return res.status(404).json({ error: 'staff user not found' });
    }

    const tempPassword = generateTempPassword();
    const password_hash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
    const setPasswordToken = generateSetPasswordToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    await db('users')
      .where({ id: staffId })
      .update({
        password_hash,
        must_change_password: true,
        suspended: false,
        suspended_at: null,
        password_reset_token: setPasswordToken,
        password_reset_expires_at: expiresAt,
      });

    await logAudit(req.user!.id, 'staff_resend_invite', staffId, {
      role: user.role,
      email: user.email,
      phone: user.phone,
    });

    await notifyStaffCredentials({
      name: user.name,
      email: user.email,
      phone: user.phone,
      tempPassword,
      role: user.role,
      setPasswordToken,
    }).catch(err => console.error('[Admin] Staff resend notify failed:', err));

    return res.json({
      ok: true,
      message: 'Invitation resent. Temporary credentials sent via email/SMS.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// ----- Settings (outbreak, license renewal) -----
router.get('/settings', authMiddleware, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const rows = await db('admin_settings').select('key', 'value');
    const settings: Record<string, unknown> = {};
    for (const r of rows || []) {
      const v = r.value;
      if (v === null || v === undefined) {
        settings[r.key] = null;
      } else if (typeof v === 'string') {
        try {
          settings[r.key] = JSON.parse(v);
        } catch {
          settings[r.key] = v;
        }
      } else {
        settings[r.key] = v;
      }
    }
    res.json(settings);
  } catch (err) {
    if ((err as any)?.code === '42P01') return res.json({});
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.put('/settings', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { outbreak_alert_threshold, license_renewal_reminder_days, email_on_approval } = req.body;
    const updates: { key: string; value: string }[] = [];
    if (typeof outbreak_alert_threshold === 'number') {
      updates.push({ key: 'outbreak_alert_threshold', value: JSON.stringify(outbreak_alert_threshold) });
    }
    if (typeof license_renewal_reminder_days === 'number') {
      updates.push({ key: 'license_renewal_reminder_days', value: JSON.stringify(license_renewal_reminder_days) });
    }
    if (typeof email_on_approval === 'boolean') {
      updates.push({ key: 'email_on_approval', value: JSON.stringify(email_on_approval) });
    }
    for (const u of updates) {
      await db('admin_settings')
        .where({ key: u.key })
        .update({ value: u.value, updated_at: db.fn.now() });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// ----- Providers / Approval -----
router.get('/providers', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { status, type } = req.query;

    let q = db('providers as p')
      .join('users as u', 'u.id', 'p.user_id')
      .select(
        'p.id', 'p.name', 'p.provider_type', 'p.verification_status', 'p.verified_at',
        'p.license_number', 'p.verification_badge', 'p.rejection_reason',
        'p.license_expiry', 'p.renewal_reminder_sent_at',
        'u.email', 'u.phone', 'u.county', 'u.sub_county', 'p.created_at'
      );

    if (status && String(status) !== 'all') q = q.where('p.verification_status', String(status));
    if (type && String(type) !== 'all') q = q.where('p.provider_type', String(type));

    const providers = await q.orderBy('p.created_at', 'desc');
    res.json(providers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// GET provider application with documents
router.get('/providers/:id/application', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const providerId = Number(req.params.id);
    const provider = await db('providers').where({ id: providerId }).first();
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const app = await db('professional_applications')
      .where({ provider_id: providerId })
      .orderBy('created_at', 'desc')
      .first();

    res.json({ provider, application: app });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// PUT admin confirm documents (marks documents as verified)
router.put('/providers/:id/confirm-documents', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const providerId = Number(req.params.id);
    const app = await db('professional_applications').where({ provider_id: providerId }).first();
    if (!app) return res.status(404).json({ error: 'Application not found' });

    await db('professional_applications')
      .where({ id: app.id })
      .update({
        documents_verified_at: db.fn.now(),
        documents_verified_by: req.user!.id,
      });

    await logAudit(req.user!.id, 'documents_confirm', providerId);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.put('/providers/:id/verify', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const providerId = Number(req.params.id);
    const { license_number, license_expiry } = req.body || {};

    const provider = await db('providers').where({ id: providerId }).first();
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const badge = provider.provider_type === 'vet' ? 'Verified Veterinarian' : 'Verified Agrovet';

    const updatePayload: Record<string, unknown> = {
      verification_status: 'verified',
      verified_at: db.fn.now(),
      verified_by: req.user!.id,
      verification_badge: badge,
      license_number: license_number || provider.license_number || null,
      rejection_reason: null,
    };
    if (license_expiry) updatePayload.license_expiry = license_expiry;

    await db('providers').where({ id: providerId }).update(updatePayload);

    await logAudit(req.user!.id, 'provider_verify', providerId, { badge, license_number });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.put('/providers/:id/reject', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const providerId = Number(req.params.id);
    const { reason } = req.body || {};

    await db('providers').where({ id: providerId }).update({
      verification_status: 'rejected',
      verified_at: null,
      verified_by: req.user!.id,
      verification_badge: null,
      rejection_reason: reason || 'Application rejected'
    });

    await logAudit(req.user!.id, 'provider_reject', providerId, { reason });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// ----- Audit logs -----
router.get('/audit-logs', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const logs = await db('audit_logs as a')
      .leftJoin('users as u', 'u.id', 'a.actor_id')
      .select('a.id', 'a.action', 'a.target_id', 'a.details', 'a.created_at', 'u.name as actor_name', 'u.email as actor_email')
      .orderBy('a.created_at', 'desc')
      .limit(Number(limit))
      .offset(offset);

    const [total] = await db('audit_logs').count('* as c');
    res.json({ logs, total: Number((total as any)?.c ?? 0), page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// ----- Analytics: disease / symptom by county -----
router.get('/analytics', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const symptomByCounty = await db('symptom_reports as sr')
      .join('users as u', 'u.id', 'sr.user_id')
      .select('u.county')
      .count('* as count')
      .whereNotNull('u.county')
      .groupBy('u.county')
      .orderBy('count', 'desc');

    const diagnosesByLabel = await db('diagnoses')
      .select('predicted_label')
      .count('* as count')
      .groupBy('predicted_label')
      .orderBy('count', 'desc');

    res.json({ symptomByCounty: symptomByCounty || [], diagnosesByLabel: diagnosesByLabel || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// ----- Admin: symptom cases (list + detail). Admin-only, for surveillance and verified documents. -----
router.get('/symptom-reports', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 20, county, status } = req.query;
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;

    let q = db('symptom_reports as sr')
      .join('users as u', 'u.id', 'sr.user_id')
      .select(
        'sr.id',
        'sr.user_id',
        'sr.animal_type',
        'sr.symptom_text',
        'sr.status as report_status',
        'sr.created_at',
        'u.county',
        'u.sub_county',
        'u.name as reporter_name',
        db.raw('(SELECT d.predicted_label FROM diagnoses d WHERE d.report_id = sr.id ORDER BY d.created_at DESC LIMIT 1) as predicted_label'),
        db.raw('(SELECT d.confidence FROM diagnoses d WHERE d.report_id = sr.id ORDER BY d.created_at DESC LIMIT 1) as confidence')
      )
      .orderBy('sr.created_at', 'desc');

    if (county && String(county).trim() !== 'all') {
      q = q.where((b: any) => b.where('u.county', 'ilike', String(county).trim()));
    }
    if (status && String(status).trim() !== 'all') {
      q = q.where('sr.status', String(status).trim());
    }

    const countQuery = q.clone().clearSelect().clearOrder().count('* as c');
    const [totalRow] = await countQuery;
    const total = Number((totalRow as any)?.c ?? 0);

    const rows = await q.limit(safeLimit).offset(offset);

    res.json({ cases: rows, total, page: safePage, limit: safeLimit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.get('/symptom-reports/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const report = await db('symptom_reports').where('id', id).first();
    if (!report) return res.status(404).json({ error: 'Case not found' });

    const user = await db('users').where('id', report.user_id).select('name', 'county', 'sub_county').first();
    const diagnosis = await db('diagnoses').where('report_id', id).orderBy('created_at', 'desc').first();
    const verifiedDoc = await db('verified_documents').where('report_id', id).orderBy('generated_at', 'desc').first();

    res.json({ report, user: user || null, diagnosis: diagnosis || null, verified_document: verifiedDoc || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.post('/symptom-reports/:id/verified-document', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const reportId = Number(req.params.id);
    const { prescription_notes, recommendations } = req.body || {};

    const report = await db('symptom_reports').where('id', reportId).first();
    if (!report) return res.status(404).json({ error: 'Case not found' });

    const user = await db('users').where('id', report.user_id).select('name', 'county', 'sub_county').first();
    const diagnosis = await db('diagnoses').where('report_id', reportId).orderBy('created_at', 'desc').first();

    const [doc] = await db('verified_documents')
      .insert({
        report_id: reportId,
        generated_by: req.user!.id,
        prescription_notes: typeof prescription_notes === 'string' ? prescription_notes : null,
        recommendations: typeof recommendations === 'string' ? recommendations : null,
        status: 'verified'
      })
      .returning('*');

    await logAudit(req.user!.id, 'verified_document_create', doc.id, { report_id: reportId });

    const payload = {
      document: doc,
      report: { id: report.id, symptom_text: report.symptom_text, animal_type: report.animal_type, status: report.status, created_at: report.created_at },
      reporter: user || null,
      diagnosis: diagnosis || null
    };
    res.status(201).json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.get('/verified-documents', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 20, report_id } = req.query;
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;

    let q = db('verified_documents as vd')
      .join('symptom_reports as sr', 'sr.id', 'vd.report_id')
      .join('users as u', 'u.id', 'vd.generated_by')
      .select(
        'vd.id',
        'vd.report_id',
        'vd.generated_by',
        'vd.generated_at',
        'vd.prescription_notes',
        'vd.recommendations',
        'vd.status',
        'sr.symptom_text',
        'sr.animal_type',
        'sr.created_at as report_created_at',
        'u.name as generated_by_name'
      )
      .orderBy('vd.generated_at', 'desc');

    if (report_id != null && String(report_id).trim() !== '') {
      q = q.where('vd.report_id', Number(report_id));
    }

    const [totalRow] = await q.clone().clearSelect().clearOrder().count('* as c');
    const total = Number((totalRow as any)?.c ?? 0);
    const docs = await q.limit(safeLimit).offset(offset);

    res.json({ documents: docs, total, page: safePage, limit: safeLimit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// ----- Model versions (existing) -----
router.get('/model_versions', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const rows = await db('model_versions').select('*').orderBy('created_at', 'desc');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.post('/model_versions', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { version_tag, artifact_path, trained_on_date, metrics } = req.body;
    const [ins] = await db('model_versions')
      .insert({
        version_tag,
        artifact_path,
        trained_on_date,
        metrics: metrics ? JSON.stringify(metrics) : null
      })
      .returning(['id', 'version_tag']);
    res.status(201).json(ins);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

export default router;