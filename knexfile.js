require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

const connection = process.env.DATABASE_URL || {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'smartlivestock',
  port: +(process.env.DB_PORT || 5432),
  ssl: isProduction ? { rejectUnauthorized: false } : false
};

const config = {
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
  pool: { 
    min: isProduction ? 2 : 1,
    max: isProduction ? 10 : 5,
    acquireTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
  }
};

module.exports = config;
