import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // shop_orders: split master order per agrovet (provider)
  await knex.schema.createTable("shop_orders", (table) => {
    table.increments("id").primary();
    table
      .integer("order_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("orders")
      .onDelete("CASCADE");
    table
      .integer("provider_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("providers")
      .onDelete("CASCADE"); // agrovet shop
    table.decimal("subtotal", 12, 2).notNullable();
    table.decimal("commission_amount", 12, 2).notNullable();
    table.decimal("shop_earnings", 12, 2).notNullable();
    table.string("status", 20).notNullable().defaultTo("pending");
    // For escrow model
    table.string("escrow_status", 20).notNullable().defaultTo("holding"); // holding | released | refunded
    table.timestamp("created_at").defaultTo(knex.fn.now());

    table.index(["order_id"]);
    table.index(["provider_id"]);
    table.index(["escrow_status"]);
  });

  // payments: record M-Pesa STK results
  await knex.schema.createTable("payments", (table) => {
    table.increments("id").primary();
    table
      .integer("order_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("orders")
      .onDelete("CASCADE");
    table.string("mpesa_receipt", 100).notNullable();
    table.string("phone", 20).notNullable();
    table.decimal("amount", 12, 2).notNullable();
    table.string("status", 20).notNullable(); // pending | success | failed
    table.timestamp("created_at").defaultTo(knex.fn.now());

    table.index(["order_id"]);
    table.index(["mpesa_receipt"]);
  });

  // wallets: platform, shop, escrow
  await knex.schema.createTable("wallets", (table) => {
    table.increments("id").primary();
    table
      .integer("user_id")
      .unsigned()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL"); // null for platform/escrow wallets
    table.string("type", 20).notNullable(); // platform | shop | escrow
    table.decimal("balance", 12, 2).notNullable().defaultTo(0);
    table.timestamp("created_at").defaultTo(knex.fn.now());

    table.index(["user_id"]);
    table.index(["type"]);
  });

  // wallet_transactions: immutable financial log
  await knex.schema.createTable("wallet_transactions", (table) => {
    table.increments("id").primary();
    table
      .integer("wallet_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("wallets")
      .onDelete("CASCADE");
    table.decimal("amount", 12, 2).notNullable();
    table.string("type", 20).notNullable(); // credit | debit
    table.string("reference", 150).notNullable(); // e.g. ORDER#1, WITHDRAWAL#5
    table.timestamp("created_at").defaultTo(knex.fn.now());

    table.index(["wallet_id"]);
    table.index(["type"]);
  });

  // withdrawals: shop cash-out via B2C
  await knex.schema.createTable("withdrawals", (table) => {
    table.increments("id").primary();
    table
      .integer("provider_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("providers")
      .onDelete("CASCADE"); // agrovet shop
    table.decimal("amount", 12, 2).notNullable();
    table
      .string("status", 20)
      .notNullable()
      .defaultTo("pending"); // pending | approved | paid | rejected
    table.timestamp("requested_at").defaultTo(knex.fn.now());
    table.timestamp("processed_at");

    table.index(["provider_id"]);
    table.index(["status"]);
  });

  // refunds: per shop_order
  await knex.schema.createTable("refunds", (table) => {
    table.increments("id").primary();
    table
      .integer("shop_order_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("shop_orders")
      .onDelete("CASCADE");
    table.decimal("amount", 12, 2).notNullable();
    table.text("reason").notNullable();
    table
      .string("status", 20)
      .notNullable()
      .defaultTo("pending"); // pending | approved | rejected | completed
    table.timestamp("created_at").defaultTo(knex.fn.now());

    table.index(["shop_order_id"]);
    table.index(["status"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("refunds");
  await knex.schema.dropTableIfExists("withdrawals");
  await knex.schema.dropTableIfExists("wallet_transactions");
  await knex.schema.dropTableIfExists("wallets");
  await knex.schema.dropTableIfExists("payments");
  await knex.schema.dropTableIfExists("shop_orders");
}

