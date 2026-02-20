import { Router } from 'express';
import db from '../db';

const router = Router();

/**
 * GET /api/agro/shops
 * List agrovet shops for marketplace: shop name, location (county, sub_county), product count.
 * Query: search (filter by shop name)
 */
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;

    const providers = await db('providers')
      .where({ provider_type: 'agrovet' })
      .select('id', 'name', 'user_id');

    if (providers.length === 0) {
      return res.json([]);
    }

    const userIds = providers.map((p: { user_id: number }) => p.user_id);
    const users = await db('users')
      .whereIn('id', userIds)
      .select('id', 'name', 'county', 'sub_county', 'profile_meta');

    const userMap = new Map(users.map((u: { id: number }) => [u.id, u]));
    const productCounts = await db('agro_products')
      .whereIn('provider_id', providers.map((p: { id: number }) => p.id))
      .groupBy('provider_id')
      .select('provider_id', db.raw('count(*) as count'));

    const countMap = new Map(
      (productCounts as { provider_id: number; count: string }[]).map((r) => [
        r.provider_id,
        Number(r.count),
      ])
    );

    let shops = providers.map((p: { id: number; name: string; user_id: number }) => {
      const user = userMap.get(p.user_id) as
        | { name: string; county?: string; sub_county?: string; profile_meta?: Record<string, unknown> }
        | undefined;
      const meta = user?.profile_meta || {};
      const shopName =
        (meta.shop_name as string) || user?.name || p.name || 'Agrovet Shop';
      const county = user?.county || (meta.county as string) || null;
      const subCounty =
        user?.sub_county || (meta.sub_county as string) || (meta.subcounty as string) || null;
      return {
        id: p.id,
        shopName,
        county,
        subCounty,
        productCount: countMap.get(p.id) || 0,
      };
    });

    if (search && String(search).trim()) {
      const term = String(search).trim().toLowerCase();
      shops = shops.filter(
        (s: { shopName: string; county?: string | null; subCounty?: string | null }) =>
          s.shopName.toLowerCase().includes(term) ||
          (s.county && s.county.toLowerCase().includes(term)) ||
          (s.subCounty && s.subCounty.toLowerCase().includes(term))
      );
    }

    res.json(shops);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

export default router;
