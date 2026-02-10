import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('users', t => {
    t.decimal('latitude', 10, 8).nullable();
    t.decimal('longitude', 10, 8).nullable();
    t.string('county').nullable();
    t.string('sub_county').nullable();
    t.string('ward').nullable();
    t.string('locality').nullable();
    t.specificType('location_point', 'geography(Point,4326)').nullable();
  });

  // Create GIST index for geographical queries
  await knex.raw('CREATE INDEX idx_users_location_gist ON users USING GIST (location_point);');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('users', t => {
    t.dropColumn('location_point');
    t.dropColumn('locality');
    t.dropColumn('ward');
    t.dropColumn('sub_county');
    t.dropColumn('county');
    t.dropColumn('longitude');
    t.dropColumn('latitude');
  });
}
