import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import pg from 'pg';
import { closeDb, initDb } from '../server/db.js';

const { Pool } = pg;
const sourcePath = path.resolve(process.env.UTANG_DB_PATH || 'data/utang.sqlite');
const tables = ['auth_users', 'people', 'debts', 'payments', 'api_idempotency', 'auth_sessions'];
const accountTables = new Set(['people', 'debts', 'payments', 'api_idempotency']);

if (!process.env.DATABASE_URL) {
  throw new Error('Set DATABASE_URL to the destination PostgreSQL database before importing.');
}
if (!fs.existsSync(sourcePath)) {
  throw new Error(`SQLite source database does not exist: ${sourcePath}`);
}

await initDb();
await closeDb();
const SQL = await initSqlJs();
const source = new SQL.Database(fs.readFileSync(sourcePath));
const target = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

const readRows = (table) => {
  const statement = source.prepare(`SELECT * FROM ${table}`);
  const rows = [];
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
};

const sourceRows = Object.fromEntries(tables.map((table) => [table, readRows(table)]));
const importAccountId = sourceRows.auth_users[0]?.id;
if (
  importAccountId === undefined &&
  [...accountTables].some((table) => sourceRows[table].length > 0)
) {
  throw new Error('The SQLite database contains ledger data but no account to own it.');
}
const client = await target.connect();

try {
  await client.query('BEGIN');
  await client.query("SELECT set_config('app.maintenance', 'on', true)");
  for (const table of tables) {
    const { rows } = await client.query(`SELECT COUNT(*)::INTEGER AS count FROM ${table}`);
    if (rows[0].count !== 0) {
      throw new Error(`Destination table "${table}" is not empty. Import stopped without changing it.`);
    }
  }

  for (const table of tables) {
    for (const row of sourceRows[table]) {
      const columns = Object.keys(row);
      const values = columns.map((column) => row[column]);
      if (accountTables.has(table)) {
        columns.push('account_id');
        values.push(row.account_id ?? importAccountId);
      }
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
      await client.query(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        values
      );
    }
  }

  for (const table of ['people', 'debts', 'payments']) {
    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('${table}', 'id'),
        COALESCE((SELECT MAX(id) FROM ${table}), 1),
        EXISTS (SELECT 1 FROM ${table})
      )
    `);
  }

  await client.query('COMMIT');
  console.log('SQLite data imported successfully:', Object.fromEntries(
    tables.map((table) => [table, sourceRows[table].length])
  ));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await target.end();
  source.close();
}
