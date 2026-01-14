import type { Knex } from 'knex';
import dotenv from 'dotenv';
dotenv.config();

const connection = process.env.DATABASE_URL || {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'smartlivestock',
  port: +(process.env.DB_PORT || 5432)
};

const config: Knex.Config = {
  client: 'pg',
  connection,
  migrations: {
    extension: 'ts',
    directory: './migrations'
  },
  seeds: {
    extension: 'ts',
    directory: './seeds'
  },
  pool: { min: 2, max: 10 }
};

// CommonJS export so Knex CLI (require) works reliably
module.exports = config;
