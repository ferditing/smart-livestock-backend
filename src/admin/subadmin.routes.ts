import { Router } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

const requireSubadmin = (req: AuthRequest, res: any, next: () => void) => {
  if (req.user?.role !== 'subadmin') {
    return res.status(403).json({ error: 'Subadmin access required' });
  }
  const county = (req.user as any).assigned_county;
  if (!county) {
    return res.status(403).json({ error: 'No county assigned to this subadmin' });
  }
  (req as any).countyScope = county;
  next();
};

// County-scoped stats for subadmin dashboard
router.get('/stats', authMiddleware, requireSubadmin, async (req: AuthRequest, res) => {
  try {
    const county = (req as any).countyScope as string;

    const userCounts = (await db('users')
      .select('role')
      .count('* as count')
      .where('county', 'ilike', county)
      .whereNotIn('role', ['admin', 'subadmin', 'secretary', 'chairman'])
      .where(b => b.whereNull('suspended').orWhere('suspended', false))
      .groupBy('role')) as { role: string; count: string }[];

    const totalUsers = await db('users')
      .where('county', 'ilike', county)
      .whereNotIn('role', ['admin', 'subadmin', 'secretary', 'chairman'])
      .count('* as c')
      .first();

    const totalFarmers = Number(userCounts.find(r => r.role === 'farmer')?.count ?? 0);
    const totalVets = Number(userCounts.find(r => r.role === 'vet')?.count ?? 0);
    const totalAgrovets = Number(userCounts.find(r => r.role === 'agrovet')?.count ?? 0);

    const [verifiedVets] = await db('providers as p')
      .join('users as u', 'u.id', 'p.user_id')
      .where('u.county', 'ilike', county)
      .where('p.provider_type', 'vet')
      .where('p.verification_status', 'verified')
      .count('* as c')
      .catch(() => [{ c: 0 }]);

    const [verifiedAgrovets] = await db('providers as p')
      .join('users as u', 'u.id', 'p.user_id')
      .where('u.county', 'ilike', county)
      .where('p.provider_type', 'agrovet')
      .where('p.verification_status', 'verified')
      .count('* as c')
      .catch(() => [{ c: 0 }]);

    const [providers] = await db('providers as p')
      .join('users as u', 'u.id', 'p.user_id')
      .where('u.county', 'ilike', county)
      .count('* as c');

    const [pendingProviders] = await db('providers as p')
      .join('users as u', 'u.id', 'p.user_id')
      .where('u.county', 'ilike', county)
      .where('p.verification_status', 'pending')
      .count('* as c')
      .catch(() => [{ c: 0 }]);

    const [appointments] = await db('appointments as a')
      .join('users as u', 'u.id', 'a.farmer_id')
      .where('u.county', 'ilike', county)
      .count('* as c')
      .catch(() => [{ c: 0 }]);

    const [symptomReports] = await db('symptom_reports as sr')
      .join('users as u', 'u.id', 'sr.user_id')
      .where('u.county', 'ilike', county)
      .count('* as c')
      .catch(() => [{ c: 0 }]);

    const [animals] = await db('animals as a')
      .join('users as u', 'u.id', 'a.user_id')
      .where('u.county', 'ilike', county)
      .count('* as c')
      .catch(() => [{ c: 0 }]);

    res.json({
      county,
      users: {
        total: Number(totalUsers?.c ?? 0),
        farmers: totalFarmers,
        vets: totalVets,
        agrovets: totalAgrovets,
      },
      verifiedVets: Number((verifiedVets as any)?.c ?? 0),
      verifiedAgrovets: Number((verifiedAgrovets as any)?.c ?? 0),
      providers: {
        total: Number(providers?.c ?? 0),
        pending: Number((pendingProviders as any)?.c ?? 0),
      },
      appointments: Number(appointments?.c ?? 0),
      symptomReports: Number(symptomReports?.c ?? 0),
      animals: Number(animals?.c ?? 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// County-scoped users list for subadmin
router.get('/users', authMiddleware, requireSubadmin, async (req: AuthRequest, res) => {
  try {
    const county = (req as any).countyScope as string;
    const { role, search, status, sub_county, page = 1, limit = 20 } = req.query;
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;

    let q = db('users as u')
      .leftJoin('providers as p', 'p.user_id', 'u.id')
      .select(
        'u.id', 'u.name', 'u.email', 'u.phone', 'u.role', 'u.county', 'u.sub_county', 'u.ward', 'u.locality',
        'u.suspended', 'u.created_at', 'p.id as provider_id', 'p.verification_status'
      )
      .where('u.county', 'ilike', county)
      .whereIn('u.role', ['farmer', 'vet', 'agrovet']);

    if (role && String(role) !== 'all') q = q.where('u.role', String(role));
    if (sub_county && String(sub_county).trim() !== 'all') {
      q = q.where('u.sub_county', String(sub_county).trim());
    }
    if (status && String(status) !== 'all') {
      const st = String(status);
      if (st === 'active') q = q.where(b => b.whereNull('u.suspended').orWhere('u.suspended', false));
      if (st === 'suspended') q = q.where('u.suspended', true);
    }
    if (search && String(search).trim()) {
      const s = `%${String(search).trim()}%`;
      q = q.where(b =>
        b.where('u.name', 'ilike', s).orWhere('u.email', 'ilike', s).orWhere('u.phone', 'ilike', s)
      );
    }

    const [total] = await q.clone().clearSelect().clearOrder().count('* as c');
    const users = await q.orderBy('u.created_at', 'desc').limit(safeLimit).offset(offset);

    res.json({ users, total: Number((total as any)?.c ?? 0), page: safePage, limit: safeLimit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Sub-county breakdown with ward stats
router.get('/users/subcounty-breakdown', authMiddleware, requireSubadmin, async (req: AuthRequest, res) => {
  try {
    const county = (req as any).countyScope as string;

    // Get sub-counties with user counts by role
    const subCounties = await db('users')
      .select('sub_county')
      .count('* as total')
      .where('county', 'ilike', county)
      .whereNotNull('sub_county')
      .whereIn('role', ['farmer', 'vet', 'agrovet'])
      .groupBy('sub_county')
      .orderBy('sub_county');

    const breakdown = await Promise.all(
      (subCounties || []).map(async (sc) => {
        const subCounty = sc.sub_county;
        
        // Count by role
        const roleCounts = await db('users')
          .select('role')
          .count('* as count')
          .where('county', 'ilike', county)
          .where('sub_county', subCounty)
          .whereIn('role', ['farmer', 'vet', 'agrovet'])
          .groupBy('role');

        const farmers = Number(roleCounts.find((r: any) => r.role === 'farmer')?.count ?? 0);
        const vets = Number(roleCounts.find((r: any) => r.role === 'vet')?.count ?? 0);
        const agrovets = Number(roleCounts.find((r: any) => r.role === 'agrovet')?.count ?? 0);

        // Get wards in this sub-county
        const wards = await db('users')
          .select('ward')
          .count('* as count')
          .where('county', 'ilike', county)
          .where('sub_county', subCounty)
          .whereNotNull('ward')
          .whereIn('role', ['farmer', 'vet', 'agrovet'])
          .groupBy('ward')
          .orderBy('ward');

        // Ward breakdown by role
        const wardBreakdown = await Promise.all(
          (wards || []).map(async (w: any) => {
            const ward = w.ward;
            const wardRoleCounts = await db('users')
              .select('role')
              .count('* as count')
              .where('county', 'ilike', county)
              .where('sub_county', subCounty)
              .where('ward', ward)
              .whereIn('role', ['farmer', 'vet', 'agrovet'])
              .groupBy('role');

            return {
              ward,
              total: Number(w.count ?? 0),
              farmers: Number(wardRoleCounts.find((r: any) => r.role === 'farmer')?.count ?? 0),
              vets: Number(wardRoleCounts.find((r: any) => r.role === 'vet')?.count ?? 0),
              agrovets: Number(wardRoleCounts.find((r: any) => r.role === 'agrovet')?.count ?? 0),
            };
          })
        );

        return {
          sub_county: subCounty,
          total: Number(sc.total ?? 0),
          farmers,
          vets,
          agrovets,
          wards: wardBreakdown,
        };
      })
    );

    res.json({ breakdown: breakdown || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Subadmin can suspend users in their county
router.put('/users/:id/suspend', authMiddleware, requireSubadmin, async (req: AuthRequest, res) => {
  try {
    const county = (req as any).countyScope as string;
    const userId = Number(req.params.id);
    const { suspended } = req.body;

    const target = await db('users').where({ id: userId }).where('county', 'ilike', county).first();
    if (!target) return res.status(404).json({ error: 'User not found in your county' });
    if (['admin', 'subadmin', 'secretary', 'chairman'].includes(target.role)) {
      return res.status(403).json({ error: 'Cannot suspend staff users' });
    }

    await db('users')
      .where({ id: userId })
      .update({
        suspended: !!suspended,
        suspended_at: suspended ? db.fn.now() : null,
        suspended_by: suspended ? req.user!.id : null,
      });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// ----- County-scoped analytics (symptom reports + diagnoses for subadmin's county) -----
router.get('/analytics', authMiddleware, requireSubadmin, async (req: AuthRequest, res) => {
  try {
    const county = (req as any).countyScope as string;

    const symptomByCounty = await db('symptom_reports as sr')
      .join('users as u', 'u.id', 'sr.user_id')
      .select('u.county')
      .count('* as count')
      .where('u.county', 'ilike', county)
      .groupBy('u.county');

    const diagnosesByLabel = await db('diagnoses as d')
      .join('symptom_reports as sr', 'sr.id', 'd.report_id')
      .join('users as u', 'u.id', 'sr.user_id')
      .select('d.predicted_label')
      .count('* as count')
      .where('u.county', 'ilike', county)
      .groupBy('d.predicted_label')
      .orderBy('count', 'desc');

    res.json({
      county,
      symptomByCounty: symptomByCounty || [],
      diagnosesByLabel: diagnosesByLabel || [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// ----- County-scoped symptom reports (cases list + detail; read-only for subadmin) -----
router.get('/symptom-reports', authMiddleware, requireSubadmin, async (req: AuthRequest, res) => {
  try {
    const county = (req as any).countyScope as string;
    const { page = 1, limit = 20, status } = req.query;
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
      .where('u.county', 'ilike', county)
      .orderBy('sr.created_at', 'desc');

    if (status && String(status).trim() !== 'all') {
      q = q.where('sr.status', String(status).trim());
    }

    const [totalRow] = await q.clone().clearSelect().clearOrder().count('* as c');
    const total = Number((totalRow as any)?.c ?? 0);
    const rows = await q.limit(safeLimit).offset(offset);

    res.json({ cases: rows, total, page: safePage, limit: safeLimit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.get('/symptom-reports/:id', authMiddleware, requireSubadmin, async (req: AuthRequest, res) => {
  try {
    const county = (req as any).countyScope as string;
    const id = Number(req.params.id);
    const report = await db('symptom_reports').where('id', id).first();
    if (!report) return res.status(404).json({ error: 'Case not found' });

    const user = await db('users').where('id', report.user_id).select('name', 'county', 'sub_county').first();
    if (!user || (user as any).county?.toLowerCase() !== county.toLowerCase()) {
      return res.status(404).json({ error: 'Case not found in your county' });
    }

    const diagnosis = await db('diagnoses').where('report_id', id).orderBy('created_at', 'desc').first();
    const verifiedDoc = await db('verified_documents').where('report_id', id).orderBy('generated_at', 'desc').first();

    res.json({ report, user: user || null, diagnosis: diagnosis || null, verified_document: verifiedDoc || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// ----- County-scoped providers (approval flow like admin) -----
router.get('/providers', authMiddleware, requireSubadmin, async (req: AuthRequest, res) => {
  try {
    const county = (req as any).countyScope as string;
    const { status, type } = req.query;

    let q = db('providers as p')
      .join('users as u', 'u.id', 'p.user_id')
      .select(
        'p.id', 'p.name', 'p.provider_type', 'p.verification_status', 'p.verified_at',
        'p.license_number', 'p.verification_badge', 'p.rejection_reason',
        'p.license_expiry', 'p.renewal_reminder_sent_at',
        'u.email', 'u.phone', 'u.county', 'u.sub_county', 'p.created_at'
      )
      .where('u.county', 'ilike', county);

    if (status && String(status) !== 'all') q = q.where('p.verification_status', String(status));
    if (type && String(type) !== 'all') q = q.where('p.provider_type', String(type));

    const providers = await q.orderBy('p.created_at', 'desc');
    res.json(providers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.get('/providers/:id/application', authMiddleware, requireSubadmin, async (req: AuthRequest, res) => {
  try {
    const county = (req as any).countyScope as string;
    const providerId = Number(req.params.id);
    const provider = await db('providers as p')
      .join('users as u', 'u.id', 'p.user_id')
      .where('p.id', providerId)
      .where('u.county', 'ilike', county)
      .select('p.*')
      .first();
    if (!provider) return res.status(404).json({ error: 'Provider not found in your county' });

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

router.put('/providers/:id/confirm-documents', authMiddleware, requireSubadmin, async (req: AuthRequest, res) => {
  try {
    const county = (req as any).countyScope as string;
    const providerId = Number(req.params.id);
    const provider = await db('providers as p')
      .join('users as u', 'u.id', 'p.user_id')
      .where('p.id', providerId)
      .where('u.county', 'ilike', county)
      .select('p.id')
      .first();
    if (!provider) return res.status(404).json({ error: 'Provider not found in your county' });

    const app = await db('professional_applications').where({ provider_id: providerId }).first();
    if (!app) return res.status(404).json({ error: 'Application not found' });

    await db('professional_applications')
      .where({ id: app.id })
      .update({
        documents_verified_at: db.fn.now(),
        documents_verified_by: req.user!.id,
      });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.put('/providers/:id/verify', authMiddleware, requireSubadmin, async (req: AuthRequest, res) => {
  try {
    const county = (req as any).countyScope as string;
    const providerId = Number(req.params.id);
    const { license_number, license_expiry } = req.body || {};

    const provider = await db('providers as p')
      .join('users as u', 'u.id', 'p.user_id')
      .where('p.id', providerId)
      .where('u.county', 'ilike', county)
      .select('p.*')
      .first();
    if (!provider) return res.status(404).json({ error: 'Provider not found in your county' });

    const badge = (provider as any).provider_type === 'vet' ? 'Verified Veterinarian' : 'Verified Agrovet';
    const updatePayload: Record<string, unknown> = {
      verification_status: 'verified',
      verified_at: db.fn.now(),
      verified_by: req.user!.id,
      verification_badge: badge,
      license_number: license_number || (provider as any).license_number || null,
      rejection_reason: null,
    };
    if (license_expiry) updatePayload.license_expiry = license_expiry;

    await db('providers').where({ id: providerId }).update(updatePayload);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

router.put('/providers/:id/reject', authMiddleware, requireSubadmin, async (req: AuthRequest, res) => {
  try {
    const county = (req as any).countyScope as string;
    const providerId = Number(req.params.id);

    const provider = await db('providers as p')
      .join('users as u', 'u.id', 'p.user_id')
      .where('p.id', providerId)
      .where('u.county', 'ilike', county)
      .select('p.id')
      .first();
    if (!provider) return res.status(404).json({ error: 'Provider not found in your county' });

    const { reason } = req.body || {};
    await db('providers').where({ id: providerId }).update({
      verification_status: 'rejected',
      verified_at: null,
      verified_by: req.user!.id,
      verification_badge: null,
      rejection_reason: reason || 'Application rejected',
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

export default router;
