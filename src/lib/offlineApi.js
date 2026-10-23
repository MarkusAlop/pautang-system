import { offlineGet, offlineGetAll, offlineRemove, offlineSet, offlineUpdate } from './offlineStore.js';
import { getPhilippineDateString } from './dateTime.js';

const CACHE_PREFIX = 'api:';
const OUTBOX_KEY = 'offline:outbox';
const ID_MAP_KEY = 'offline:id-mappings';

const EMPTY_STATS = {
  total_outstanding: 0,
  total_lent: 0,
  total_collected: 0,
  collected_this_month: 0,
  overdue_count: 0,
  overdue_amount: 0,
  active_borrowers_count: 0,
  total_borrowers_count: 0,
  total_loans_count: 0,
  settled_loans_count: 0
};

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine;
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeTemporaryId() {
  return -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
}

function cacheKey(endpoint) {
  return `${CACHE_PREFIX}${endpoint}`;
}

function notifyQueue(queue) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pautang:offline-queue', {
      detail: { count: queue.length }
    }));
  }
}

async function enqueue(operation) {
  const queue = await offlineUpdate(OUTBOX_KEY, (current) => [...current, operation], []);
  notifyQueue(queue);
}

function summarizePerson(person, debts) {
  const ownDebts = debts.filter((debt) => Number(debt.person_id) === Number(person.id));
  return {
    ...person,
    total_lent: ownDebts.reduce((total, debt) => total + (Number(debt.amount) || 0), 0),
    total_paid: ownDebts.reduce((total, debt) => total + (Number(debt.total_paid) || 0), 0),
    outstanding_balance: ownDebts.reduce((total, debt) => total + (debt.status === 'forgiven' ? 0 : Number(debt.balance) || 0), 0),
    total_loans_count: ownDebts.length,
    active_loans_count: ownDebts.filter((debt) => debt.status !== 'forgiven' && debt.balance > 0).length
  };
}

function summarizeStats(debts, people, previousStats = EMPTY_STATS) {
  return {
    ...EMPTY_STATS,
    total_lent: debts.reduce((total, debt) => total + (Number(debt.amount) || 0), 0),
    total_collected: debts.reduce((total, debt) => total + (Number(debt.total_paid) || 0), 0),
    total_outstanding: debts.reduce((total, debt) => total + (debt.status === 'forgiven' ? 0 : Number(debt.balance) || 0), 0),
    collected_this_month: Number(previousStats.collected_this_month) || 0,
    overdue_count: debts.filter((debt) => debt.is_overdue && debt.status !== 'forgiven').length,
    overdue_amount: debts.reduce((total, debt) => total + (debt.is_overdue && debt.status !== 'forgiven' ? Number(debt.balance) || 0 : 0), 0),
    active_borrowers_count: people.filter((person) => Number(person.outstanding_balance) > 0).length,
    total_borrowers_count: people.length,
    total_loans_count: debts.length,
    settled_loans_count: debts.filter((debt) => debt.computed_status === 'paid').length
  };
}

async function getCachedResponse(endpoint) {
  const cached = await offlineGet(cacheKey(endpoint));
  if (cached !== null) return cached;
  if (endpoint === '/api/stats') return { ...EMPTY_STATS };
  if (/^\/api\/(debts|people|payments)(\?.*)?$/.test(endpoint)) return [];
  throw new Error('This record is not saved on this device yet. Connect to the internet and open it once first.');
}

async function getCachedDebts() {
  return (await offlineGet(cacheKey('/api/debts'))) || [];
}

async function getCachedPeople() {
  return (await offlineGet(cacheKey('/api/people'))) || [];
}

async function updatePersonCache(personId, debts, payment, newPerson) {
  let people = await getCachedPeople();
  let person = people.find((entry) => Number(entry.id) === Number(personId));
  if (!person && newPerson) person = newPerson;
  if (!person) return people;

  person = summarizePerson(person, debts);
  people = people.some((entry) => Number(entry.id) === Number(personId))
    ? people.map((entry) => Number(entry.id) === Number(personId) ? person : entry)
    : [...people, person];
  await offlineSet(cacheKey('/api/people'), people);

  const detailKey = cacheKey(`/api/people/${personId}`);
  const oldDetail = await offlineGet(detailKey);
  const detail = {
    ...(oldDetail || person),
    ...person,
    debts: debts.filter((debt) => Number(debt.person_id) === Number(personId)),
    payments: oldDetail?.payments || []
  };
  if (payment && !detail.payments.some((entry) => Number(entry.id) === Number(payment.id))) {
    detail.payments = [payment, ...detail.payments];
  }
  await offlineSet(detailKey, detail);
  return people;
}

