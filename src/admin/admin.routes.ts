import { Router } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

router.get('/model_versions', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'admin only' });
    const rows = await db('model_versions').select('*').orderBy('created_at','desc');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }); }
});

router.post('/model_versions', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'admin only' });
    const { version_tag, artifact_path, trained_on_date, metrics } = req.body;
    const [ins] = await db('model_versions').insert({
      version_tag, artifact_path, trained_on_date, metrics: JSON.stringify(metrics || {})
    }).returning(['id','version_tag']);
    res.status(201).json(ins);
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }); }
});

export default router;
