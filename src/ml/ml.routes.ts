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
    const ml = process.env.ML_SERVICE_URL || 'http://localhost:8001';
    // If the client provided free-text or a symptom array, forward to the
    // ML service text endpoint which performs NLP and feature extraction.
    if (req.body && (req.body.symptom_text || req.body.symptoms)) {
      const bodyForText = {
        animal: (req.body.animal || req.body.animal_type || '').toLowerCase().trim(),
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
    console.error('[ML] /predict proxy failed:', err?.response?.status, err?.response?.data || err?.message);
    res.status(502).json({ error: 'prediction failed', details: err?.message });
  }
});


router.post('/predict_from_text', async (req, res) => {
  try {
    let { animal, symptom_text, age, body_temperature } = req.body || {};
    let normalized_animal = (animal || '').toLowerCase().trim();
    const ml = process.env.ML_SERVICE_URL || 'http://localhost:8001';
    
    
    // If animal is empty/not provided, try to detect it from text
    if (!normalized_animal && symptom_text) {
      try {
        const normalizeRes = await axios.post(`${ml}/normalize`, {
          animal: '',
          symptom_text: symptom_text
        }, { timeout: 5000 });
        normalized_animal = normalizeRes.data?.animal_type || '';
      } catch (normalizeErr: any) {
        console.warn('[ML] Auto-detect failed:', normalizeErr?.response?.status, normalizeErr?.response?.data || normalizeErr?.message);
      }
    }
    
    // If still no animal after all attempts, just send empty and let ML service handle it
    const r = await axios.post(`${ml}/predict_from_text`, {
      animal: normalized_animal,
      symptom_text: symptom_text,
      age: age,
      body_temperature: body_temperature
    }, { timeout: 10000 });
    
    res.json(r.data);
  } catch (err: any) {
    console.error('[ML] /predict_from_text failed with:', { 
      status: err?.response?.status, 
      data: err?.response?.data,
      message: err?.message 
    });
    res.status(502).json({ error: 'prediction failed', details: err?.response?.data?.detail || err?.message });
  }
});


router.get('/symptoms_for_animal/:animal', async (req, res) => {
  try {
    const { animal } = req.params;
    const ml = process.env.ML_SERVICE_URL || 'http://localhost:8001';
    
    const r = await axios.get(`${ml}/symptoms_for_animal/${animal}`, { timeout: 5000 });
    
    res.json(r.data);
  } catch (err: any) {
    console.error('[ML] /symptoms_for_animal failed:', err?.response?.status, err?.response?.data || err?.message);
    res.status(502).json({ error: 'failed to fetch symptoms', details: err?.response?.data?.detail || err?.message });
  }
});

export default router;
