## SmartLivestock Marketplace Wallet & Escrow Architecture

### Overview

SmartLivestock uses a **platform wallet model** with optional **escrow protection**:

- **Farmers** place orders that may contain products from multiple **agrovets**.
- Farmers pay via **M‑Pesa STK Push** to the SmartLivestock Paybill.
- Funds are first associated with an order in the `payments` table.
- Depending on configuration:
  - Funds can be credited directly to **shop** and **platform** wallets, or
  - Held in an **escrow** wallet and released later.

### Core Tables

- `orders` – master order per farmer (existing).
- `order_items` – line items per order (existing).
- `shop_orders` – one row per agrovet shop in a multi‑vendor order:
  - `subtotal`, `commission_amount`, `shop_earnings`, `escrow_status`.
- `payments` – M‑Pesa payment records linked to `orders`.
- `wallets` – logical balances:
  - `type`: `platform | shop | escrow`.
  - `user_id` is `NULL` for platform/escrow, agrovet `users.id` for shop wallets.
- `wallet_transactions` – immutable log of all credits/debits.
- `withdrawals` – shop cash‑out via M‑Pesa B2C.
- `refunds` – per‑`shop_order` refunds from escrow to farmer.

### Commission

- Implemented in `services/commission.service.ts`.
- Fixed **5%** rate:
  - `commission = amount * 0.05`
  - `shop_earnings = amount - commission`

### Order Flow

- Implemented in `services/order.service.ts`:
  - `createOrderFromCart(userId, providerId?)`:
    - Reads the `cart` table for the farmer.
    - Validates stock for each `agro_products` item.
    - Creates a master `orders` row (`status = pending`, `payment_status = pending`).
    - Inserts `order_items` and decrements product stock.
    - Groups items by `provider_id` to create `shop_orders` with:
      - `subtotal`, `commission_amount`, `shop_earnings`, `escrow_status = holding`.
    - Clears processed cart rows in a single transaction.

### Wallet Service

- Implemented in `services/wallet.service.ts`:
  - `getOrCreateWallet(userId, type)` – ensures a wallet row exists.
  - `creditWallet(walletId, amount, reference)` – atomic balance increment + transaction log.
  - `debitWallet(walletId, amount, reference)` – atomic balance decrement with guard:
    - Throws on insufficient balance.
  - Helpers:
    - `getPlatformWallet()` – platform‑level wallet.
    - `getEscrowWallet()` – global escrow wallet.
    - `getShopWalletForUser(userId)` – agrovet shop wallet.

All wallet mutations use **database transactions** to keep balances and `wallet_transactions` in sync.

### Admin Wallet Visibility

- Backend:
  - `GET /admin/providers/:id/wallets` (in `src/admin/admin.routes.ts`):
    - Admin‑only (`authMiddleware` + `requireAdmin`).
    - Resolves `providers.id` → `users.id`.
    - Returns `shop` and `escrow` wallets for that agrovet.
- Frontend:
  - `getProviderWallets(providerId)` in `src/api/admin.api.ts`.
  - `AdminUsers` page (`src/dashboard/admin/usrs.tsx`):
    - In the user details modal, if `role === "agrovet"`:
      - Shows a small **Wallets (shop & escrow)** table with balances in KES.
      - Data is fetched on demand via **Refresh wallets** to avoid unnecessary calls.

### Security & Production Considerations

- All admin routes are protected by:
  - `authMiddleware` (JWT authentication).
  - `requireAdmin` (role check).
- Wallet updates must:
  - Use **database transactions** for balance + log consistency.
  - Never trust client‑supplied totals; always recompute from `orders`/`shop_orders`.
- Sensitive configuration (M‑Pesa credentials, Paybill, B2C shortcodes) should be stored in **environment variables**, not in source code.

### Extensibility

- Escrow release and refund logic can be layered on top of:
  - `shop_orders.escrow_status`,
  - `wallets` and `wallet_transactions`,
  - `withdrawals` and `refunds`.
- Cron‑based auto‑release (e.g. after 48 hours) can use:
  - `shop_orders` where `escrow_status = 'holding'` and `created_at` is older than the threshold.

