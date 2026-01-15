import { Router } from 'express';
import axios from 'axios';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Proxy ML service health (features + labels)
router.get('/health', async (_req, res) => {
  try {
    const ml = process.env.ML_SERVICE_URL || 'http://localhost:8001';
    const r = await axios.get(`${ml}/health`, { timeout: 5000 });
    res.json(r.data);
  } catch (err: any) {
    console.error('ML health proxy failed', err?.message || err);
    res.status(502).json({ error: 'ml service unavailable' });
  }
});

// Proxy predict — allow farmers to get immediate prediction
router.post('/predict', async (req, res) => {
  try {
    const ml = process.env.ML_SERVICE_URL || 'http://localhost:8001';
    const r = await axios.post(`${ml}/predict`, req.body, { timeout: 10000 });
    res.json(r.data);
  } catch (err: any) {
    console.error('ML predict proxy failed', err?.message || err);
    res.status(502).json({ error: 'prediction failed' });
  }
});

export default router;
