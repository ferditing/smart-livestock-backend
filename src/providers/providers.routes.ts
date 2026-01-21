// FILE: src/providers/providers.routes.ts

import { Router } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

/**
 * GET nearby providers
 * ?lat=&lng=&radius= (meters)
 */
router.get("/nearby", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { lat, lng, radius = 10000 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng required" });
    }

    const q = await db.raw(
      `
      SELECT 
        id,
        name,
        provider_type,
        contact,
        ST_Y(location::geometry) AS lat,
        ST_X(location::geometry) AS lng,
        ST_Distance(
          location,
          ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography
        ) AS distance_m
      FROM providers
      WHERE location IS NOT NULL
        AND ST_DWithin(
          location,
          ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography,
          ?
        )
      ORDER BY distance_m ASC
      `,
      [
        lng,
        lat,
        lng,
        lat,
        Number(radius),
      ]
    );

    res.json(q.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});


/**
 * CREATE provider (manual — mostly for admin or legacy use)
 * NOTE: vets/agrovets are now auto-created on register
 */
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!['vet', 'agrovet', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'only vets/agrovets can register a provider' });
    }

    const { name, provider_type, lat, lng, services, contact } = req.body;

    const [ins] = await db('providers')
      .insert({
        user_id: req.user.id,
        name,
        provider_type,
        services: services ? JSON.stringify(services) : null,
        contact: contact ? JSON.stringify(contact) : null,
        location: lat && lng
          ? db.raw(
              'ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography',
              [parseFloat(lng), parseFloat(lat)]
            )
          : null
      })
      .returning(['id', 'name']);

    res.status(201).json(ins);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

/**
 * GET products for a provider (Farmer → Agrovet catalog)
 */
router.get('/:providerId/products', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { providerId } = req.params;

    const products = await db('agro_products')
      .where({ provider_id: providerId })
      .orderBy('created_at', 'desc');

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

export default router;
