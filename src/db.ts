import knex, { Knex } from 'knex';
const config = require('../knexfile');
const db: Knex = knex(config as Knex.Config);
export default db;
