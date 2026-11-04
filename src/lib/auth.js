const TOKEN_KEY = 'pautangtrack:auth-token';
const USER_KEY = 'pautangtrack:auth-user';
const ACCOUNTS_KEY = 'pautangtrack:local-accounts';
const PBKDF2_ITERATIONS = 120000;

function browserIsOnline() {
  return typeof navigator === 'undefined' || navigator.onLine;
}

function readAccounts() {
  const value = localStorage.getItem(ACCOUNTS_KEY);
  if (value) return JSON.parse(value);
  const legacyValue = localStorage.getItem('pautangtrack:offline-credential');
  if (!legacyValue) return [];

  const legacyCredential = JSON.parse(legacyValue);
  const accounts = [{
    email: legacyCredential.email,
    salt: legacyCredential.salt,
    verifier: legacyCredential.verifier
  }];
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  localStorage.removeItem('pautangtrack:offline-credential');
  return accounts;
}

function encodeBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function decodeBase64(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function deriveVerifier(password, salt) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Local sign-in is unavailable in this browser. Use HTTPS or localhost.');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  return crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt,
    iterations: PBKDF2_ITERATIONS
  }, key, 256);
}

function storeSession(user) {
  localStorage.setItem(TOKEN_KEY, crypto.randomUUID());
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function cachedUser() {
  const value = localStorage.getItem(USER_KEY);
  return value ? JSON.parse(value) : null;
}

export function getCurrentUser() {
  return cachedUser();
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('pautangtrack:offline-credential');
}

function hasLocalSession() {
  return localStorage.getItem(TOKEN_KEY);
}

export async function restoreAuthState() {
  const session = cachedUser();
  if (hasLocalSession() && session) {
    return { session: { user: session }, configured: readAccounts().length > 0 };
  }

  clearSession();
  return { session: null, configured: readAccounts().length > 0 };
}

export async function authenticate(mode, emailInput, password) {
  if (!browserIsOnline()) {
    throw new Error('Sign-in and account creation require an internet connection.');
  }

  const email = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('Enter a valid email address.');
  }
  const accounts = readAccounts();
  const existing = accounts.find((account) => account.email === email);

  if (mode === 'signup') {
    if (existing) throw new Error('An account with this email already exists on this device. Please sign in.');
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      throw new Error('Password must be between 8 and 128 characters.');
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const verifier = await deriveVerifier(password, salt);
    accounts.push({
      email,
      salt: encodeBase64(salt),
      verifier: encodeBase64(verifier)
    });
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } else {
    if (!existing) throw new Error('Email or password is incorrect.');
    const verifier = await deriveVerifier(password, decodeBase64(existing.salt));
    const candidate = new Uint8Array(verifier);
    const saved = decodeBase64(existing.verifier);
    if (candidate.length !== saved.length || !candidate.every((value, index) => value === saved[index])) {
      throw new Error('Email or password is incorrect.');
    }
  }

  const user = { email };
  storeSession(user);
  return { user };
}

export async function signOut() {
  clearSession();
}
