import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("orders", (table) => {
    // Track whether the order is paid via M-Pesa
    table
      .string("payment_status", 20)
      .notNullable()
      .defaultTo("pending"); // pending | paid | failed | refunded
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("orders", (table) => {
    table.dropColumn("payment_status");
  });
}

