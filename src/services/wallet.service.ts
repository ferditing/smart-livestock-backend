// services/wallet.service.ts
import { Knex } from "knex";

export type WalletType = "platform" | "shop" | "escrow";

export class WalletService {
  constructor(private knex: Knex) {}

  async getOrCreateWallet(userId: number | null, type: WalletType) {
    let q = this.knex("wallets").where({ type });
    if (userId !== null) q = q.andWhere({ user_id: userId });
    const existing = await q.first();
    if (existing) return existing;

    const [created] = await this.knex("wallets")
      .insert({ user_id: userId, type, balance: 0 })
      .returning("*");
    return created;
  }

  async creditWallet(walletId: number, amount: number, reference: string) {
    await this.knex.transaction(async (trx) => {
      await trx("wallets")
        .where({ id: walletId })
        .increment("balance", amount);
      await trx("wallet_transactions").insert({
        wallet_id: walletId,
        amount,
        type: "credit",
        reference,
      });
    });
  }

  async debitWallet(walletId: number, amount: number, reference: string) {
    await this.knex.transaction(async (trx) => {
      const wallet = await trx("wallets").where({ id: walletId }).first();
      if (!wallet || Number(wallet.balance) < amount) {
        throw new Error("Insufficient wallet balance");
      }
      await trx("wallets")
        .where({ id: walletId })
        .decrement("balance", amount);
      await trx("wallet_transactions").insert({
        wallet_id: walletId,
        amount,
        type: "debit",
        reference,
      });
    });
  }

  async getWalletBalance(walletId: number): Promise<number> {
    const wallet = await this.knex("wallets").where({ id: walletId }).first();
    return wallet ? Number(wallet.balance) : 0;
  }

  async getPlatformWallet() {
    return this.getOrCreateWallet(null, "platform");
  }

  async getEscrowWallet() {
    return this.getOrCreateWallet(null, "escrow");
  }

  async getShopWalletForUser(userId: number) {
    return this.getOrCreateWallet(userId, "shop");
  }
}