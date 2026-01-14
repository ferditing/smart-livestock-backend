import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // users
  await knex.schema.createTable('users', t => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.string('email').notNullable().unique();
    t.string('phone');
    t.string('password_hash').notNullable();
    t.enu('role', ['farmer','vet','agrovet','admin']).notNullable().defaultTo('farmer');
    t.jsonb('profile_meta');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // animals
  await knex.schema.createTable('animals', t => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('species').notNullable();
    t.string('breed');
    t.integer('age');
    t.decimal('weight');
    t.string('tag_id');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // symptom_reports
  await knex.schema.createTable('symptom_reports', t => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('animal_id').unsigned().references('id').inTable('animals').onDelete('SET NULL');
    t.text('symptom_text');
    t.specificType('images', 'text[]');
    t.string('status').notNullable().defaultTo('received');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // diagnoses
  await knex.schema.createTable('diagnoses', t => {
    t.increments('id').primary();
    t.integer('report_id').unsigned().notNullable().references('id').inTable('symptom_reports').onDelete('CASCADE');
    t.string('predicted_label').notNullable();
    t.decimal('confidence');
    t.jsonb('recommended_actions');
    t.integer('model_version').unsigned();
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // prediction_logs
  await knex.schema.createTable('prediction_logs', t => {
    t.increments('id').primary();
    t.integer('report_id').unsigned().references('id').inTable('symptom_reports').onDelete('SET NULL');
    t.jsonb('features');
    t.jsonb('raw_output');
    t.integer('model_version').unsigned();
    t.timestamp('run_at').defaultTo(knex.fn.now());
  });

  // providers
  await knex.schema.createTable('providers', t => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('name').notNullable();
    t.enu('provider_type', ['vet','agrovet']).notNullable();
    t.jsonb('services');
    t.jsonb('availability');
    t.jsonb('contact');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // appointments
  await knex.schema.createTable('appointments', t => {
    t.increments('id').primary();
    t.integer('report_id').unsigned().references('id').inTable('symptom_reports').onDelete('SET NULL');
    t.integer('provider_id').unsigned().references('id').inTable('providers').onDelete('SET NULL');
    t.integer('farmer_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('scheduled_at');
    t.string('status').defaultTo('pending');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // threads & messages
  await knex.schema.createTable('threads', t => {
    t.increments('id').primary();
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('messages', t => {
    t.increments('id').primary();
    t.integer('thread_id').unsigned().references('id').inTable('threads').onDelete('CASCADE');
    t.integer('sender_id').unsigned().references('id').inTable('users');
    t.integer('receiver_id').unsigned().references('id').inTable('users');
    t.text('body');
    t.specificType('attachments', 'text[]');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // model_versions
  await knex.schema.createTable('model_versions', t => {
    t.increments('id').primary();
    t.string('version_tag').notNullable();
    t.string('artifact_path').notNullable();
    t.date('trained_on_date');
    t.jsonb('metrics');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // feedback_labels
  await knex.schema.createTable('feedback_labels', t => {
    t.increments('id').primary();
    t.integer('report_id').unsigned().references('id').inTable('symptom_reports').onDelete('CASCADE');
    t.integer('vet_id').unsigned().references('id').inTable('users');
    t.string('confirmed_label');
    t.text('notes');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // notifications & audit
  await knex.schema.createTable('notifications', t => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().references('id').inTable('users');
    t.string('type');
    t.jsonb('payload');
    t.timestamp('sent_at').defaultTo(knex.fn.now());
    t.timestamp('read_at');
  });

  await knex.schema.createTable('audit_logs', t => {
    t.increments('id').primary();
    t.integer('actor_id').unsigned().references('id').inTable('users');
    t.string('action');
    t.integer('target_id');
    t.jsonb('details');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // add geography columns (so ST_DWithin uses meters)
  await knex.raw(`ALTER TABLE providers ADD COLUMN location geography(Point,4326);`);
  await knex.raw(`ALTER TABLE symptom_reports ADD COLUMN location geography(Point,4326);`);

  // indexes
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_providers_location_gist ON providers USING GIST (location);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_symptom_reports_location_gist ON symptom_reports USING GIST (location);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_symptom_reports_created_at ON symptom_reports (created_at);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_diagnoses_model_version ON diagnoses (model_version);`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('feedback_labels');
  await knex.schema.dropTableIfExists('model_versions');
  await knex.schema.dropTableIfExists('messages');
  await knex.schema.dropTableIfExists('threads');
  await knex.schema.dropTableIfExists('appointments');
  await knex.schema.dropTableIfExists('providers');
  await knex.schema.dropTableIfExists('prediction_logs');
  await knex.schema.dropTableIfExists('diagnoses');
  await knex.schema.dropTableIfExists('symptom_reports');
  await knex.schema.dropTableIfExists('animals');
  await knex.schema.dropTableIfExists('users');
}
