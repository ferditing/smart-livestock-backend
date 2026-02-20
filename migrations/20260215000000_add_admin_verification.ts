import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('providers', 'verification_status'))) {
    await knex.schema.alterTable('providers', t => {
      t.string('verification_status').defaultTo('pending');
      t.timestamp('verified_at').nullable();
      t.string('license_number').nullable();
      t.string('verification_badge').nullable();
      t.text('rejection_reason').nullable();
      t.integer('verified_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable();
    });
  }

  if (!(await knex.schema.hasTable('professional_applications'))) {
    await knex.schema.createTable('professional_applications', t => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.integer('provider_id').unsigned().references('id').inTable('providers').onDelete('SET NULL').nullable();
      t.string('application_type').notNullable();
      t.string('status').notNullable().defaultTo('pending');
      t.jsonb('documents').nullable();
      t.text('rejection_reason').nullable();
      t.integer('reviewed_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable();
      t.timestamp('reviewed_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasColumn('users', 'suspended'))) {
    await knex.schema.alterTable('users', t => {
      t.boolean('suspended').defaultTo(false);
      t.timestamp('suspended_at').nullable();
      t.integer('suspended_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('professional_applications');

  await knex.schema.alterTable('providers', t => {
    if (knex.client.config.client !== 'sqlite3') {
      t.dropColumn('verification_status');
      t.dropColumn('verified_at');
      t.dropColumn('license_number');
      t.dropColumn('verification_badge');
      t.dropColumn('rejection_reason');
      t.dropColumn('verified_by');
    }
  });

  await knex.schema.alterTable('users', t => {
    if (knex.client.config.client !== 'sqlite3') {
      t.dropColumn('suspended');
      t.dropColumn('suspended_at');
      t.dropColumn('suspended_by');
    }
  });
}
