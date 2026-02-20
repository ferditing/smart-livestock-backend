import { Router } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

const ALLOWED_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

/** GET /api/agro/stats - Agrovet dashboard stats + chart data + shop info */
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user.role !== 'agrovet' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'agrovets only' });
    }

    const user = await db('users')
      .where({ id: req.user.id })
      .select('name', 'county', 'sub_county', 'profile_meta')
      .first();
    const meta = (user?.profile_meta as Record<string, unknown>) || {};
    const shopName = (meta.shop_name as string) || user?.name || 'Agrovet Shop';
    const shopInfo = {
      shopName,
      county: user?.county || (meta.county as string) || '—',
      subCounty: user?.sub_county || (meta.sub_county as string) || (meta.subcounty as string) || '—',
    };

    const provider = await db('providers').where({ user_id: req.user.id }).first();
    if (!provider) {
      return res.json({
        productCount: 0,
        totalRevenue: 0,
        orderCount: 0,
        customerCount: 0,
        ordersThisMonth: 0,
        revenueThisMonth: 0,
        shopInfo,
        revenueByMonth: [],
        ordersByStatus: [],
      });
    }

    const productCountResult = await db('agro_products')
      .where({ provider_id: provider.id })
      .count('* as c')
      .first();
    const productCount = Number(productCountResult?.c ?? 0);

    const myProductIds = await db('agro_products')
      .where({ provider_id: provider.id })
      .pluck('id');

    let totalRevenue = 0;
    let orderCount = 0;
    let customerCount = 0;
    let ordersThisMonth = 0;
    let revenueThisMonth = 0;
    const revenueByMonth: { month: string; revenue: number; year: number }[] = [];
    const ordersByStatus: { status: string; count: number }[] = [];

    if (myProductIds.length > 0) {
      const revenueRows = await db('order_items')
        .join('agro_products', 'order_items.product_id', 'agro_products.id')
        .whereIn('order_items.product_id', myProductIds)
        .select(db.raw('SUM(order_items.price * order_items.qty) as total'));
      totalRevenue = Number(revenueRows[0]?.total ?? 0);

      const orderIdsWithMyProducts = await db('order_items')
        .whereIn('product_id', myProductIds)
        .distinct('order_id')
        .pluck('order_id');

      if (orderIdsWithMyProducts.length > 0) {
        orderCount = orderIdsWithMyProducts.length;

        const customersResult = await db('orders')
          .whereIn('id', orderIdsWithMyProducts)
          .countDistinct('user_id as c')
          .first();
        customerCount = Number(customersResult?.c ?? 0);

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const monthOrderIds = await db('orders')
          .whereIn('id', orderIdsWithMyProducts)
          .where('created_at', '>=', startOfMonth.toISOString())
          .pluck('id');
        ordersThisMonth = monthOrderIds.length;

        if (monthOrderIds.length > 0) {
          const monthRevenueRows = await db('order_items')
            .whereIn('product_id', myProductIds)
            .whereIn('order_id', monthOrderIds)
            .select(db.raw('SUM(price * qty) as total'))
            .first();
          revenueThisMonth = Number(monthRevenueRows?.total ?? 0);
        }

        // Revenue by month (last 6 months)
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          d.setDate(1);
          d.setHours(0, 0, 0, 0);
          const next = new Date(d);
          next.setMonth(next.getMonth() + 1);
          const monthKey = d.toISOString().slice(0, 7);
          const rev = await db('order_items')
            .whereIn('product_id', myProductIds)
            .join('orders', 'orders.id', 'order_items.order_id')
            .where('orders.created_at', '>=', d.toISOString())
            .where('orders.created_at', '<', next.toISOString())
            .select(db.raw('SUM(order_items.price * order_items.qty) as total'))
            .first();
          revenueByMonth.push({
            month: monthKey,
            revenue: Number(rev?.total ?? 0),
            year: d.getFullYear(),
          });
        }

        // Orders by status (only orders that contain my products)
        const statusCounts = await db('orders')
          .whereIn('id', orderIdsWithMyProducts)
          .select('status')
          .groupBy('status');
        for (const row of statusCounts as { status: string }[]) {
          const countResult = await db('orders')
            .whereIn('id', orderIdsWithMyProducts)
            .where('status', row.status)
            .count('* as c')
            .first();
          ordersByStatus.push({
            status: row.status,
            count: Number((countResult as { c: number })?.c ?? 0),
          });
        }
        ALLOWED_STATUSES.forEach((s) => {
          if (!ordersByStatus.some((o) => o.status === s)) {
            ordersByStatus.push({ status: s, count: 0 });
          }
        });
      }
    }

    res.json({
      productCount,
      totalRevenue,
      orderCount,
      customerCount,
      ordersThisMonth,
      revenueThisMonth,
      shopInfo,
      revenueByMonth,
      ordersByStatus,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

export default router;
