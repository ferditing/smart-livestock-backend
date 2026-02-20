import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("agro_products", (table) => {
    table
      .boolean("vet_verification_requested")
      .notNullable()
      .defaultTo(false);
    table.boolean("vet_verified").notNullable().defaultTo(false);
    table.timestamp("vet_verified_at");
    table
      .integer("vet_verified_by")
      .unsigned()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    table.text("vet_verification_notes");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("agro_products", (table) => {
    table.dropColumn("vet_verification_notes");
    table.dropColumn("vet_verified_by");
    table.dropColumn("vet_verified_at");
    table.dropColumn("vet_verified");
    table.dropColumn("vet_verification_requested");
  });
}

