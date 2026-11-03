import { AsyncLocalStorage } from 'async_hooks';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});
const accountContext = new AsyncLocalStorage();
const accountTables = ['people', 'debts', 'payments', 'api_idempotency'];

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL connection error:', error);
});

export async function initDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set to connect to PostgreSQL.');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS people (
      id SERIAL PRIMARY KEY,
      account_id INTEGER REFERENCES auth_users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      nickname TEXT,
      relationship TEXT DEFAULT 'Friend',
      phone TEXT,
      facebook TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS debts (
      id SERIAL PRIMARY KEY,
      account_id INTEGER REFERENCES auth_users(id) ON DELETE CASCADE,
      person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      reason TEXT NOT NULL,
      date_incurred TEXT NOT NULL,
      due_date TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      account_id INTEGER REFERENCES auth_users(id) ON DELETE CASCADE,
      debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
      amount DOUBLE PRECISION NOT NULL,
      payment_date TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      reference_no TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_idempotency (
      operation_id TEXT PRIMARY KEY,
      account_id INTEGER REFERENCES auth_users(id) ON DELETE CASCADE,
      status_code INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_debts_person ON debts(person_id);
    CREATE INDEX IF NOT EXISTS idx_payments_debt ON payments(debt_id);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
  `);

  await pool.query(`
    ALTER TABLE auth_users DROP CONSTRAINT IF EXISTS auth_users_id_check;
    CREATE SEQUENCE IF NOT EXISTS auth_users_id_seq;
    ALTER TABLE auth_users ALTER COLUMN id SET DEFAULT nextval('auth_users_id_seq');
    ALTER SEQUENCE auth_users_id_seq OWNED BY auth_users.id;
    SELECT setval(
      'auth_users_id_seq',
      COALESCE((SELECT MAX(id) FROM auth_users), 1),
      EXISTS (SELECT 1 FROM auth_users)
    );
  `);

  for (const table of accountTables) {
    await pool.query(`
      ALTER TABLE ${table}
      ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES auth_users(id) ON DELETE CASCADE
    `);
    await pool.query(`
      UPDATE ${table}
      SET account_id = (SELECT MIN(id) FROM auth_users)
      WHERE account_id IS NULL
        AND EXISTS (SELECT 1 FROM auth_users)
    `);
    await pool.query(`
      ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS account_isolation ON ${table};
      CREATE POLICY account_isolation ON ${table}
        USING (
          account_id = NULLIF(current_setting('app.account_id', true), '')::INTEGER
          OR (
            account_id IS NULL
            AND current_setting('app.claim_unowned', true) = 'on'
          )
          OR current_setting('app.maintenance', true) = 'on'
        )
        WITH CHECK (
          account_id = NULLIF(current_setting('app.account_id', true), '')::INTEGER
          OR current_setting('app.maintenance', true) = 'on'
        );
    `);
  }
}

export function runWithAccount(accountId, callback) {
  return accountContext.run(Number(accountId), callback);
}

async function execute(sql, params) {
  const accountId = accountContext.getStore();
  if (accountId === undefined) {
    return pool.query(sql, params);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.account_id', $1, true)", [String(accountId)]);
    const result = await client.query(sql, params);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function toPostgresPlaceholders(sql) {
  let parameterIndex = 0;
  return sql.replace(/\?/g, () => `$${++parameterIndex}`);
}

function addAccountIdToInsert(sql, params, accountId) {
  const insertPattern = /(INSERT\s+INTO\s+(people|debts|payments|api_idempotency)\s*\()([^)]*)(\)\s*VALUES\s*\()([^)]*)(\))/i;
  const match = insertPattern.exec(sql);
  if (!match || match[3].split(',').some((column) => column.trim() === 'account_id')) {
    return { sql, params };
  }

  return {
    sql: `${sql.slice(0, match.index)}${match[1]}${match[3]}, account_id${match[4]}${match[5]}, ?${match[6]}${sql.slice(match.index + match[0].length)}`,
    params: [...params, accountId]
  };
}

export async function query(sql, params = []) {
  const result = await execute(toPostgresPlaceholders(sql), params);
  return result.rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export async function run(sql, params = []) {
  const accountId = accountContext.getStore();
  if (accountId !== undefined) {
    ({ sql, params } = addAccountIdToInsert(sql, params, accountId));
  }

  const insertHasId = /^\s*INSERT\s+INTO\s+(people|debts|payments)\b/i.test(sql);
  const statement = insertHasId ? `${sql.trim().replace(/;$/, '')} RETURNING id` : sql;
  const result = await execute(toPostgresPlaceholders(statement), params);
  return {
    lastInsertRowid: result.rows[0]?.id,
    changes: result.rowCount
  };
}

export async function claimUnownedRecords(accountId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.account_id', $1, true)", [String(accountId)]);
    await client.query("SELECT set_config('app.claim_unowned', 'on', true)");
    for (const table of accountTables) {
      await client.query(`UPDATE ${table} SET account_id = $1 WHERE account_id IS NULL`, [accountId]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDb() {
  await pool.end();
}
