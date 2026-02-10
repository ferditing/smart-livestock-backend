import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add farmer_location geography column to appointments table
  await knex.raw(`ALTER TABLE appointments ADD COLUMN farmer_location geography(Point,4326);`);
  
  // Add index for faster geospatial queries
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_appointments_farmer_location_gist ON appointments USING GIST (farmer_location);`);
}

export async function down(knex: Knex): Promise<void> {
  // Drop the index first
  await knex.raw(`DROP INDEX IF EXISTS idx_appointments_farmer_location_gist;`);
  
  // Drop the column
  await knex.raw(`ALTER TABLE appointments DROP COLUMN IF EXISTS farmer_location;`);
}
