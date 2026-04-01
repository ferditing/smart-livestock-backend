import { Knex } from "knex";
import { calculateCommission } from "./commission.service";

export type CartItem = {
  product_id: number;
  qty: number;
};

export interface CreatedOrder {
  id: number;
  user_id: number;
  total: number;
  status: string;
  payment_ref: string | null;
  created_at: string;
}

export class OrderService {
  constructor(private knex: Knex) {}

  /**
   * Create a master order + order_items + shop_orders
   * using the current contents of the cart table for a user.
   * This mirrors the existing /agro/orders/checkout behaviour,
   * but also creates shop_orders rows for the marketplace flow.
   */
  async createOrderFromCart(userId: number, providerId?: number | null): Promise<CreatedOrder> {
    return this.knex.transaction(async (trx) => {
      let cartQuery = trx("cart")
        .join("agro_products", "cart.product_id", "agro_products.id")
        .where("cart.user_id", userId)
        .select(
          "cart.id as cart_id",
          "cart.product_id",
          "cart.qty",
          "agro_products.name",
          "agro_products.price",
          "agro_products.quantity as stock",
          "agro_products.provider_id"
        );

      if (providerId != null) {
        cartQuery = cartQuery.where("agro_products.provider_id", Number(providerId));
      }

      const cart = await cartQuery;

      if (!cart.length) {
        const msg =
          providerId != null ? "No items from this shop in cart" : "Cart is empty";
        throw new Error(msg);
      }

      for (const item of cart) {
        if (item.qty > item.stock) {
          throw new Error(
            `Insufficient stock for ${item.name}. Available: ${item.stock}`
          );
        }
      }

      const total = cart.reduce(
        (sum: number, item: { price: string; qty: number }) =>
          sum + Number(item.price) * item.qty,
        0
      );

      const [order] = await trx("orders")
        .insert({
          user_id: userId,
          total,
          status: "pending",
          payment_ref: null,
          payment_status: "pending",
        })
        .returning("*");

      for (const item of cart) {
        await trx("order_items").insert({
          order_id: order.id,
          product_id: item.product_id,
          qty: item.qty,
          price: item.price,
        });
        await trx("agro_products")
          .where("id", item.product_id)
          .decrement("quantity", item.qty);
      }

      // Build shop_orders: group by provider_id
      const byProvider = new Map<
        number,
        { subtotal: number; productTotal: number }
      >();

      for (const item of cart) {
        const provider = Number(item.provider_id);
        const lineTotal = Number(item.price) * item.qty;
        const agg =
          byProvider.get(provider) || { subtotal: 0, productTotal: 0 };
        agg.subtotal += lineTotal;
        agg.productTotal += lineTotal;
        byProvider.set(provider, agg);
      }

      for (const [provId, agg] of byProvider.entries()) {
        const commissionAmount = calculateCommission(agg.subtotal);
        const shopEarnings = +(agg.subtotal - commissionAmount).toFixed(2);

        await trx("shop_orders").insert({
          order_id: order.id,
          provider_id: provId,
          subtotal: agg.subtotal,
          commission_amount: commissionAmount,
          shop_earnings: shopEarnings,
          status: "pending",
          escrow_status: "holding",
        });
      }

      const cartIds = cart.map((c: { cart_id: number }) => c.cart_id);
      await trx("cart").whereIn("id", cartIds).del();

      return order as CreatedOrder;
    });
  }
}

