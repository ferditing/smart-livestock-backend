import { Router } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Nearby providers: ?lat=&lng=&radius (meters)
router.get('/nearby', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { lat, lng, radius = 10000 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
    const q = await db.raw(
      `SELECT id, name, provider_type, services, contact,
        ST_Distance(location, ST_SetSRID(ST_MakePoint(?,?)::geometry,4326)::geography) as distance_m
       FROM providers
       WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(?,?)::geometry,4326)::geography, ?)
       ORDER BY distance_m ASC
      `, [parseFloat(lng as string), parseFloat(lat as string), parseFloat(lng as string), parseFloat(lat as string), parseInt(radius as string)]
    );
    res.json(q.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }); }
});

// Create provider (vet registers)
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!(req.user.role === 'vet' || req.user.role === 'agrovet' || req.user.role === 'admin')) {
      return res.status(403).json({ error: 'only vets/agrovets can register a provider' });
    }
    const { name, provider_type, lat, lng, services, contact } = req.body;
    const [ins] = await db('providers').insert({
      user_id: req.user.id,
      name,
      provider_type,
      services: JSON.stringify(services || {}),
      contact: JSON.stringify(contact || {}),
      location: db.raw('ST_SetSRID(ST_MakePoint(?,?)::geometry,4326)::geography', [parseFloat(lng), parseFloat(lat)])
    }).returning(['id','name']);
    res.status(201).json(ins);
  } catch (err) { console.error(err); res.status(500).json({ error: 'server error' }); }
});

export default router;
