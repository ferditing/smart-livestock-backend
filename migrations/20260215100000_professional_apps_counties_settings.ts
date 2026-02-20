import { Knex } from 'knex';

const KENYA_COUNTIES = [
  'BARINGO', 'BOMET', 'BUNGOMA', 'BUSIA', 'ELGEYO-MARAKWET', 'EMBU', 'GARISSA',
  'HOMABAY', 'ISIOLO', 'KAJIADO', 'KAKAMEGA', 'KERICHO', 'KIAMBU', 'KILIFI',
  'KIRINYAGA', 'KISII', 'KISUMU', 'KITUI', 'KWALE', 'LAIKIPIA', 'LAMU',
  'MACHAKOS', 'MAKUENI', 'MANDERA', 'MARSABIT', 'MERU', 'MIGORI', 'MOMBASA',
  'MURANG\'A', 'NAIROBI', 'NAKURU', 'NANDI', 'NAROK', 'NYAMIRA', 'NYANDARUA',
  'NYERI', 'SAMBURU', 'SIAYA', 'TAITA-TAVETA', 'TANA RIVER', 'THARAKA-NITHI',
  'TRANS NZOIA', 'TURKANA', 'UASIN GISHU', 'VIHIGA', 'WAJIR', 'WEST POKOT'
];

export async function up(knex: Knex): Promise<void> {
  // Counties reference table (Kenya 47 counties)
  if (!(await knex.schema.hasTable('counties'))) {
    await knex.schema.createTable('counties', t => {
      t.increments('id').primary();
      t.string('name').notNullable().unique();
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
    for (const name of KENYA_COUNTIES) {
      await knex('counties').insert({ name });
    }
  }

  // Admin settings (outbreak, notifications, etc.)
  if (!(await knex.schema.hasTable('admin_settings'))) {
    await knex.schema.createTable('admin_settings', t => {
      t.increments('id').primary();
      t.string('key').notNullable().unique();
      t.jsonb('value').nullable();
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    });
    await knex('admin_settings').insert([
      { key: 'outbreak_alert_threshold', value: JSON.stringify(5) },
      { key: 'license_renewal_reminder_days', value: JSON.stringify(30) },
      { key: 'email_on_approval', value: JSON.stringify(true) },
    ]);
  }

  // License expiry and renewal tracking on providers
  if (!(await knex.schema.hasColumn('providers', 'license_expiry'))) {
    await knex.schema.alterTable('providers', t => {
      t.date('license_expiry').nullable();
      t.timestamp('renewal_reminder_sent_at').nullable();
    });
  }

  // Documents verified flag on professional_applications
  if (await knex.schema.hasTable('professional_applications')) {
    if (!(await knex.schema.hasColumn('professional_applications', 'documents_verified_at'))) {
      await knex.schema.alterTable('professional_applications', t => {
        t.timestamp('documents_verified_at').nullable();
        t.integer('documents_verified_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable();
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('admin_settings');
  await knex.schema.dropTableIfExists('counties');
  if (await knex.schema.hasColumn('providers', 'license_expiry')) {
    await knex.schema.alterTable('providers', t => {
      t.dropColumn('license_expiry');
      t.dropColumn('renewal_reminder_sent_at');
    });
  }
  if (await knex.schema.hasTable('professional_applications')) {
    if (await knex.schema.hasColumn('professional_applications', 'documents_verified_at')) {
      await knex.schema.alterTable('professional_applications', t => {
        t.dropColumn('documents_verified_at');
        t.dropColumn('documents_verified_by');
      });
    }
  }
}
