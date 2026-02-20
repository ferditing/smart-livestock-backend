import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("cart", (table) => {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.integer("product_id").unsigned().notNullable().references("id").inTable("agro_products").onDelete("CASCADE");
    table.integer("qty").unsigned().notNullable().defaultTo(1);
    table.timestamps(true, true);
    
    // Prevent duplicate entries: one user can only have one cart entry per product
    table.unique(["user_id", "product_id"]);
    
    // Indexes for common queries
    table.index("user_id");
    table.index("product_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("cart");
}
