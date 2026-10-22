const DATABASE_NAME = 'pautangtrack-offline';
const STORE_NAME = 'records';
const DATABASE_VERSION = 1;

let databasePromise;

function getDatabase() {
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error('Offline storage is not available in this browser.'));
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open offline storage.'));
    });
  }

  return databasePromise;
}

export async function offlineGet(key) {
  const database = await getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error || new Error('Could not read offline data.'));
  });
}

export async function offlineSet(key, value) {
  const database = await getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ key, value });
    transaction.oncomplete = () => resolve(value);
    transaction.onerror = () => reject(transaction.error || new Error('Could not save offline data.'));
    transaction.onabort = () => reject(transaction.error || new Error('Offline storage transaction was cancelled.'));
  });
}

export async function offlineRemove(key) {
  const database = await getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not remove offline data.'));
    transaction.onabort = () => reject(transaction.error || new Error('Offline storage transaction was cancelled.'));
  });
}

export async function offlineUpdate(key, updater, fallbackValue) {
  const currentValue = await offlineGet(key);
  return offlineSet(key, updater(currentValue === null ? fallbackValue : currentValue));
}

export async function offlineGetAll() {
  const database = await getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result.map(({ key, value }) => [key, value]));
    request.onerror = () => reject(request.error || new Error('Could not read offline data.'));
  });
}