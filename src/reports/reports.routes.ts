import { Router } from 'express';
import multer, { MulterError } from 'multer';
import type { Express } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const upload = multer({ dest: 'uploads/' });
const router = Router();

// Create symptom report
router.post('/', authMiddleware, upload.array('images', 5), async (req: AuthRequest, res) => {
  try {
    const { animal_id, species, breed, age, weight, symptom_text, lat, lng } = req.body;
    const imageFiles = ((req as any).files as Express.Multer.File[] | undefined) || [];
    const imagePaths = imageFiles.map(f => f.filename);
    const insert = await db('symptom_reports').insert({
      user_id: req.user.id,
      animal_id: animal_id || null,
      symptom_text,
      images: db.raw('ARRAY[?]::text[]', [imagePaths]),
      location: db.raw('ST_SetSRID(ST_MakePoint(?,?)::geometry,4326)::geography', [parseFloat(lng), parseFloat(lat)])
    }).returning(['id','created_at']);
    const report = insert[0];
    // TODO: enqueue prediction job (Bull/Redis) or call worker
    res.status(201).json({ report_id: report.id, status: 'received' });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'server error' });
  }
});

// Get report and latest diagnosis
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const report = await db('symptom_reports').where('id', id).first();
    if (!report) return res.status(404).json({ error: 'not found' });
    if (req.user.role === 'farmer' && report.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });
    const diagnosis = await db('diagnoses').where('report_id', id).orderBy('created_at','desc').first();
    res.json({ report, diagnosis });
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }); }
});

export default router;
