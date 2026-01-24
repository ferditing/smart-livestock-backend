import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    const has = await knex.schema.hasColumn('follow_ups', 'vet_id');
    if (!has) {
        await knex.schema.alterTable('follow_ups', (t) => {
            t.integer('vet_id').references('id').inTable('users').onDelete('SET NULL');
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    const has = await knex.schema.hasColumn('follow_ups', 'vet_id');
    if (has) {
        await knex.schema.alterTable('follow_ups', (t) => {
            t.dropColumn('vet_id');
        });
    }
}
