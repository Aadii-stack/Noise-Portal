import pg from 'pg';

const { Pool } = pg;
let pool = null;

export function initDatabase() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
  });

  return pool;
}

export function getDatabase() {
  return pool;
}
