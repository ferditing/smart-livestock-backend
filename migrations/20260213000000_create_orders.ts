import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("orders", (table) => {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.decimal("total", 12, 2).notNullable();
    table
      .enu("status", ["pending", "processing", "shipped", "delivered", "cancelled"])
      .defaultTo("pending")
      .notNullable();
    table.string("payment_ref");
    table.boolean("vet_approved").defaultTo(false);
    table.timestamps(true, true);
    table.index("user_id");
    table.index("status");
  });

  await knex.schema.createTable("order_items", (table) => {
    table.increments("id").primary();
    table.integer("order_id").unsigned().notNullable().references("id").inTable("orders").onDelete("CASCADE");
    table.integer("product_id").unsigned().notNullable().references("id").inTable("agro_products").onDelete("CASCADE");
    table.integer("qty").unsigned().notNullable();
    table.decimal("price", 12, 2).notNullable();
    table.timestamps(true, true);
    table.index("order_id");
    table.index("product_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("order_items");
  await knex.schema.dropTableIfExists("orders");
}
