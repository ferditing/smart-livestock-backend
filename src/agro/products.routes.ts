import { Router } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { uploadProductImage } from "../middleware/upload.middleware";

const router = Router();

// List products (public) - for marketplace
router.get('/', async (req, res) => {
  const { provider_id, category, search, page = 1, limit = 12 } = req.query;

  // Base query with filters only (no orderBy/limit - required for count in PostgreSQL)
  let baseQuery = db('agro_products').where('quantity', '>', 0);
  if (provider_id) baseQuery = baseQuery.where('provider_id', Number(provider_id));
  if (category) baseQuery = baseQuery.where('category', String(category));
  if (search) baseQuery = baseQuery.where('name', 'ilike', `%${search}%`);

  const offset = (Number(page) - 1) * Number(limit);
  const totalResult = await baseQuery.clone().count('* as c').first();
  const total = Number(totalResult?.c ?? 0);

  const rows = await baseQuery
    .orderBy('created_at', 'desc')
    .limit(Number(limit))
    .offset(offset);

  res.json({
    data: rows,
    total,
    page: Number(page),
    limit: Number(limit)
  });
});

// Vet: list products that requested verification (vet dashboard)
router.get('/vet/verification-requests', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user.role !== 'vet' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'vets only' });
    }

    const rows = await db('agro_products')
      .join('providers', 'agro_products.provider_id', 'providers.id')
      .join('users', 'providers.user_id', 'users.id')
      .where('agro_products.vet_verification_requested', true)
      .select(
        'agro_products.*',
        db.raw("COALESCE(users.profile_meta->>'shop_name', users.name, providers.name) AS shop_name")
      )
      .orderBy('agro_products.created_at', 'desc');

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Vet: verify or reject a product
router.patch('/vet/verify/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user.role !== 'vet' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'vets only' });
    }

    const id = Number(req.params.id);
    const { approved, notes } = req.body as { approved?: boolean; notes?: string };
    if (approved == null) {
      return res.status(400).json({ error: 'approved (boolean) required' });
    }

    const updated = await db('agro_products')
      .where('id', id)
      .update({
        vet_verified: Boolean(approved),
        vet_verified_at: db.fn.now(),
        vet_verified_by: req.user.id,
        vet_verification_requested: false,
        vet_verification_notes: notes ?? null,
      })
      .returning('*');

    if (!updated.length) return res.status(404).json({ error: 'not found' });
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Create product (agrovet only)
router.post(
  '/',
  authMiddleware,
  uploadProductImage.single("image"),
  async (req: AuthRequest, res) => {
    try {
      if (req.user.role !== 'agrovet' && req.user.role !== 'admin')
        return res.status(403).json({ error: 'agrovets only' });

      const {
        name,
        price,
        description,
        quantity,
        usage,
        company
      } = req.body;

      if (!name)
        return res.status(400).json({ error: 'name required' });

      const provider = await db('providers')
        .where('user_id', req.user.id)
        .first();

      if (!provider)
        return res.status(400).json({ error: 'provider profile not registered' });

      const imageUrl = req.file
        ? `/uploads/products/${req.file.filename}`
        : null;

      const [prod] = await db('agro_products')
        .insert({
          provider_id: provider.id,
          name,
          price,
          description,
          quantity,
          usage,
          company,
          image_url: imageUrl,
          vet_verification_requested: false,
          vet_verified: false,
        })
        .returning('*');

      res.status(201).json(prod);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'server error' });
    }
  }
);

// Update product (agrovet only)
router.put(
  '/:id',
  authMiddleware,
  uploadProductImage.single("image"),
  async (req: AuthRequest, res) =>  {
  try {
    if (req.user.role !== 'agrovet' && req.user.role !== 'admin')
      return res.status(403).json({ error: 'agrovets only' });

    const id = Number(req.params.id);
    const changes = req.body;
     if (req.file) {
        changes.image_url = `/uploads/products/${req.file.filename}`;
      }
    const updated = await db('agro_products')
    .where('id', id)
    .update(changes)
    .returning('*');
    if (!updated.length) return res.status(404)
      .json({ error: 'not found' });
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Agrovet: request vet verification for a product
router.patch('/:id/request-vet-verification', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user.role !== 'agrovet' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'agrovets only' });
    }

    const id = Number(req.params.id);

    const provider = await db('providers').where('user_id', req.user.id).first();
    if (!provider) {
      return res.status(400).json({ error: 'provider profile not registered' });
    }

    const product = await db('agro_products').where({ id, provider_id: provider.id }).first();
    if (!product) {
      return res.status(404).json({ error: 'not found' });
    }

    const updated = await db('agro_products')
      .where({ id, provider_id: provider.id })
      .update({
        vet_verification_requested: true,
      })
      .returning('*');

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
  if (req.user.role !== 'agrovet' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'agrovets only' });
  }

  const provider = await db("providers")
  .where({user_id: req.user.id})
  .first();

  if(!provider){
    return res.json([]);
  }
  const products = await db("agro_products")
  .where({provider_id: provider.id})
  .orderBy("created_at", "desc")

  res.json(products);
});


router.get("/by-provider/:providerId", async (req, res) => {
  const { providerId } = req.params;
  const { page = 1, search = "" } = req.query;

  const limit = 12;
  const offset = (Number(page) - 1) * limit;

  let query = db("agro_products")
    .where({ provider_id: providerId })
    .andWhere("name", "ilike", `%${search}%`);

  const total = await query.clone().count("* as c").first();

  const data = await query
    .limit(limit)
    .offset(offset)
    .orderBy("created_at", "desc");

  res.json({
    data,
    total: total?.c,
    page
  });
});

export default router;