async function queueOfflinePerson(data) {
  if (!data.name?.trim()) throw new Error('Borrower name is required.');
  const personId = makeTemporaryId();
  const person = {
    id: personId,
    name: data.name.trim(),
    nickname: data.nickname || null,
    relationship: data.relationship || 'Friend',
    phone: data.phone || null,
    notes: data.notes || null,
    created_at: new Date().toISOString(),
    total_lent: 0,
    total_paid: 0,
    outstanding_balance: 0,
    total_loans_count: 0,
    active_loans_count: 0
  };
  const people = [...await getCachedPeople(), person];
  await offlineSet(cacheKey('/api/people'), people);
  await offlineSet(cacheKey(`/api/people/${personId}`), { ...person, debts: [], payments: [] });
  const stats = await offlineGet(cacheKey('/api/stats')) || { ...EMPTY_STATS };
  await offlineSet(cacheKey('/api/stats'), { ...stats, total_borrowers_count: people.length });
  await enqueue({
    operationId: makeId(),
    type: 'createPerson',
    payload: { ...data, client_created_at: person.created_at },
    temporaryPersonId: personId
  });
  return person;
}

async function queueOfflineDebt(data) {
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('A valid loan amount is required.');
  const debts = await getCachedDebts();
  let people = await getCachedPeople();
  let personId = Number(data.person_id);
  let temporaryPersonId = null;
  let newPerson = null;

  if (!personId && data.person_name?.trim()) {
    temporaryPersonId = makeTemporaryId();
    personId = temporaryPersonId;
    newPerson = {
      id: personId,
      name: data.person_name.trim(),
      nickname: data.person_nickname || null,
      relationship: data.person_relationship || 'Friend',
      phone: data.person_phone || null,
      created_at: new Date().toISOString(),
      total_lent: 0,
      total_paid: 0,
      outstanding_balance: 0,
      total_loans_count: 0,
      active_loans_count: 0
    };
  }

  if (!personId) throw new Error('Borrower is required.');
  if (!people.some((person) => Number(person.id) === personId) && !newPerson) {
    throw new Error('This borrower is not available offline. Open their profile once while connected, then retry.');
  }

  const temporaryDebtId = makeTemporaryId();
  const createdAt = new Date().toISOString();
  const debt = {
    id: temporaryDebtId,
    person_id: personId,
    type: 'lent',
    amount,
    reason: typeof data.reason === 'string' ? data.reason.trim() : '',
    date_incurred: data.date_incurred || getPhilippineDateString(),
    due_date: data.due_date || null,
    notes: data.notes || null,
    status: 'active',
    created_at: createdAt,
    updated_at: createdAt,
    total_paid: 0,
    balance: amount,
    computed_status: 'unpaid',
    is_overdue: false
  };

  const nextDebts = [debt, ...debts];
  await offlineSet(cacheKey('/api/debts'), nextDebts);
  await offlineSet(cacheKey(`/api/debts/${temporaryDebtId}`), { ...debt, payments: [] });
  people = await updatePersonCache(personId, nextDebts, null, newPerson);
  const previousStats = await offlineGet(cacheKey('/api/stats')) || { ...EMPTY_STATS };
  await offlineSet(cacheKey('/api/stats'), summarizeStats(nextDebts, people, previousStats));
  await enqueue({
    operationId: makeId(),
    type: 'createDebt',
    payload: { ...data, client_created_at: createdAt },
    temporaryDebtId,
    temporaryPersonId
  });
  return debt;
}

