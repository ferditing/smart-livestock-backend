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
    const { animal_type } = req.body || {};
    if (animal_type === 'buffalo') {
      return res.status(400).json({ error: 'unsupported animal type' });
    }
    const ml = process.env.ML_SERVICE_URL || 'http://localhost:8001';
    // If the client provided free-text or a symptom array, forward to the
    // ML service text endpoint which performs NLP and feature extraction.
    if (req.body && (req.body.symptom_text || req.body.symptoms)) {
      const bodyForText = {
        animal: (req.body.animal || req.body.animal_type || '').toLowerCase(),
        symptom_text: req.body.symptom_text || (Array.isArray(req.body.symptoms) ? req.body.symptoms.join(', ') : ''),
        age: req.body.age,
        body_temperature: req.body.body_temperature,
      };
      const r = await axios.post(`${ml}/predict_from_text`, bodyForText, { timeout: 10000 });
      return res.json(r.data);
    }

    const r = await axios.post(`${ml}/predict`, req.body, { timeout: 10000 });
    res.json(r.data);
  } catch (err: any) {
    console.error('ML predict proxy failed', err?.message || err);
    res.status(502).json({ error: 'prediction failed' });
  }
});


router.post('/predict_from_text', async(req, res) => {
  try{
    const { animal, symptom_text, age, body_temperature } = req.body || {};
    if (animal !== 'cow' && animal !== 'goat' && animal !== 'sheep') {
      return res.status(400).json({ error: 'unsupported animal type' });
    }
    const ml = process.env.ML_SERVICE_URL || 'http://localhost:8001';
    const r = await axios.post (`${ml}/predict_from_text`, req.body, {timeout: 10000});
    res.json (r.data);
  } catch (err: any){
    console.error ('ML predict_from_text proxy failed', err?.message || err);
    res.status (502).json ({error: 'prediction failed'});
  }
})

export default router;
