import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Extend role: convert to varchar + check (Postgres enum alter can be brittle)
  await knex.raw(`
    ALTER TABLE users ALTER COLUMN role TYPE varchar(50) USING role::text;
  `);
  await knex.raw(`
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  `).catch(() => {});
  await knex.raw(`
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('farmer','vet','agrovet','admin','subadmin','secretary','chairman'));
  `);

  // Add staff-specific columns
  if (!(await knex.schema.hasColumn('users', 'assigned_county'))) {
    await knex.schema.alterTable('users', t => {
      t.string('assigned_county').nullable();
    });
  }
  if (!(await knex.schema.hasColumn('users', 'password_reset_token'))) {
    await knex.schema.alterTable('users', t => {
      t.string('password_reset_token', 64).nullable();
      t.timestamp('password_reset_expires_at').nullable();
      t.boolean('must_change_password').defaultTo(false);
    });
  }
  if (!(await knex.schema.hasColumn('users', 'created_by'))) {
    await knex.schema.alterTable('users', t => {
      t.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('users', 'assigned_county')) {
    await knex.schema.alterTable('users', t => t.dropColumn('assigned_county'));
  }
  if (await knex.schema.hasColumn('users', 'password_reset_token')) {
    await knex.schema.alterTable('users', t => {
      t.dropColumn('password_reset_token');
      t.dropColumn('password_reset_expires_at');
      t.dropColumn('must_change_password');
    });
  }
  if (await knex.schema.hasColumn('users', 'created_by')) {
    await knex.schema.alterTable('users', t => t.dropColumn('created_by'));
  }
  // Note: Postgres does not support removing enum values easily; we leave them
}
