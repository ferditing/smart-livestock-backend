import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS postgis;');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS postgis_topology;');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP EXTENSION IF EXISTS postgis_topology;');
  await knex.raw('DROP EXTENSION IF EXISTS postgis;');
}
