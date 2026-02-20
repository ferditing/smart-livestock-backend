import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('verified_documents', (t) => {
    t.increments('id').primary();
    t.integer('report_id').unsigned().notNullable().references('id').inTable('symptom_reports').onDelete('CASCADE');
    t.integer('generated_by').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.timestamp('generated_at').defaultTo(knex.fn.now());
    t.text('prescription_notes').nullable();
    t.text('recommendations').nullable();
    t.string('status', 20).notNullable().defaultTo('verified');
  });
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_verified_documents_report_id ON verified_documents (report_id);');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_verified_documents_generated_at ON verified_documents (generated_at);');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('verified_documents');
}
