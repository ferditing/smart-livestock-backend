import { Router } from "express";
import db from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { WalletService } from "../services/wallet.service";

const router = Router();

// GET /api/agro/wallet - current agrovet shop wallet + pending escrow summary
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user.role !== "agrovet") {
      return res.status(403).json({ error: "agrovets only" });
    }

    const knex = db; // db is a Knex instance
    const walletService = new WalletService(knex);

    // Shop wallet is tied to the agrovet user account
    const shopWallet = await walletService.getShopWalletForUser(req.user.id);

    // Provider row for this agrovet (shop identity)
    const provider = await db("providers")
      .where({ user_id: req.user.id, provider_type: "agrovet" })
      .first();

    let pendingEscrowEarnings = 0;

    if (provider) {
      const row = await db("shop_orders")
        .where({ provider_id: provider.id, escrow_status: "holding" })
        .sum<{ pending: string | null }>("shop_earnings as pending")
        .first();
      pendingEscrowEarnings = row?.pending ? Number(row.pending) : 0;
    }

    return res.json({
      shopWallet: {
        id: shopWallet.id,
        balance: Number(shopWallet.balance || 0),
        type: shopWallet.type,
      },
      pendingEscrowEarnings,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server error" });
  }
});

export default router;

