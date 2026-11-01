const TOKEN_KEY = 'pautangtrack:auth-token';
const USER_KEY = 'pautangtrack:auth-user';
const CREDENTIAL_KEY = 'pautangtrack:offline-credential';
const PBKDF2_ITERATIONS = 120000;

function browserIsOnline() {
  return typeof navigator === 'undefined' || navigator.onLine;
}

function encodeBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function decodeBase64(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function deriveVerifier(password, salt) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure offline sign-in is unavailable in this browser. Use HTTPS or localhost.');
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

async function saveOfflineCredential(email, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const verifier = await deriveVerifier(password, salt);
  localStorage.setItem(CREDENTIAL_KEY, JSON.stringify({
    email,
    salt: encodeBase64(salt),
    verifier: encodeBase64(verifier)
  }));
}

function readOfflineCredential() {
  const value = localStorage.getItem(CREDENTIAL_KEY);
  return value ? JSON.parse(value) : null;
}

function storeSession(result) {
  localStorage.setItem(TOKEN_KEY, result.token);
  localStorage.setItem(USER_KEY, JSON.stringify(result.user));
}

function cachedUser() {
  const value = localStorage.getItem(USER_KEY);
  return value ? JSON.parse(value) : null;
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function readJsonResponse(response) {
  const body = await response.text();
  let result;
  try {
    result = body ? JSON.parse(body) : null;
  } catch {
    throw new Error(`The server returned an invalid response (${response.status}). Restart the app and try again.`);
  }
  if (!result) {
    throw new Error(`The server returned an empty response (${response.status}). Restart the app and try again.`);
  }
  if (!response.ok) throw new Error(result.error || 'Authentication failed.');
  return result;
}

async function postCredentials(endpoint, email, password) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return readJsonResponse(response);
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function hasServerSession() {
  return Boolean(getAccessToken());
}

export function getAuthHeaders() {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function canSignInOffline() {
  return Boolean(readOfflineCredential());
}

export async function restoreAuthState() {
  let credential = readOfflineCredential();
  const token = getAccessToken();
  const savedUser = cachedUser();

  if (token && browserIsOnline()) {
    try {
      const response = await fetch('/api/auth/session', { headers: getAuthHeaders() });
      if (response.ok) {
        const result = await readJsonResponse(response);
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));
        return { session: { user: result.user }, configured: true };
      }
      if (response.status !== 401) {
        throw new Error('Could not verify your account session.');
      }
      clearSession();
    } catch (error) {
      if (error instanceof TypeError && savedUser) {
        return { session: { user: savedUser }, configured: true };
      }
      throw error;
    }
  } else if (token && savedUser) {
    return { session: { user: savedUser }, configured: true };
  }

  if (browserIsOnline()) {
    try {
      const response = await fetch('/api/auth/status');
      const result = await readJsonResponse(response);
      return { session: null, configured: result.configured || Boolean(credential) };
    } catch (error) {
      if (!(error instanceof TypeError) || !credential) throw error;
    }
  }

  credential = readOfflineCredential();
  return { session: null, configured: Boolean(credential) };
}

export async function authenticate(mode, emailInput, password) {
  const email = emailInput.trim().toLowerCase();
  if (mode === 'signup' && !browserIsOnline()) {
    throw new Error('Creating your account requires an internet connection.');
  }

  if (browserIsOnline()) {
    let result;
    try {
      result = await postCredentials(
        mode === 'signup' ? '/api/auth/signup' : '/api/auth/login',
        email,
        password
      );
    } catch (error) {
      if (!(error instanceof TypeError) || mode !== 'login') throw error;
      return authenticateOffline(email, password);
    }
    await saveOfflineCredential(result.user.email, password);
    storeSession(result);
    return { user: result.user };
  }

  return authenticateOffline(email, password);
}

async function authenticateOffline(email, password) {
  const credential = readOfflineCredential();
  if (!credential || credential.email !== email) {
    throw new Error('Offline sign-in is available only on a device where you have signed in before.');
  }
  const verifier = await deriveVerifier(password, decodeBase64(credential.salt));
  const savedVerifier = decodeBase64(credential.verifier);
  const candidateBytes = new Uint8Array(verifier);
  if (candidateBytes.length !== savedVerifier.length
    || !candidateBytes.every((value, index) => value === savedVerifier[index])) {
    throw new Error('Email or password is incorrect.');
  }
  return { user: { email: credential.email }, offline: true };
}

export async function signOut() {
  const token = getAccessToken();
  let logoutError;
  if (token && browserIsOnline()) {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        try {
          const result = await readJsonResponse(response);
          logoutError = new Error(result.error || 'Could not end the server session.');
        } catch (error) {
          logoutError = error;
        }
      }
    } catch (error) {
      logoutError = error;
    }
  }
  clearSession();
  if (logoutError) throw logoutError;
}
