const TOKEN_KEY = 'pautangtrack:auth-token';
const USER_KEY = 'pautangtrack:auth-user';
const LEGACY_CREDENTIAL_KEY = 'pautangtrack:offline-credential';

function browserIsOnline() {
  return typeof navigator === 'undefined' || navigator.onLine;
}

function storeSession(result) {
  localStorage.setItem(TOKEN_KEY, result.token);
  localStorage.setItem(USER_KEY, JSON.stringify(result.user));
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
  localStorage.removeItem(LEGACY_CREDENTIAL_KEY);
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

export async function restoreAuthState() {
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
  } else if (token && savedUser && !browserIsOnline()) {
    return { session: { user: savedUser }, configured: true };
  }

  if (browserIsOnline()) {
    const response = await fetch('/api/auth/status');
    const result = await readJsonResponse(response);
    return { session: null, configured: result.configured };
  }

  return { session: null, configured: false };
}

export async function authenticate(mode, emailInput, password) {
  const email = emailInput.trim().toLowerCase();
  if (!browserIsOnline()) {
    throw new Error('Sign-in and account creation require an internet connection.');
  }

  const result = await postCredentials(
    mode === 'signup' ? '/api/auth/signup' : '/api/auth/login',
    email,
    password
  );
  storeSession(result);
  return { user: result.user };
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