async function queueOfflinePayment(data) {
  if (Array.isArray(data.allocations)) {
    const allocations = data.allocations.map((allocation) => ({
      debt_id: Number(allocation.debt_id),
      amount: Number(allocation.amount)
    }));
    const requestedCents = Math.round(Number(data.amount) * 100);
    const allocatedCents = allocations.reduce((total, allocation) =>
      total + Math.round(allocation.amount * 100), 0);
    const cachedDebts = await getCachedDebts();
    const allocationDebts = allocations.map((allocation) => ({
      ...allocation,
      debt: cachedDebts.find((entry) => Number(entry.id) === allocation.debt_id)
    }));

    if (
      allocations.length === 0 ||
      allocations.some((allocation) =>
        !Number.isInteger(allocation.debt_id) ||
        !Number.isFinite(allocation.amount) ||
        allocation.amount <= 0
      ) ||
      allocatedCents !== requestedCents
    ) {
      throw new Error('Payment allocations must add up to the payment amount.');
    }
    if (allocationDebts.some(({ debt }) => !debt)) {
      throw new Error('A loan in this borrower’s repayment is not saved on this device yet.');
    }
    const personId = Number(allocationDebts[0].debt.person_id);
    if (allocationDebts.some(({ debt, amount }) =>
      Number(debt.person_id) !== personId ||
      debt.status === 'forgiven' ||
      amount > Math.max(0, Number(debt.balance) || 0) + 0.005
    )) {
      throw new Error('The borrower’s loan balance changed. Refresh the loan list and try again.');
    }

    const results = [];
    for (const allocation of allocationDebts) {
      results.push(await queueOfflinePayment({
        ...data,
        debt_id: allocation.debt_id,
        amount: allocation.amount,
        allocations: undefined
      }));
    }
    const nextDebts = await getCachedDebts();
    const remainingBalance = nextDebts
      .filter((debt) => Number(debt.person_id) === personId && debt.status !== 'forgiven')
      .reduce((total, debt) => total + (Number(debt.balance) || 0), 0);
    return {
      payment: results[0].payment,
      payments: results.map((result) => result.payment),
      debt: results[0].debt,
      is_settled: remainingBalance <= 0,
      offline: true
    };
  }

  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Valid payment amount is required.');
  const debtId = Number(data.debt_id);
  const debts = await getCachedDebts();
  const debt = debts.find((entry) => Number(entry.id) === debtId)
    || await offlineGet(cacheKey(`/api/debts/${debtId}`));
  if (!debt) throw new Error('This loan is not available offline. Open it once while connected, then retry.');

  const paymentId = makeTemporaryId();
  const createdAt = new Date().toISOString();
  const payment = {
    id: paymentId,
    debt_id: debtId,
    amount,
    payment_date: data.payment_date || getPhilippineDateString(),
    payment_method: data.payment_method || 'Cash',
    reference_no: data.reference_no || null,
    notes: data.notes || null,
    created_at: createdAt
  };
  const totalPaid = (Number(debt.total_paid) || 0) + amount;
  const balance = Math.max(0, Number(debt.amount) - totalPaid);
  const updatedDebt = {
    ...debt,
    total_paid: totalPaid,
    balance,
    status: debt.status === 'forgiven' ? 'forgiven' : balance <= 0 ? 'paid' : 'active',
    computed_status: debt.status === 'forgiven' ? 'forgiven' : balance <= 0 ? 'paid' : totalPaid > 0 ? 'partially_paid' : 'unpaid',
    is_overdue: debt.is_overdue && balance > 0
  };
  const nextDebts = debts.map((entry) => Number(entry.id) === debtId ? updatedDebt : entry);
  await offlineSet(cacheKey('/api/debts'), nextDebts);

  const debtDetailKey = cacheKey(`/api/debts/${debtId}`);
  const oldDebtDetail = await offlineGet(debtDetailKey);
  await offlineSet(debtDetailKey, {
    ...(oldDebtDetail || debt),
    ...updatedDebt,
    payments: [payment, ...(oldDebtDetail?.payments || [])]
  });

  const people = await updatePersonCache(debt.person_id, nextDebts, payment);
  const previousStats = await offlineGet(cacheKey('/api/stats')) || { ...EMPTY_STATS };
  const stats = summarizeStats(nextDebts, people, previousStats);
  if (payment.payment_date.slice(0, 7) === getPhilippineDateString().slice(0, 7)) {
    stats.collected_this_month = (Number(previousStats.collected_this_month) || 0) + amount;
  }
  await offlineSet(cacheKey('/api/stats'), stats);
  await enqueue({
    operationId: makeId(),
    type: 'createPayment',
    payload: { ...data, client_created_at: createdAt },
    temporaryPaymentId: paymentId
  });

  return {
    payment,
    debt: updatedDebt,
    is_settled: updatedDebt.balance <= 0,
    offline: true
  };
}

export async function cacheApiResponse(endpoint, value) {
  await offlineSet(cacheKey(endpoint), value);
}

export async function getOfflineResponse(endpoint) {
  return getCachedResponse(endpoint);
}

