import { offlineGet, offlineGetAll, offlineSet } from './offlineStore.js';
import { addDaysToDateString, getPhilippineDateString } from './dateTime.js';
import { getCurrentUser } from './auth.js';

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

function databaseKey() {
  const email = getCurrentUser()?.email;
  if (!email) throw new Error('Sign in to access your local ledger.');
  return `account:${encodeURIComponent(email.toLowerCase())}:ledger`;
}

function legacyCacheKey(endpoint) {
  return `${databaseKey().replace(/ledger$/, '')}api:${endpoint}`;
}

async function readDatabase() {
  const key = databaseKey();
  const saved = await offlineGet(key);
  if (saved) return saved;

  const prefix = key.replace(/ledger$/, '');
  const cacheEntries = (await offlineGetAll()).filter(([entryKey]) => entryKey.startsWith(`${prefix}api:`));
  const caches = new Map(cacheEntries);
  const people = caches.get(legacyCacheKey('/api/people')) || [];
  const debts = caches.get(legacyCacheKey('/api/debts')) || [];
  const payments = new Map();
  const capturePayments = (records) => {
    for (const payment of records || []) {
      if (payment?.id !== undefined) payments.set(String(payment.id), payment);
    }
  };
  capturePayments(caches.get(legacyCacheKey('/api/payments')));

  for (const [cacheKey, value] of cacheEntries) {
    if (!Array.isArray(value)) {
      if (cacheKey.startsWith(`${prefix}api:/api/debts/`)) capturePayments(value?.payments);
      if (cacheKey.startsWith(`${prefix}api:/api/people/`)) capturePayments(value?.payments);
      continue;
    }
    if (cacheKey.startsWith(`${prefix}api:/api/debts/`)) capturePayments(value);
  }

  const localDatabase = {
    people,
    debts,
    payments: [...payments.values()],
    ids: {
      person: Math.max(0, ...people.map((person) => Number(person.id) || 0)) + 1,
      debt: Math.max(0, ...debts.map((debt) => Number(debt.id) || 0)) + 1,
      payment: Math.max(0, ...[...payments.values()].map((payment) => Number(payment.id) || 0)) + 1
    }
  };
  await offlineSet(key, localDatabase);
  return localDatabase;
}

async function writeDatabase(database) {
  await offlineSet(databaseKey(), database);
}

function enrichDebt(debt, database) {
  const payments = database.payments.filter((payment) => Number(payment.debt_id) === Number(debt.id));
  const totalPaid = payments.reduce((total, payment) => total + Number(payment.amount), 0);
  const amount = Number(debt.amount);
  const balance = Math.max(0, amount - totalPaid);
  let computedStatus = debt.status;

  if (debt.status === 'forgiven') computedStatus = 'forgiven';
  else if (balance <= 0) computedStatus = 'paid';
  else if (totalPaid > 0) computedStatus = 'partially_paid';
  else computedStatus = 'unpaid';

  const today = getPhilippineDateString();
  return {
    ...debt,
    type: 'lent',
    amount,
    total_paid: totalPaid,
    balance,
    computed_status: computedStatus,
    is_overdue: computedStatus !== 'paid' && computedStatus !== 'forgiven' && Boolean(debt.due_date) && debt.due_date < today
  };
}

function personSummary(person, database) {
  const debts = database.debts
    .filter((debt) => Number(debt.person_id) === Number(person.id))
    .map((debt) => enrichDebt(debt, database));
  return {
    ...person,
    total_lent: debts.reduce((sum, debt) => sum + debt.amount, 0),
    total_paid: debts.reduce((sum, debt) => sum + debt.total_paid, 0),
    outstanding_balance: debts.reduce((sum, debt) => sum + (debt.status === 'forgiven' ? 0 : debt.balance), 0),
    total_loans_count: debts.length,
    active_loans_count: debts.filter((debt) => debt.status !== 'forgiven' && debt.balance > 0).length
  };
}

function debtWithPerson(debt, database) {
  const person = database.people.find((entry) => Number(entry.id) === Number(debt.person_id));
  return {
    ...enrichDebt(debt, database),
    person_name: person?.name,
    person_nickname: person?.nickname,
    person_relationship: person?.relationship,
    person_phone: person?.phone,
    person_facebook: person?.facebook
  };
}

function sortDebts(debts) {
  return debts.sort((left, right) =>
    String(right.date_incurred).localeCompare(String(left.date_incurred)) || Number(right.id) - Number(left.id)
  );
}

