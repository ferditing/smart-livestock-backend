import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("follow_ups", (t) => {
        t.increments("id").primary();
        t.integer("diagnosis_id").references("id").inTable("diagnoses").onDelete("CASCADE");
        t.integer("vet_id").references("id").inTable("users").onDelete("SET NULL");
        t.text("notes");
        t.date("follow_up_date");
        t.boolean("completed").defaultTo(false);
        t.timestamp("created_at").defaultTo(knex.fn.now());
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("follow_ups");
}