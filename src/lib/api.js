import {
  cacheApiResponse,
  getOfflineSnapshot,
  getOfflineResponse,
  getPendingOperationCount,
  isNetworkAvailable,
  queueOfflineRequest,
  syncOfflineQueue
} from './offlineApi.js';

async function request(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();

  if (!isNetworkAvailable()) {
    if (method === 'GET') return getOfflineResponse(endpoint);
    return queueOfflineRequest(endpoint, { ...options, method });
  }

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  let response;
  try {
    response = await fetch(endpoint, config);
  } catch (error) {
    if (method === 'GET') {
      try {
        return await getOfflineResponse(endpoint);
      } catch {
        throw error;
      }
    }
    if (method !== 'GET') return queueOfflineRequest(endpoint, { ...options, method });
    throw error;
  }

  if (!response.ok) {
    let errorMsg = 'An error occurred';
    try {
      const errJson = await response.json();
      errorMsg = errJson.error || errorMsg;
    } catch (e) {
      errorMsg = response.statusText;
    }
    throw new Error(errorMsg);
  }

  // Handle CSV/text responses
  const contentType = response.headers.get('content-type');
  if (contentType && (contentType.includes('text/csv') || contentType.includes('text/plain'))) {
    return response.text();
  }

  const data = await response.json();
  if (method === 'GET') await cacheApiResponse(endpoint, data);
  return data;
}

export const api = {
  // Stats
  getStats: () => request('/api/stats'),

  // Debts
  getDebts: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.type) query.append('type', params.type);
    if (params.status) query.append('status', params.status);
    if (params.person_id) query.append('person_id', params.person_id);
    if (params.search) query.append('search', params.search);
    const qs = query.toString();
    const endpoint = `/api/debts${qs ? '?' + qs : ''}`;
    const debts = await request(endpoint);
    if (isNetworkAvailable() && !qs) {
      await Promise.all(debts.map((debt) => request(`/api/debts/${debt.id}`).catch(() => null)));
    }
    return debts;
  },
  getDebt: (id) => request(`/api/debts/${id}`),
  createDebt: (data) => request('/api/debts', { method: 'POST', body: JSON.stringify(data) }),
  updateDebt: (id, data) => request(`/api/debts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDebt: (id) => request(`/api/debts/${id}`, { method: 'DELETE' }),

  // Payments
  getPayments: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/payments${query ? '?' + query : ''}`);
  },
  createPayment: (data) => request('/api/payments', { method: 'POST', body: JSON.stringify(data) }),
  updatePayment: (id, data) => request(`/api/payments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePayment: (id) => request(`/api/payments/${id}`, { method: 'DELETE' }),

  // People
  getPeople: async () => {
    const people = await request('/api/people');
    if (isNetworkAvailable()) {
      await Promise.all(people.map((person) => request(`/api/people/${person.id}`).catch(() => null)));
    }
    return people;
  },
  getPerson: (id) => request(`/api/people/${id}`),
  createPerson: (data) => request('/api/people', { method: 'POST', body: JSON.stringify(data) }),
  updatePerson: (id, data) => request(`/api/people/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePerson: (id) => request(`/api/people/${id}`, { method: 'DELETE' }),

  // Demo / Utilities
  seedDemo: () => request('/api/demo/seed', { method: 'POST' }),
  resetAll: () => request('/api/reset', { method: 'POST' }),
  exportCsvUrl: '/api/export/csv',
  getPendingOperationCount,
  getOfflineSnapshot,
  syncOfflineChanges: syncOfflineQueue,
};
