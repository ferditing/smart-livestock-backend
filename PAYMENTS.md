## SmartLivestock Agro Payments – Current Implementation

This document explains how agro e‑commerce payments are wired today, focusing on:

- How orders are created from a farmer's cart
- How Paystack payment endpoints behave (stubbed for now)
- How to later plug in real Paystack / M‑Pesa integrations without breaking existing flows

---

### 1. Order & Cart Overview

**Tables used:**

- `cart` – farmer's current cart items
- `agro_products` – marketplace products
- `orders` – header for each checkout
- `order_items` – line items belonging to an order

**Key fields on `orders`:**

- `id` – auto‑increment primary key (this is the de‑facto **order number**)
- `user_id` – owner (farmer)
- `total` – numeric total for the whole order
- `status` – `'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'`
- `payment_ref` – free‑form payment reference (used for Paystack)

**Important:**  
The order number is generated automatically by PostgreSQL when inserting into `orders`.  
Payment references are generated in code using a helper:

```ts
function generatePaymentRef(prefix: string = 'SL'): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1e9).toString(36);
  return `${prefix}-${ts}-${rand}`;
}
```

Examples:

- `SL-1739970000000-k3z9w1`
- `PSK-1739970000000-abc123` (Paystack‑style reference)

---

### 2. Checkout Endpoint (Existing)

**Endpoint:**

- `POST /agro/orders/checkout`

**Auth:**

- Requires authenticated user (`authMiddleware`).

**Body:**

```jsonc
{
  "phone": "optional, string",
  "provider_id": 123 // optional, when checking out a single agrovet's items only
}
```

**Behavior:**

1. Loads cart items for the current user, optionally filtered by `provider_id`.
2. Validates:
   - Cart is not empty (or not empty for that provider).
   - Each item has sufficient stock.
3. Computes the total.
4. Inserts a new row into `orders`:

```ts
{
  user_id: req.user.id,
  total,
  status: 'pending',
  payment_ref: null
}
```

5. Inserts corresponding `order_items`, decrements `agro_products.quantity` for each item.
6. Clears the relevant `cart` rows.
7. Returns the newly created `order` row.

This endpoint **creates a real order** and is suitable for cash / M‑Pesa flows where payment is not fully integrated with a gateway yet.

---

### 3. Paystack Endpoints (Stubbed but Functional)

The frontend currently calls the following endpoints via `smartlivestock-frontend/src/api/marketplace.api.ts`:

- `POST /agro/orders/paystack/initialize`
- `POST /agro/orders/paystack/verify`
- `POST /agro/orders/paystack/reinitialize`

They are implemented in `src/agro/orders.routes.ts` and are **gateway stubs** designed to:

- Let the UI flow complete without errors
- Ensure orders are still created and tracked
- Be easy to plug into real Paystack APIs later

#### 3.1 Initialize Paystack Payment

**Route:**

- `POST /agro/orders/paystack/initialize`

**Body:**

```jsonc
{
  "amount": 5000,        // optional, numeric – should roughly match cart total
  "email": "farmer@example.com", // required
  "provider_id": 123     // optional – filter cart to a single agrovet
}
```

**What it does:**

1. Validates `email` and that the user has items in their cart (optionally for `provider_id` only).
2. Validates stock for each item.
3. Computes `total` from the cart and (if `amount` is provided) checks that the difference is small.
4. Generates a Paystack‑style reference:

```ts
const paymentRef = generatePaymentRef('PSK');
```

5. Inserts a new `orders` row:

```ts
{
  user_id: req.user.id,
  total,
  status: 'pending',
  payment_ref: paymentRef
}
```

6. Inserts `order_items`, decrements stock, and clears the relevant `cart` rows.
7. Returns a **mock authorization URL** and reference:

```jsonc
{
  "authorization_url": "about:blank#paystack-mock-PSK-...",
  "reference": "PSK-1739970000000-abc123",
  "order": { /* order row */ }
}
```

The frontend redirects to `authorization_url`. For now this is a placeholder (`about:blank`) and does not actually talk to Paystack – this is intentional so that development and testing can proceed without a live gateway.

**How to plug in real Paystack later:**

- Replace the stub body with a call to Paystack's initialize transaction endpoint.
- Pass `paymentRef` as the `reference` to Paystack so you can match webhooks.
- Keep the `orders` row creation as is (or move it to webhook time, depending on your preferred flow).

#### 3.2 Verify Paystack Payment

**Route:**

- `POST /agro/orders/paystack/verify`

**Body:**

```jsonc
{
  "reference": "PSK-1739970000000-abc123",
  "provider_id": 123 // optional, unused for now
}
```

**What it does:**

1. Looks up an `orders` row by `payment_ref = reference` and `user_id = current user`.
2. If the order is currently `pending`, updates it to `processing`.
3. Returns the updated order.

At the moment, **no external gateway call is made**. This keeps the flow simple and non‑breaking.

To integrate real Paystack verification or webhook handling later:

- Call Paystack's verify transaction API here, or
- Handle Paystack webhooks in a separate route and update order status there.

#### 3.3 Re‑initialize Paystack Payment

**Route:**

- `POST /agro/orders/paystack/reinitialize`

**Body:**

```jsonc
{
  "order_id": 123
}
```

**What it does:**

1. Ensures the order belongs to the current user.
2. Generates a **new** `payment_ref` with `generatePaymentRef('PSK')`.
3. Updates the `orders.payment_ref` field.
4. Returns a new mock `authorization_url` and the updated order:

```jsonc
{
  "authorization_url": "about:blank#paystack-reinit-PSK-...",
  "reference": "PSK-...",
  "order": { /* updated order */ }
}
```

Again, no real call to Paystack is made yet – this is a safe placeholder for future work.

---

### 4. M‑Pesa STK Push (Future)

The frontend currently has a **mock** M‑Pesa path inside `Marketplace.tsx`:

- It simulates an STK push and, on "success", calls `clearCart()` and shows a toast.
- No backend M‑Pesa endpoint is required yet for this mock flow.

**Recommended future endpoints (not implemented yet):**

- `POST /agro/orders/mpesa/stkpush` – initiate STK push and create an order (similar to checkout / Paystack initialize).
- `POST /agro/orders/mpesa/callback` – Safaricom callback URL to update order status once payment is confirmed.

You can mirror the same pattern as the Paystack stub:

1. Create an order from cart.
2. Store an `MPESA-...` style `payment_ref`.
3. Update order status on callback.

---

### 5. Frontend Mapping Summary

From `smartlivestock-frontend/src/api/marketplace.api.ts`:

- `getCart` → `GET /agro/cart`
- `addToCart` → `POST /agro/cart/add`
- `updateCartItem` → `PUT /agro/cart/:id`
- `removeFromCart` → `DELETE /agro/cart/:id`
- `clearCart` → `DELETE /agro/cart`
- `getOrders` → `GET /agro/orders`
- `getOrder` → `GET /agro/orders/:id`
- `checkout` → `POST /agro/orders/checkout`
- `initializePaystackPayment` → `POST /agro/orders/paystack/initialize`
- `verifyPaystackPayment` → `POST /agro/orders/paystack/verify`
- `reinitializePaystackPaymentForOrder` → `POST /agro/orders/paystack/reinitialize`
- `getMarketplaceProducts` → `GET /agro/products`

All of these routes now exist on the backend, with safe defaults:

- **Orders** and **order items** are always created via `/checkout` or `/paystack/initialize`.
- **Payment references** and **order numbers** are generated automatically.
- External gateways (Paystack / M‑Pesa) can be wired in later without breaking the current UI/flows.

