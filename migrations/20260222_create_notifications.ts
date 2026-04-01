import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('notifications', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.string('type').notNullable(); // appointment:booked, order:status, clinical:report, etc.
    table.string('title').notNullable();
    table.text('message').notNullable();
    table.jsonb('data').nullable(); // Store related entity data
    table.boolean('read').defaultTo(false);
    table.string('action_url').nullable(); // Link to related resource
    table.timestamps(true, true);

    // Foreign key
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    // Indexes for performance
    table.index('user_id');
    table.index('read');
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('notifications');
}
