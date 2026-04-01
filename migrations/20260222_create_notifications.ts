import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('notifications', (table) => {
    // Add new fields that weren't in the original table
    table.string('title').nullable();
    table.text('message').nullable();
    table.jsonb('data').nullable(); // Store related entity data
    table.boolean('read').defaultTo(false);
    table.string('action_url').nullable(); // Link to related resource
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Add indexes for performance
    table.index('read');
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('notifications', (table) => {
    table.dropColumn('title');
    table.dropColumn('message');
    table.dropColumn('data');
    table.dropColumn('read');
    table.dropColumn('action_url');
    table.dropColumn('created_at');
    table.dropColumn('updated_at');
  });
}