export async function getOfflineSnapshot() {
  const [stats, debts, people] = await Promise.all([
    offlineGet(cacheKey('/api/stats')),
    offlineGet(cacheKey('/api/debts')),
    offlineGet(cacheKey('/api/people'))
  ]);
  return {
    stats: stats || { ...EMPTY_STATS },
    debts: debts || [],
    people: people || []
  };
}

export async function queueOfflineRequest(endpoint, options = {}) {
  const payload = options.body ? JSON.parse(options.body) : {};
  if (endpoint === '/api/people') return queueOfflinePerson(payload);
  if (endpoint === '/api/debts') return queueOfflineDebt(payload);
  if (endpoint === '/api/payments') return queueOfflinePayment(payload);
  throw new Error('This action needs an internet connection. New loans and payments can be recorded offline.');
}

export async function getPendingOperationCount() {
  return (await offlineGet(OUTBOX_KEY) || []).length;
}

export async function syncOfflineQueue() {
  if (!isOnline()) return { synced: 0, pending: await getPendingOperationCount() };

  let queue = await offlineGet(OUTBOX_KEY) || [];
  let idMappings = await offlineGet(ID_MAP_KEY) || { people: {}, debts: {} };
  let synced = 0;

  for (const operation of [...queue]) {
    const payload = { ...operation.payload };
    let endpoint = '/api/people';

    if (operation.type === 'createDebt') {
      endpoint = '/api/debts';
      if (Number(payload.person_id) < 0) {
        const mappedPersonId = idMappings.people[String(payload.person_id)];
        if (!mappedPersonId) return { synced, pending: queue.length, error: 'A borrower is waiting to sync first.' };
        payload.person_id = mappedPersonId;
      }
    } else if (operation.type === 'createPayment') {
      endpoint = '/api/payments';
      if (Number(payload.debt_id) < 0) {
        const mappedDebtId = idMappings.debts[String(payload.debt_id)];
        if (!mappedDebtId) return { synced, pending: queue.length, error: 'A loan is waiting to sync first.' };
        payload.debt_id = mappedDebtId;
      }
    }

    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Operation-Id': operation.operationId
        },
        body: JSON.stringify(payload)
      });
    } catch {
      return { synced, pending: queue.length, error: 'Connection lost while syncing.' };
    }

    if (!response.ok) {
      let message = 'Could not sync an offline transaction.';
      try {
        const body = await response.json();
        message = body.error || message;
      } catch {}
      return { synced, pending: queue.length, error: message };
    }

    const result = await response.json();
    if (operation.type === 'createPerson') {
      idMappings.people[String(operation.temporaryPersonId)] = result.id;
    } else if (operation.type === 'createDebt') {
      idMappings.debts[String(operation.temporaryDebtId)] = result.id;
      if (operation.temporaryPersonId) idMappings.people[String(operation.temporaryPersonId)] = result.person_id;
    }

    await offlineSet(ID_MAP_KEY, idMappings);
    queue = queue.filter((entry) => entry.operationId !== operation.operationId);
    await offlineSet(OUTBOX_KEY, queue);
    synced += 1;
    notifyQueue(queue);
  }

  for (const endpoint of ['/api/stats', '/api/debts', '/api/people']) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) await cacheApiResponse(endpoint, await response.json());
    } catch {}
  }

  const cachedEntries = await offlineGetAll();
  const detailsToRefresh = new Set();
  for (const [key] of cachedEntries) {
    const match = key.match(/^api:(\/api\/(?:people|debts)\/-?\d+)$/);
    if (!match) continue;
    const endpoint = match[1];
    const personMatch = endpoint.match(/^\/api\/people\/(-\d+)$/);
    const debtMatch = endpoint.match(/^\/api\/debts\/(-\d+)$/);
    const mappedId = personMatch
      ? idMappings.people[personMatch[1]]
      : debtMatch ? idMappings.debts[debtMatch[1]] : null;
    if (mappedId) {
      await offlineRemove(cacheKey(endpoint));
      detailsToRefresh.add(endpoint.replace(/-\d+$/, String(mappedId)));
    } else if (!endpoint.includes('/-')) {
      detailsToRefresh.add(endpoint);
    }
  }

  await Promise.all([...detailsToRefresh].map(async (endpoint) => {
    try {
      const response = await fetch(endpoint);
      if (response.ok) await cacheApiResponse(endpoint, await response.json());
    } catch {}
  }));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pautang:offline-sync', {
      detail: { synced, pending: queue.length, idMappings }
    }));
  }
  return { synced, pending: queue.length, idMappings };
}

export function isNetworkAvailable() {
  return isOnline();
}