import { Router } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { report_id, provider_id, scheduled_at } = req.body;
    const [ins] = await db('appointments').insert({
      report_id,
      provider_id,
      farmer_id: req.user.id,
      scheduled_at,
      status: 'pending'
    }).returning(['id','status']);
    res.status(201).json(ins);
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }); }
});

router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user.role === 'farmer') {
      const rows = await db('appointments').where('farmer_id', req.user.id);
      return res.json(rows);
    } else if (req.user.role === 'vet') {
      const provider = await db('providers').where('user_id', req.user.id).first();
      if (!provider) return res.json([]);
      const rows = await db('appointments').where('provider_id', provider.id);
      return res.json(rows);
    } else {
      const rows = await db('appointments');
      return res.json(rows);
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }); }
});

export default router;
