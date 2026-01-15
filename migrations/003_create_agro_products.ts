import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('agro_products', (t) => {
    t.increments('id').primary();
    t.integer('provider_id').unsigned().references('id').inTable('providers').onDelete('SET NULL');
    t.string('name').notNullable();
    t.decimal('price');
    t.text('description');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('agro_products');
}