async function getStats() {
  const database = await readDatabase();
  const debts = database.debts.map((debt) => enrichDebt(debt, database));
  const people = database.people;
  const today = getPhilippineDateString();
  const monthPrefix = today.slice(0, 7);
  const overdue = debts.filter((debt) => debt.is_overdue && debt.status !== 'forgiven');
  const paymentsThisMonth = database.payments.filter((payment) => String(payment.payment_date).startsWith(monthPrefix));

  return {
    ...EMPTY_STATS,
    total_outstanding: debts.reduce((sum, debt) => sum + (debt.status === 'forgiven' ? 0 : debt.balance), 0),
    total_lent: debts.reduce((sum, debt) => sum + debt.amount, 0),
    total_collected: debts.reduce((sum, debt) => sum + debt.total_paid, 0),
    collected_this_month: paymentsThisMonth.reduce((sum, payment) => sum + Number(payment.amount), 0),
    overdue_count: overdue.length,
    overdue_amount: overdue.reduce((sum, debt) => sum + debt.balance, 0),
    active_borrowers_count: new Set(debts.filter((debt) => debt.balance > 0 && debt.status !== 'forgiven').map((debt) => debt.person_id)).size,
    total_borrowers_count: new Set(debts.map((debt) => debt.person_id)).size,
    total_loans_count: debts.length,
    settled_loans_count: debts.filter((debt) => debt.computed_status === 'paid').length
  };
}

async function getDebts(params = {}) {
  const database = await readDatabase();
  let debts = sortDebts(database.debts
    .filter((debt) => debt.type === 'lent')
    .map((debt) => debtWithPerson(debt, database)));

  if (params.person_id) debts = debts.filter((debt) => Number(debt.person_id) === Number(params.person_id));
  if (params.status === 'overdue') debts = debts.filter((debt) => debt.is_overdue);
  if (params.status === 'active') debts = debts.filter((debt) => debt.balance > 0 && debt.status !== 'forgiven');
  if (params.status === 'paid') debts = debts.filter((debt) => debt.computed_status === 'paid');
  if (params.status === 'forgiven') debts = debts.filter((debt) => debt.status === 'forgiven');
  if (params.search) {
    const search = params.search.toLowerCase();
    debts = debts.filter((debt) => [
      debt.person_name, debt.person_nickname, debt.reason, debt.notes
    ].some((value) => String(value || '').toLowerCase().includes(search)));
  }
  return debts;
}

async function getDebt(id) {
  const database = await readDatabase();
  const debt = database.debts.find((entry) => Number(entry.id) === Number(id));
  if (!debt) throw new Error('Loan record not found.');
  return {
    ...debtWithPerson(debt, database),
    payments: database.payments
      .filter((payment) => Number(payment.debt_id) === Number(id))
      .sort((left, right) => String(right.payment_date).localeCompare(String(left.payment_date)) || right.id - left.id)
  };
}

