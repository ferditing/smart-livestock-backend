import { Router } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Get user's cart (include provider_id and shop_name for grouping by agrovet)
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const rows = await db('cart')
      .join('agro_products', 'cart.product_id', 'agro_products.id')
      .join('providers', 'agro_products.provider_id', 'providers.id')
      .join('users', 'providers.user_id', 'users.id')
      .where('cart.user_id', req.user.id)
      .select(
        'cart.id',
        'cart.qty',
        'cart.product_id',
        'agro_products.name',
        'agro_products.price',
        'agro_products.image_url',
        'agro_products.quantity as stock',
        'agro_products.company',
        'agro_products.description',
        'agro_products.provider_id',
        db.raw("COALESCE(users.profile_meta->>'shop_name', users.name, providers.name) AS shop_name")
      );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Add to cart
router.post('/add', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { product_id, qty = 1 } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: 'product_id required' });
    }

    // Check if product exists and has stock
    const product = await db('agro_products').where('id', product_id).first();
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.quantity < qty) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    // Check if item already in cart
    const existing = await db('cart')
      .where({ user_id: req.user.id, product_id })
      .first();

    if (existing) {
      // Update quantity
      const newQty = existing.qty + qty;
      if (newQty > product.quantity) {
        return res.status(400).json({ error: 'Insufficient stock' });
      }
      await db('cart')
        .where('id', existing.id)
        .update({ qty: newQty });
    } else {
      // Insert new
      await db('cart').insert({
        user_id: req.user.id,
        product_id,
        qty
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Update cart item quantity
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { qty } = req.body;

    const cartItem = await db('cart')
      .where({ id, user_id: req.user.id })
      .first();

    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    const product = await db('agro_products')
      .where('id', cartItem.product_id)
      .first();

    if (qty > product.quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    await db('cart').where('id', id).update({ qty });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Remove from cart
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await db('cart')
      .where({ id, user_id: req.user.id })
      .del();

    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Clear cart
router.delete('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await db('cart').where('user_id', req.user.id).del();
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

export default router;
