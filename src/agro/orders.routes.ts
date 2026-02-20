import { Router } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { sendSMS } from '../utils/sms_service';

const router = Router();
const ALLOWED_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

function generatePaymentRef(prefix: string = 'SL'): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1e9).toString(36);
  return `${prefix}-${ts}-${rand}`;
}

// Get user's orders
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const orders = await db('orders')
      .where('user_id', req.user.id)
      .orderBy('created_at', 'desc');

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await db('order_items')
          .join('agro_products', 'order_items.product_id', 'agro_products.id')
          .where('order_items.order_id', order.id)
          .select(
            'order_items.*',
            'agro_products.name',
            'agro_products.image_url',
            'agro_products.company'
          );

        return { ...order, items };
      })
    );

    res.json(ordersWithItems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Get orders containing my products (agrovet seller view)
router.get('/seller', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user.role !== 'agrovet' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'agrovets only' });
    }
    const provider = await db('providers').where({ user_id: req.user.id }).first();
    if (!provider) return res.json([]);

    const myProductIds = await db('agro_products').where({ provider_id: provider.id }).pluck('id');
    if (myProductIds.length === 0) return res.json([]);

    const orderIdsWithMyProducts = await db('order_items')
      .whereIn('product_id', myProductIds)
      .distinct('order_id')
      .pluck('order_id');

    const orders = await db('orders')
      .whereIn('id', orderIdsWithMyProducts)
      .orderBy('created_at', 'desc');

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await db('order_items')
          .join('agro_products', 'order_items.product_id', 'agro_products.id')
          .where('order_items.order_id', order.id)
          .whereIn('order_items.product_id', myProductIds)
          .select(
            'order_items.*',
            'agro_products.name',
            'agro_products.image_url',
            'agro_products.company'
          );
        const buyer = await db('users').where({ id: order.user_id }).select('id', 'name', 'email', 'phone').first();
        return { ...order, items, buyer };
      })
    );

    res.json(ordersWithItems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Get single order for seller (receipt / detail)
router.get('/seller/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user.role !== 'agrovet' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'agrovets only' });
    }
    const provider = await db('providers').where({ user_id: req.user.id }).first();
    if (!provider) return res.status(404).json({ error: 'Order not found' });
    const myProductIds = await db('agro_products').where({ provider_id: provider.id }).pluck('id');
    if (myProductIds.length === 0) return res.status(404).json({ error: 'Order not found' });
    const orderId = Number(req.params.id);
    const order = await db('orders').where('id', orderId).first();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const hasMyProducts = await db('order_items')
      .where({ order_id: orderId })
      .whereIn('product_id', myProductIds)
      .first();
    if (!hasMyProducts) return res.status(404).json({ error: 'Order not found' });
    const items = await db('order_items')
      .join('agro_products', 'order_items.product_id', 'agro_products.id')
      .where('order_items.order_id', orderId)
      .whereIn('order_items.product_id', myProductIds)
      .select(
        'order_items.*',
        'agro_products.name',
        'agro_products.image_url',
        'agro_products.company'
      );
    const buyer = await db('users').where({ id: order.user_id }).select('id', 'name', 'email', 'phone').first();
    res.json({ ...order, items, buyer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Update order status (seller) + send SMS to buyer
router.patch('/seller/:id/status', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user.role !== 'agrovet' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'agrovets only' });
    }
    const provider = await db('providers').where({ user_id: req.user.id }).first();
    if (!provider) return res.status(400).json({ error: 'Provider not found' });
    const myProductIds = await db('agro_products').where({ provider_id: provider.id }).pluck('id');
    if (myProductIds.length === 0) return res.status(400).json({ error: 'No products' });
    const orderId = Number(req.params.id);
    const { status } = req.body;
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Use: ' + ALLOWED_STATUSES.join(', ') });
    }
    const order = await db('orders').where('id', orderId).first();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const hasMyProducts = await db('order_items')
      .where({ order_id: orderId })
      .whereIn('product_id', myProductIds)
      .first();
    if (!hasMyProducts) return res.status(404).json({ error: 'Order not found' });
    await db('orders').where('id', orderId).update({ status });
    const updated = await db('orders').where('id', orderId).first();
    const buyer = await db('users').where({ id: order.user_id }).select('name', 'phone').first();
    if (buyer?.phone) {
      try {
        const msg = `SmartLivestock: Your order #${orderId} status is now "${status}". Thank you for your business.`;
        await sendSMS(buyer.phone, msg);
      } catch (smsErr) {
        console.error('[SMS] Order status notification failed:', smsErr);
      }
    }
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Get single order
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const order = await db('orders')
      .where({ id, user_id: req.user.id })
      .first();

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = await db('order_items')
      .join('agro_products', 'order_items.product_id', 'agro_products.id')
      .where('order_items.order_id', order.id)
      .select(
        'order_items.*',
        'agro_products.name',
        'agro_products.image_url',
        'agro_products.company'
      );

    res.json({ ...order, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Checkout (create order from cart). Optional provider_id = one order per agrovet (independent payments).
router.post('/checkout', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { phone, provider_id: reqProviderId } = req.body;

    let cartQuery = db('cart')
      .join('agro_products', 'cart.product_id', 'agro_products.id')
      .where('cart.user_id', req.user.id)
      .select(
        'cart.id as cart_id',
        'cart.product_id',
        'cart.qty',
        'agro_products.name',
        'agro_products.price',
        'agro_products.quantity as stock',
        'agro_products.provider_id'
      );
    if (reqProviderId != null) {
      cartQuery = cartQuery.where('agro_products.provider_id', Number(reqProviderId));
    }
    const cart = await cartQuery;

    if (!cart.length) {
      return res.status(400).json({
        error: reqProviderId != null ? 'No items from this shop in cart' : 'Cart is empty'
      });
    }

    for (const item of cart) {
      if (item.qty > item.stock) {
        return res.status(400).json({
          error: `Insufficient stock for ${item.name}. Available: ${item.stock}`
        });
      }
    }

    const total = cart.reduce((sum: number, item: { price: string; qty: number }) => sum + Number(item.price) * item.qty, 0);

    const [order] = await db('orders')
      .insert({
        user_id: req.user.id,
        total,
        status: 'pending',
        payment_ref: null
      })
      .returning('*');

    for (const item of cart) {
      await db('order_items').insert({
        order_id: order.id,
        product_id: item.product_id,
        qty: item.qty,
        price: item.price
      });
      await db('agro_products').where('id', item.product_id).decrement('quantity', item.qty);
    }

    const cartIds = cart.map((c: { cart_id: number }) => c.cart_id);
    await db('cart').whereIn('id', cartIds).del();

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Initialize Paystack payment (stubbed) - creates order from cart and returns a mock authorization URL.
router.post('/paystack/initialize', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { amount, email, provider_id: reqProviderId } = req.body as { amount?: number; email?: string; provider_id?: number };

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email is required for Paystack initialization' });
    }

    let cartQuery = db('cart')
      .join('agro_products', 'cart.product_id', 'agro_products.id')
      .where('cart.user_id', req.user.id)
      .select(
        'cart.id as cart_id',
        'cart.product_id',
        'cart.qty',
        'agro_products.name',
        'agro_products.price',
        'agro_products.quantity as stock',
        'agro_products.provider_id'
      );

    if (reqProviderId != null) {
      cartQuery = cartQuery.where('agro_products.provider_id', Number(reqProviderId));
    }

    const cart = await cartQuery;

    if (!cart.length) {
      return res.status(400).json({
        error: reqProviderId != null ? 'No items from this shop in cart' : 'Cart is empty'
      });
    }

    for (const item of cart) {
      if (item.qty > item.stock) {
        return res.status(400).json({
          error: `Insufficient stock for ${item.name}. Available: ${item.stock}`
        });
      }
    }

    const total = cart.reduce((sum: number, item: { price: string; qty: number }) => sum + Number(item.price) * item.qty, 0);

    // If caller supplied amount, allow small rounding differences but fail for large mismatches.
    if (amount != null) {
      const diff = Math.abs(Number(amount) - Number(total));
      if (diff > 1) {
        return res.status(400).json({ error: 'amount does not match cart total' });
      }
    }

    const paymentRef = generatePaymentRef('PSK');

    const [order] = await db('orders')
      .insert({
        user_id: req.user.id,
        total,
        status: 'pending',
        payment_ref: paymentRef
      })
      .returning('*');

    for (const item of cart) {
      await db('order_items').insert({
        order_id: order.id,
        product_id: item.product_id,
        qty: item.qty,
        price: item.price
      });
      await db('agro_products').where('id', item.product_id).decrement('quantity', item.qty);
    }

    const cartIds = cart.map((c: { cart_id: number }) => c.cart_id);
    await db('cart').whereIn('id', cartIds).del();

    // For now we return a mock URL that front-end can redirect to.
    const authorization_url = `about:blank#paystack-mock-${paymentRef}`;

    res.json({
      authorization_url,
      reference: paymentRef,
      order,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Verify Paystack payment (stubbed) - marks order as processing if reference matches an order.
router.post('/paystack/verify', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { reference, provider_id: _providerId } = req.body as { reference?: string; provider_id?: number };

    if (!reference || typeof reference !== 'string') {
      return res.status(400).json({ error: 'reference is required' });
    }

    const order = await db('orders')
      .where({ payment_ref: reference, user_id: req.user.id })
      .first();

    if (!order) {
      return res.status(404).json({ error: 'Order not found for this reference' });
    }

    if (order.status === 'pending') {
      await db('orders').where('id', order.id).update({ status: 'processing' });
    }

    const updated = await db('orders').where('id', order.id).first();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Re-initialize Paystack payment for an existing order (stubbed)
router.post('/paystack/reinitialize', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { order_id } = req.body as { order_id?: number };

    if (!order_id) {
      return res.status(400).json({ error: 'order_id is required' });
    }

    const order = await db('orders')
      .where({ id: order_id, user_id: req.user.id })
      .first();

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const paymentRef = generatePaymentRef('PSK');
    await db('orders').where('id', order.id).update({ payment_ref: paymentRef });

    const updated = await db('orders').where('id', order.id).first();
    const authorization_url = `about:blank#paystack-reinit-${paymentRef}`;

    res.json({
      authorization_url,
      reference: paymentRef,
      order: updated,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

export default router;
