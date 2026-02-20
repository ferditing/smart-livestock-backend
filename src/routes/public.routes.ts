import { Router } from 'express';
import db from '../db';

const router = Router();

router.get('/counties', async (_req, res) => {
  try {
    const counties = await db('counties').select('id', 'name').orderBy('name');
    res.json(counties);
  } catch (err) {
    if ((err as any)?.code === '42P01') return res.json([]);
    res.json([]);
  }
});

export default router;
