import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('clinical_records', (table) => {
    table.increments('id').primary();
    table.integer('animal_id').unsigned().notNullable().references('id').inTable('animals').onDelete('CASCADE');
    table.integer('vet_id').unsigned().notNullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('disease_id').unsigned().references('id').inTable('diseases').onDelete('SET NULL');
    table.string('ml_diagnosis').notNullable();
    table.decimal('ml_confidence', 5, 2);
    table.string('vet_diagnosis');
    table.enum('status', ['pending', 'under_treatment', 'recovered', 'deceased']).defaultTo('pending');
    table.text('notes');
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('clinical_records');
}