import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('animals', (table) => {
    table.string('reg_no').unique();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('animals', (table) => {
    table.dropColumn('reg_no');
  });
}
