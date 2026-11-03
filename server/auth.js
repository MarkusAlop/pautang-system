import { promisify } from 'util';
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from 'crypto';
import { claimUnownedRecords, queryOne, run, runWithAccount } from './db.js';

const scrypt = promisify(scryptCallback);
const SESSION_LIFETIME_DAYS = 30;
const PASSWORD_LENGTH = 64;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function getToken(req) {
  const authorization = req.get('Authorization') || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

async function hashPassword(password, salt) {
  return (await scrypt(password, salt, PASSWORD_LENGTH)).toString('hex');
}

async function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
  await run(`
    INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `, [hashToken(token), userId, now.toISOString(), expiresAt.toISOString()]);
  return token;
}

async function findSession(req) {
  const token = getToken(req);
  if (!token) return null;
  return queryOne(`
    SELECT auth_users.id, auth_users.email
    FROM auth_sessions
    JOIN auth_users ON auth_users.id = auth_sessions.user_id
    WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?
  `, [hashToken(token), new Date().toISOString()]);
}

function validEmail(email) {
  return typeof email === 'string'
    && email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function handleUnexpected(error, res) {
  if (error.code === '23505') {
    return res.status(409).json({ error: 'An account already exists. Please sign in.' });
  }
  console.error('Authentication request failed:', error);
  return res.status(500).json({ error: 'Could not complete the authentication request.' });
}

export function setupAuthRoutes(router) {
  router.get('/api/auth/status', async (_req, res) => {
    res.json({ configured: Boolean(await queryOne('SELECT id FROM auth_users LIMIT 1')) });
  });

  router.post('/api/auth/signup', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body?.password;

    if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    }
    try {
      const salt = randomBytes(16).toString('hex');
      const passwordHash = await hashPassword(password, salt);
      const user = await queryOne(`
        INSERT INTO auth_users (email, password_hash, password_salt, created_at)
        VALUES (?, ?, ?, ?)
        RETURNING id
      `, [email, passwordHash, salt, new Date().toISOString()]);
      await claimUnownedRecords(user.id);
      const token = await createSession(user.id);
      return res.status(201).json({ token, user: { email } });
    } catch (error) {
      return handleUnexpected(error, res);
    }
  });

  router.post('/api/auth/login', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body?.password;
    if (!validEmail(email) || typeof password !== 'string') {
      return res.status(400).json({ error: 'Enter your email and password.' });
    }

    try {
      const user = await queryOne(`
        SELECT id, email, password_hash, password_salt
        FROM auth_users
        WHERE email = ?
      `, [email]);
      if (!user) return res.status(401).json({ error: 'Email or password is incorrect.' });

      const candidate = Buffer.from(await hashPassword(password, user.password_salt), 'hex');
      const saved = Buffer.from(user.password_hash, 'hex');
      if (candidate.length !== saved.length || !timingSafeEqual(candidate, saved)) {
        return res.status(401).json({ error: 'Email or password is incorrect.' });
      }

      const token = await createSession(user.id);
      return res.json({ token, user: { email: user.email } });
    } catch (error) {
      return handleUnexpected(error, res);
    }
  });

  router.get('/api/auth/session', async (req, res) => {
    const user = await findSession(req);
    if (!user) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    return res.json({ user: { email: user.email } });
  });

  router.post('/api/auth/logout', async (req, res) => {
    const token = getToken(req);
    if (token) await run('DELETE FROM auth_sessions WHERE token_hash = ?', [hashToken(token)]);
    return res.status(204).end();
  });
}

export async function requireAuthentication(req, res, next) {
  try {
    const user = await findSession(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to access your ledger.' });
    req.authUser = user;
    return runWithAccount(user.id, next);
  } catch (error) {
    console.error('Authentication check failed:', error);
    return res.status(500).json({ error: 'Could not verify your session.' });
  }
}
