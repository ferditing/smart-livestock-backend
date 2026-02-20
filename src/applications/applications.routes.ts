import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, '../../uploads/professional_docs');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const user = (req as AuthRequest).user;
    const ext = path.extname(file.originalname) || '.pdf';
    const safeName = `${user?.id}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|jpg|jpeg|png|doc|docx)$/i.test(file.originalname);
    cb(null, allowed);
  },
});

// Document types per provider type (from spec)
const VET_DOC_TYPES = ['national_id', 'kcse_certificate', 'academic_certificate', 'kvb_registration', 'vmd_certification'];
const AGROVET_DOC_TYPES = ['academic_certificate', 'kvb_registration', 'vmd_certification', 'business_registration', 'county_permit', 'pcpb_license', 'premises_inspection'];

function getDocTypes(providerType: string): string[] {
  return providerType === 'vet' ? VET_DOC_TYPES : AGROVET_DOC_TYPES;
}

/**
 * GET my application (vet/agrovet)
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!['vet', 'agrovet'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Only vets and agrovets can submit applications' });
    }

    const provider = await db('providers').where({ user_id: req.user!.id }).first();
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const app = await db('professional_applications')
      .where({ provider_id: provider.id })
      .orderBy('created_at', 'desc')
      .first();

    if (!app) {
      return res.json({
        application: null,
        provider_id: provider.id,
        provider_type: provider.provider_type,
        document_types: getDocTypes(provider.provider_type),
      });
    }

    const docs = (app.documents as { type: string; path: string; filename: string }[]) || [];
    res.json({
      application: { ...app, documents: docs },
      provider_id: provider.id,
      provider_type: provider.provider_type,
      document_types: getDocTypes(provider.provider_type),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

/**
 * POST submit/update application with document uploads
 * Expects multipart/form-data: document_national_id, document_kvb_registration, etc.
 */
router.post('/submit', authMiddleware, upload.any(), async (req: AuthRequest, res) => {
  try {
    if (!['vet', 'agrovet'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Only vets and agrovets can submit applications' });
    }

    const provider = await db('providers').where({ user_id: req.user!.id }).first();
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const docTypes = getDocTypes(provider.provider_type);
    const documents: { type: string; path: string; filename: string }[] = [];

    const files = (req as any).files || [];
    for (const file of files) {
      const match = file.fieldname?.match(/^document_(.+)$/);
      if (match && docTypes.includes(match[1])) {
        const relativePath = `/uploads/professional_docs/${file.filename}`;
        documents.push({ type: match[1], path: relativePath, filename: file.originalname || file.filename });
      }
    }

    const existing = await db('professional_applications')
      .where({ provider_id: provider.id })
      .first();

    const existingDocs = (existing?.documents as { type: string }[] || []);
    const newTypes = new Set(documents.map((d) => d.type));
    const merged = existingDocs.filter((d) => !newTypes.has(d.type)).concat(documents);

    if (existing) {
      await db('professional_applications')
        .where({ id: existing.id })
        .update({
          documents: JSON.stringify(merged),
          status: 'pending',
          updated_at: db.fn.now(),
        });
    } else {
      await db('professional_applications').insert({
        user_id: req.user!.id,
        provider_id: provider.id,
        application_type: provider.provider_type,
        status: 'pending',
        documents: JSON.stringify(merged),
      });
    }

    const updated = await db('professional_applications')
      .where({ provider_id: provider.id })
      .first();

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

/**
 * DELETE a document from application
 */
router.delete(
  '/documents/:docPath',
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const provider = await db('providers')
        .where({ user_id: req.user!.id })
        .first();

      if (!provider)
        return res.status(404).json({ error: 'Provider not found' });

      // ✅ Type-safe handling
      const param = req.params.docPath;

      if (!param || Array.isArray(param)) {
        return res.status(400).json({ error: 'Invalid document path' });
      }

      const docPath = decodeURIComponent(param);

      const app = await db('professional_applications')
        .where({ provider_id: provider.id })
        .first();

      if (!app || !app.documents)
        return res.status(404).json({ error: 'Document not found' });

      const docs = (
        app.documents as { type: string; path: string; filename: string }[]
      ).filter((d) => d.path !== docPath);

      await db('professional_applications')
        .where({ id: app.id })
        .update({
          documents: JSON.stringify(docs),
          updated_at: db.fn.now(),
        });

      res.json({ ok: true });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'server error' });
    }
  }
);


export default router;
