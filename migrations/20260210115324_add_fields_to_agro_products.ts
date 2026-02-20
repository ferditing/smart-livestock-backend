import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("agro_products", (table) => {
    table.string("company");
    table.integer("quantity").defaultTo(0);
    table.text("usage");
    table.string("image_url");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("agro_products", (table) => {
    table.dropColumn("company");
    table.dropColumn("quantity");
    table.dropColumn("usage");
    table.dropColumn("image_url");
  });
}
