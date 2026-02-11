import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add columns to store canonical animal type and symptoms
  await knex.schema.table('symptom_reports', t => {
    t.string('animal_type').nullable(); // canonical animal: cow, goat, sheep
    t.specificType('canonical_symptoms', 'text[]').nullable(); // array of canonical symptom names
  });
}

export async function down(knex: Knex) {
  await knex.schema.table('symptom_reports', t => {
    t.dropColumn('animal_type');
    t.dropColumn('canonical_symptoms');
  });
}
