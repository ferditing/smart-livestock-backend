import { Router } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// List products (public)
router.get('/', async (req, res) => {
  const { provider_id } = req.query;
  let q = db('agro_products').orderBy('created_at', 'desc');
  if (provider_id) q = q.where('provider_id', Number(provider_id));
  const rows = await q;
  res.json(rows);
});

// Create product (agrovet only)
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user.role !== 'agrovet' && req.user.role !== 'admin')
      return res.status(403).json({ error: 'agrovets only' });

    const { name, price, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    // find provider record for this agrovet user
    const provider = await db('providers').where('user_id', req.user.id).first();
    if (!provider) return res.status(400).json({ error: 'provider profile not registered' });

    const [prod] = await db('agro_products')
      .insert({ provider_id: provider.id, name, price, description })
      .returning('*');

    res.status(201).json(prod);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Update product (agrovet only)
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user.role !== 'agrovet' && req.user.role !== 'admin')
      return res.status(403).json({ error: 'agrovets only' });

    const id = Number(req.params.id);
    const changes = req.body;

    const updated = await db('agro_products').where('id', id).update(changes).returning('*');
    if (!updated.length) return res.status(404).json({ error: 'not found' });
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Delete product (agrovet only)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user.role !== 'agrovet' && req.user.role !== 'admin')
      return res.status(403).json({ error: 'agrovets only' });

    const id = Number(req.params.id);
    await db('agro_products').where('id', id).del();
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});


router.get("/mine", authMiddleware, async (req: AuthRequest, res) => {
  if(req.user.role !=="agro"){
    return res.status(403).json({error: "agrovet only"})
  }

  const provider = await db("providers")
  .where({user_id: req.user.id})
  .first();

  if(!provider){
    return res.json([]);
  }
  const products = await db("products")
  .where({provider_id: provider.id})
  .orderBy("created_at", "desc")

  res.json(products);
});


router.get("/by-provider/:providerId", async (req, res) => {
  const { providerId } = req.params;

  const products = await db("products")
  .where({provider_id: providerId})
  .orderBy("created_at", "asc")

  res.json(products);
});

export default router;
