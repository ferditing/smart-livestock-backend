import { Router } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Vet confirms/corrects diagnosis
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user.role !== 'vet' && req.user.role !== 'admin') return res.status(403).json({ error: 'only vets or admin' });
    const { report_id, confirmed_label, notes } = req.body;
    await db('feedback_labels').insert({
      report_id,
      vet_id: req.user.id,
      confirmed_label,
      notes
    });
    await db('diagnoses').insert({
      report_id,
      predicted_label: confirmed_label,
      confidence: 1.0,
      recommended_actions: JSON.stringify({ from_feedback: true }),
      model_version: null
    });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }); }
});

export default router;