async function getPeople() {
  const database = await readDatabase();
  return database.people
    .map((person) => personSummary(person, database))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function getPerson(id) {
  const database = await readDatabase();
  const person = database.people.find((entry) => Number(entry.id) === Number(id));
  if (!person) throw new Error('Borrower not found.');
  const debts = sortDebts(database.debts
    .filter((debt) => Number(debt.person_id) === Number(id))
    .map((debt) => enrichDebt(debt, database)));
  const payments = database.payments
    .filter((payment) => debts.some((debt) => Number(debt.id) === Number(payment.debt_id)))
    .map((payment) => ({ ...payment, debt_reason: database.debts.find((debt) => debt.id === payment.debt_id)?.reason }))
    .sort((left, right) => String(right.payment_date).localeCompare(String(left.payment_date)) || right.id - left.id);
  return {
    ...personSummary(person, database),
    debts,
    payments
  };
}

async function createPerson(data) {
  if (!data.name?.trim()) throw new Error('Borrower name is required.');
  const database = await readDatabase();
  const person = {
    id: database.ids.person++,
    name: data.name.trim(),
    nickname: data.nickname?.trim() || null,
    relationship: data.relationship || 'Friend',
    phone: data.phone?.trim() || null,
    facebook: data.facebook?.trim() || null,
    notes: data.notes?.trim() || null,
    created_at: new Date().toISOString()
  };
  database.people.push(person);
  await writeDatabase(database);
  return person;
}

async function createDebt(data) {
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('A valid loan amount is required.');
  const database = await readDatabase();
  let personId = Number(data.person_id);

  if (!personId && data.person_name?.trim()) {
    const person = {
      id: database.ids.person++,
      name: data.person_name.trim(),
      nickname: data.person_nickname?.trim() || null,
      relationship: data.person_relationship || 'Friend',
      phone: data.person_phone?.trim() || null,
      facebook: null,
      notes: null,
      created_at: new Date().toISOString()
    };
    database.people.push(person);
    personId = person.id;
  }
  if (!database.people.some((person) => Number(person.id) === personId)) {
    throw new Error('Borrower is required.');
  }

  const now = new Date().toISOString();
  const debt = {
    id: database.ids.debt++,
    person_id: personId,
    type: 'lent',
    amount,
    reason: typeof data.reason === 'string' ? data.reason.trim() : '',
    date_incurred: data.date_incurred || getPhilippineDateString(),
    due_date: data.due_date || null,
    notes: data.notes?.trim() || null,
    status: 'active',
    created_at: data.client_created_at || now,
    updated_at: now
  };
  database.debts.push(debt);
  await writeDatabase(database);
  return enrichDebt(debt, database);
}

async function updateDebt(id, changes) {
  const database = await readDatabase();
  const debt = database.debts.find((entry) => Number(entry.id) === Number(id));
  if (!debt) throw new Error('Loan not found.');
  Object.assign(debt, {
    ...(changes.amount !== undefined ? { amount: Number(changes.amount) } : {}),
    ...(changes.reason !== undefined ? { reason: changes.reason.trim() } : {}),
    ...(changes.date_incurred !== undefined ? { date_incurred: changes.date_incurred } : {}),
    ...(changes.due_date !== undefined ? { due_date: changes.due_date || null } : {}),
    ...(changes.notes !== undefined ? { notes: changes.notes } : {}),
    ...(changes.status ? { status: changes.status } : {}),
    updated_at: new Date().toISOString()
  });
  await writeDatabase(database);
  return enrichDebt(debt, database);
}

async function deleteDebt(id) {
  const database = await readDatabase();
  database.debts = database.debts.filter((debt) => Number(debt.id) !== Number(id));
  database.payments = database.payments.filter((payment) => Number(payment.debt_id) !== Number(id));
  await writeDatabase(database);
  return { success: true, message: 'Loan record deleted successfully' };
}

async function createPayment(data) {
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Valid payment amount is required.');
  const database = await readDatabase();
  const debt = database.debts.find((entry) => Number(entry.id) === Number(data.debt_id));
  if (!debt) throw new Error('Loan record not found.');

  const allocations = Array.isArray(data.allocations)
    ? data.allocations.map((allocation) => ({ debtId: Number(allocation.debt_id), amount: Number(allocation.amount) }))
    : [{ debtId: Number(data.debt_id), amount }];
  const allocatedCents = allocations.reduce((sum, item) => sum + Math.round(item.amount * 100), 0);
  if (!allocations.length || allocatedCents !== Math.round(amount * 100) ||
      allocations.some((item) => !Number.isInteger(item.debtId) || !Number.isFinite(item.amount) || item.amount <= 0) ||
      new Set(allocations.map((item) => item.debtId)).size !== allocations.length) {
    throw new Error('Payment allocations must add up to the payment amount.');
  }

  const debts = allocations.map((allocation) => ({
    ...allocation,
    debt: database.debts.find((entry) => Number(entry.id) === allocation.debtId)
  }));
  if (debts.some((item) => !item.debt || Number(item.debt.person_id) !== Number(debt.person_id))) {
    throw new Error('All repayment allocations must belong to the same borrower.');
  }
  if (debts.some(({ debt: target, amount: part }) => {
    const paid = database.payments
      .filter((payment) => Number(payment.debt_id) === Number(target.id))
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    return target.status === 'forgiven' || part > Math.max(0, Number(target.amount) - paid) + 0.005;
  })) {
    throw new Error('A repayment allocation exceeds a loan’s remaining balance.');
  }

  const createdPayments = [];
  for (const allocation of debts) {
    const payment = {
      id: database.ids.payment++,
      debt_id: allocation.debt.id,
      amount: allocation.amount,
      payment_date: data.payment_date || getPhilippineDateString(),
      payment_method: data.payment_method || 'Cash',
      reference_no: data.reference_no?.trim() || null,
      notes: data.notes?.trim() || null,
      created_at: data.client_created_at || new Date().toISOString()
    };
    database.payments.push(payment);
    createdPayments.push(payment);
  }

  for (const { debt: target } of debts) {
    const paid = database.payments
      .filter((payment) => Number(payment.debt_id) === Number(target.id))
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    if (target.status !== 'forgiven') target.status = paid >= Number(target.amount) ? 'paid' : 'active';
    target.updated_at = new Date().toISOString();
  }

  await writeDatabase(database);
  const updatedDebts = debts.map(({ debt: target }) => enrichDebt(target, database));
  const remainingBalance = database.debts
    .filter((target) => Number(target.person_id) === Number(debt.person_id) && target.status !== 'forgiven')
    .reduce((sum, target) => sum + enrichDebt(target, database).balance, 0);
  return {
    payment: createdPayments[0],
    payments: createdPayments,
    debt: updatedDebts[0],
    debts: updatedDebts,
    is_settled: remainingBalance <= 0
  };
}

async function updatePayment(id, changes) {
  const amount = Number(changes.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Valid payment amount is required.');
  const database = await readDatabase();
  const payment = database.payments.find((entry) => Number(entry.id) === Number(id));
  if (!payment) throw new Error('Payment not found.');
  payment.amount = amount;
  const debt = database.debts.find((entry) => Number(entry.id) === Number(payment.debt_id));
  refreshDebtStatus(debt, database);
  await writeDatabase(database);
  return payment;
}

function refreshDebtStatus(debt, database) {
  if (!debt || debt.status === 'forgiven') return;
  const paid = database.payments
    .filter((payment) => Number(payment.debt_id) === Number(debt.id))
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  debt.status = paid >= Number(debt.amount) ? 'paid' : 'active';
  debt.updated_at = new Date().toISOString();
}

async function deletePayment(id) {
  const database = await readDatabase();
  const index = database.payments.findIndex((entry) => Number(entry.id) === Number(id));
  if (index < 0) throw new Error('Payment not found.');
  const [payment] = database.payments.splice(index, 1);
  refreshDebtStatus(database.debts.find((debt) => Number(debt.id) === Number(payment.debt_id)), database);
  await writeDatabase(database);
  return { success: true, message: 'Payment record deleted' };
}

async function updatePerson(id, changes) {
  const database = await readDatabase();
  const person = database.people.find((entry) => Number(entry.id) === Number(id));
  if (!person) throw new Error('Borrower not found.');
  for (const field of ['name', 'nickname', 'relationship', 'phone', 'facebook', 'notes']) {
    if (changes[field] !== undefined) person[field] = typeof changes[field] === 'string' ? changes[field].trim() : changes[field];
  }
  await writeDatabase(database);
  return person;
}

async function deletePerson(id) {
  const database = await readDatabase();
  const debtIds = new Set(database.debts.filter((debt) => Number(debt.person_id) === Number(id)).map((debt) => Number(debt.id)));
  database.people = database.people.filter((person) => Number(person.id) !== Number(id));
  database.debts = database.debts.filter((debt) => !debtIds.has(Number(debt.id)));
  database.payments = database.payments.filter((payment) => !debtIds.has(Number(payment.debt_id)));
  await writeDatabase(database);
  return { success: true, message: 'Borrower and associated loans deleted successfully' };
}

function toCsv(database) {
  const header = ['Loan ID', 'Borrower Name', 'Nickname', 'Relationship', 'Phone', 'Original Amount', 'Total Paid', 'Remaining Balance', 'Purpose', 'Date Lent', 'Due Date', 'Status', 'Overdue'];
  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = sortDebts(database.debts.map((debt) => debtWithPerson(debt, database))).map((debt) => [
    debt.id,
    quote(debt.person_name),
    quote(debt.person_nickname),
    quote(debt.person_relationship),
    quote(debt.person_phone),
    debt.amount.toFixed(2),
    debt.total_paid.toFixed(2),
    debt.balance.toFixed(2),
    quote(debt.reason),
    debt.date_incurred,
    debt.due_date || '',
    debt.computed_status,
    debt.is_overdue ? 'YES' : 'NO'
  ].join(','));
  return [header.join(','), ...rows].join('\r\n');
}

export const localApi = {
  getStats,
  getDebts,
  getDebt,
  getPeople,
  getPerson,
  createPerson,
  createDebt,
  updateDebt,
  deleteDebt,
  createPayment,
  updatePayment,
  deletePayment,
  updatePerson,
  deletePerson,
  getPayments: async ({ debt_id, limit } = {}) => {
    const database = await readDatabase();
    let payments = database.payments.map((payment) => {
      const debt = database.debts.find((entry) => Number(entry.id) === Number(payment.debt_id));
      const person = database.people.find((entry) => Number(entry.id) === Number(debt?.person_id));
      return {
        ...payment,
        debt_reason: debt?.reason,
        person_id: person?.id,
        person_name: person?.name,
        person_nickname: person?.nickname
      };
    }).sort((left, right) => String(right.payment_date).localeCompare(String(left.payment_date)) || right.id - left.id);
    if (debt_id) payments = payments.filter((payment) => Number(payment.debt_id) === Number(debt_id));
    if (limit) payments = payments.slice(0, Number(limit));
    return payments;
  },
  resetAll: async () => {
    const database = await readDatabase();
    database.people = [];
    database.debts = [];
    database.payments = [];
    await writeDatabase(database);
    return { success: true };
  },
  exportCsv: async () => toCsv(await readDatabase()),
  getLocalSnapshot: async () => ({
    stats: await getStats(),
    debts: await getDebts(),
    people: await getPeople()
  })
};

localApi.seedDemo = async () => {
  const database = {
    people: [],
    debts: [],
    payments: [],
    ids: { person: 1, debt: 1, payment: 1 }
  };
  const now = new Date().toISOString();
  const today = getPhilippineDateString();
  const ago = (days) => addDaysToDateString(today, -days);
  const ahead = (days) => addDaysToDateString(today, days);
  const addExample = (person, debt, payment) => {
    const personId = database.ids.person++;
    database.people.push({ id: personId, relationship: 'Friend', created_at: now, ...person });
    const debtId = database.ids.debt++;
    database.debts.push({
      id: debtId, person_id: personId, type: 'lent', status: 'active',
      created_at: now, updated_at: now, ...debt
    });
    if (payment) database.payments.push({
      id: database.ids.payment++, debt_id: debtId, payment_method: 'Cash',
      created_at: now, ...payment
    });
  };

  addExample(
    { name: 'Juan Santos Jr.', nickname: 'Kuya Jun', relationship: 'Family', phone: '0917-123-4567', notes: 'Older brother in Bulacan' },
    { amount: 5000, reason: 'Motorcycle Emergency Repair', date_incurred: ago(20), due_date: ahead(5), notes: 'Agreed to pay by end of the month' },
    { amount: 2000, payment_date: ago(5), payment_method: 'GCash', reference_no: 'GC-88392019', notes: '1st installment payment' }
  );
  addExample(
    { name: 'Maria Concepcion', nickname: 'Ate Maria', relationship: 'Family', phone: '0928-555-0192', notes: 'Cousin running small snack business' },
    { amount: 3500, reason: 'School Tuition Fee Support', date_incurred: ago(25), due_date: ago(4), notes: 'Promised to settle on the 15th' }
  );
  addExample(
    { name: 'Mark Angelo Reyes', nickname: 'Mark', relationship: 'Friend', phone: '0919-444-2281', notes: 'Close college friend' },
    { amount: 1500, reason: 'Dinner & Reunion Shared Bill', date_incurred: ago(30), due_date: ago(10), notes: 'Paid promptly via Maya', status: 'paid' },
    { amount: 1500, payment_date: ago(10), payment_method: 'Maya', reference_no: 'MY-991283', notes: 'Settled in full via Maya transfer' }
  );
  addExample(
    { name: 'Sarah Mae Dizon', nickname: 'Sarah', relationship: 'Colleague', phone: '0918-333-8822', notes: 'Colleague in Finance Dept' },
    { amount: 1200, reason: 'Office Group Lunch & Taxi Share', date_incurred: ago(3), due_date: ahead(3), notes: 'To settle on upcoming payday' }
  );
  addExample(
    { name: 'Roberto Cruz', nickname: 'Mang Berting', relationship: 'Neighbor', phone: '0915-777-3312', notes: 'Neighbor next door' },
    { amount: 2500, reason: 'Emergency Electric Utility Bill', date_incurred: ago(15), due_date: ahead(10), notes: 'Two bi-weekly installments agreed' },
    { amount: 1000, payment_date: ago(2), notes: 'Handed cash at the house' }
  );
  await writeDatabase(database);
  return { success: true, message: 'Sample pautang records successfully loaded!' };
};
