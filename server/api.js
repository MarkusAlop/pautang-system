import { query, queryOne, run, saveDb } from './db.js';
import { addDaysToDateString, getPhilippineDateString } from '../src/lib/dateTime.js';

export function setupApiRoutes(router) {
  const replayOperation = (req, res) => {
    const operationId = req.get('X-Client-Operation-Id');
    if (!operationId) return false;

    const saved = queryOne(`SELECT status_code, response_json FROM api_idempotency WHERE operation_id = ?`, [operationId]);
    if (!saved) return false;

    res.status(saved.status_code).json(JSON.parse(saved.response_json));
    return true;
  };

  const rememberOperation = (req, statusCode, responseBody) => {
    const operationId = req.get('X-Client-Operation-Id');
    if (!operationId) return;

    run(`
      INSERT OR IGNORE INTO api_idempotency (operation_id, status_code, response_json, created_at)
      VALUES (?, ?, ?, ?)
    `, [operationId, statusCode, JSON.stringify(responseBody), new Date().toISOString()]);
  };

  const getClientCreatedAt = (value) => {
    if (typeof value !== 'string') return new Date().toISOString();
    const timestamp = new Date(value);
    return Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString();
  };

  // Helper to calculate loan status and remaining balance
  const enrichLoan = (debt) => {
    const today = getPhilippineDateString();
    const totalPaid = Number(debt.total_paid || 0);
    const amount = Number(debt.amount || 0);
    const balance = Math.max(0, amount - totalPaid);
    
    let computedStatus = debt.status;
    if (debt.status === 'forgiven') {
      computedStatus = 'forgiven';
    } else if (balance <= 0) {
      computedStatus = 'paid';
    } else if (totalPaid > 0) {
      computedStatus = 'partially_paid';
    } else {
      computedStatus = 'unpaid';
    }

    const isOverdue = computedStatus !== 'paid' && computedStatus !== 'forgiven' && !!debt.due_date && debt.due_date < today;

    return {
      ...debt,
      type: 'lent', // Strictly pautang
      amount,
      total_paid: totalPaid,
      balance,
      computed_status: computedStatus,
      is_overdue: isOverdue
    };
  };

  // 1. GET /api/stats (Pautang-only statistics)
  router.get('/api/stats', (req, res) => {
    try {
      const today = getPhilippineDateString();
      const currentMonthPrefix = today.substring(0, 7); // YYYY-MM

      const loans = query(`
        SELECT d.*, 
               COALESCE((SELECT SUM(amount) FROM payments WHERE debt_id = d.id), 0) as total_paid
        FROM debts d
        WHERE d.type = 'lent' OR d.type IS NULL
      `).map(enrichLoan);

      let totalPrincipalLent = 0;
      let totalCollected = 0;
      let totalOutstandingBalance = 0;
      let overdueCount = 0;
      let overdueAmount = 0;
      let settledCount = 0;

      const activeBorrowers = new Set();
      const allBorrowers = new Set();

      for (const loan of loans) {
        totalPrincipalLent += loan.amount;
        totalCollected += loan.total_paid;
        allBorrowers.add(loan.person_id);

        if (loan.computed_status === 'paid') {
          settledCount++;
        }

        if (loan.status !== 'forgiven') {
          totalOutstandingBalance += loan.balance;
          if (loan.balance > 0) {
            activeBorrowers.add(loan.person_id);
          }
        }

        if (loan.is_overdue && loan.status !== 'forgiven') {
          overdueCount++;
          overdueAmount += loan.balance;
        }
      }

      // Payments received this month
      const paymentsThisMonth = query(`
        SELECT p.amount 
        FROM payments p
        JOIN debts d ON p.debt_id = d.id
        WHERE p.payment_date LIKE ?
      `, [`${currentMonthPrefix}%`]);

      let collectedThisMonth = 0;
      for (const p of paymentsThisMonth) {
        collectedThisMonth += Number(p.amount);
      }

      res.json({
        total_outstanding: totalOutstandingBalance,
        total_lent: totalPrincipalLent,
        total_collected: totalCollected,
        collected_this_month: collectedThisMonth,
        overdue_count: overdueCount,
        overdue_amount: overdueAmount,
        active_borrowers_count: activeBorrowers.size,
        total_borrowers_count: allBorrowers.size,
        total_loans_count: loans.length,
        settled_loans_count: settledCount
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. GET /api/debts (List all pautang loans)
  router.get('/api/debts', (req, res) => {
    try {
      const { status, person_id, search } = req.query;
      let sql = `
        SELECT d.*, 
               p.name as person_name, 
               p.nickname as person_nickname,
               p.relationship as person_relationship,
               p.phone as person_phone,
               COALESCE((SELECT SUM(amount) FROM payments WHERE debt_id = d.id), 0) as total_paid
        FROM debts d
        JOIN people p ON d.person_id = p.id
        WHERE (d.type = 'lent' OR d.type IS NULL)
      `;
      const params = [];

      if (person_id) {
        sql += ` AND d.person_id = ?`;
        params.push(Number(person_id));
      }

      sql += ` ORDER BY d.date_incurred DESC, d.id DESC`;

      let loans = query(sql, params).map(enrichLoan);

      if (status) {
        if (status === 'overdue') {
          loans = loans.filter(d => d.is_overdue);
        } else if (status === 'active') {
          loans = loans.filter(d => d.balance > 0 && d.status !== 'forgiven');
        } else if (status === 'paid') {
          loans = loans.filter(d => d.computed_status === 'paid');
        } else if (status === 'forgiven') {
          loans = loans.filter(d => d.status === 'forgiven');
        }
      }

      if (search) {
        const q = search.toLowerCase();
        loans = loans.filter(d => 
          (d.person_name && d.person_name.toLowerCase().includes(q)) ||
          (d.person_nickname && d.person_nickname.toLowerCase().includes(q)) ||
          (d.reason && d.reason.toLowerCase().includes(q)) ||
          (d.notes && d.notes.toLowerCase().includes(q))
        );
      }

      res.json(loans);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. GET /api/debts/:id
  router.get('/api/debts/:id', (req, res) => {
    try {
      const debtId = Number(req.params.id);
      const debt = queryOne(`
        SELECT d.*, 
               p.name as person_name, 
               p.nickname as person_nickname,
               p.relationship as person_relationship,
               p.phone as person_phone,
               p.facebook as person_facebook,
               COALESCE((SELECT SUM(amount) FROM payments WHERE debt_id = d.id), 0) as total_paid
        FROM debts d
        JOIN people p ON d.person_id = p.id
        WHERE d.id = ?
      `, [debtId]);

      if (!debt) return res.status(404).json({ error: 'Loan record not found' });

      const payments = query(`
        SELECT * FROM payments WHERE debt_id = ? ORDER BY payment_date DESC, id DESC
      `, [debtId]);

      res.json({
        ...enrichLoan(debt),
        payments
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. POST /api/debts (Record new pautang)
  router.post('/api/debts', (req, res) => {
    try {
      if (replayOperation(req, res)) return;
      const { 
        person_id, 
        person_name, 
        person_nickname, 
        person_relationship, 
        person_phone,
        amount, 
        reason, 
        date_incurred, 
        due_date, 
        notes,
        client_created_at
      } = req.body;

      if (!amount || isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({ error: 'A valid loan amount is required' });
      }

      let targetPersonId = person_id;
      const now = getClientCreatedAt(client_created_at);

      // Auto-create borrower if new
      if (!targetPersonId && person_name) {
        const pResult = run(`
          INSERT INTO people (name, nickname, relationship, phone, created_at)
          VALUES (?, ?, ?, ?, ?)
        `, [
          person_name.trim(), 
          person_nickname ? person_nickname.trim() : null, 
          person_relationship || 'Friend', 
          person_phone ? person_phone.trim() : null, 
          now
        ]);
        targetPersonId = pResult.lastInsertRowid;
      }

      if (!targetPersonId) {
        return res.status(400).json({ error: 'Borrower is required' });
      }

      const finalDateIncurred = date_incurred || now.split('T')[0];
      const loanReason = typeof reason === 'string' ? reason.trim() : '';

      const result = run(`
        INSERT INTO debts (person_id, type, amount, reason, date_incurred, due_date, notes, status, created_at, updated_at)
        VALUES (?, 'lent', ?, ?, ?, ?, ?, 'active', ?, ?)
      `, [
        targetPersonId,
        Number(amount),
        loanReason,
        finalDateIncurred,
        due_date || null,
        notes ? notes.trim() : null,
        now,
        now
      ]);

      const created = queryOne(`SELECT * FROM debts WHERE id = ?`, [result.lastInsertRowid]);
      const responseBody = enrichLoan(created);
      rememberOperation(req, 201, responseBody);
      res.status(201).json(responseBody);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. PUT /api/debts/:id
  router.put('/api/debts/:id', (req, res) => {
    try {
      const debtId = Number(req.params.id);
      const { amount, reason, date_incurred, due_date, notes, status } = req.body;

      const existing = queryOne(`SELECT * FROM debts WHERE id = ?`, [debtId]);
      if (!existing) return res.status(404).json({ error: 'Loan not found' });

      const now = new Date().toISOString();
      run(`
        UPDATE debts
        SET amount = ?, reason = ?, date_incurred = ?, due_date = ?, notes = ?, status = ?, type = 'lent', updated_at = ?
        WHERE id = ?
      `, [
        amount !== undefined ? Number(amount) : existing.amount,
        reason !== undefined ? reason.trim() : existing.reason,
        date_incurred || existing.date_incurred,
        due_date !== undefined ? due_date : existing.due_date,
        notes !== undefined ? notes : existing.notes,
        status || existing.status,
        now,
        debtId
      ]);

      const updated = queryOne(`SELECT * FROM debts WHERE id = ?`, [debtId]);
      res.json(enrichLoan(updated));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. DELETE /api/debts/:id
  router.delete('/api/debts/:id', (req, res) => {
    try {
      const debtId = Number(req.params.id);
      run(`DELETE FROM payments WHERE debt_id = ?`, [debtId]);
      run(`DELETE FROM debts WHERE id = ?`, [debtId]);
      res.json({ success: true, message: 'Loan record deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. GET /api/payments
  router.get('/api/payments', (req, res) => {
    try {
      const { debt_id, limit } = req.query;
      let sql = `
        SELECT p.*, 
               d.reason as debt_reason,
               pe.id as person_id,
               pe.name as person_name,
               pe.nickname as person_nickname
        FROM payments p
        JOIN debts d ON p.debt_id = d.id
        JOIN people pe ON d.person_id = pe.id
        WHERE 1=1
      `;
      const params = [];

      if (debt_id) {
        sql += ` AND p.debt_id = ?`;
        params.push(Number(debt_id));
      }

      sql += ` ORDER BY p.payment_date DESC, p.id DESC`;
      if (limit) {
        sql += ` LIMIT ?`;
        params.push(Number(limit));
      }

      const payments = query(sql, params);
      res.json(payments);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. POST /api/payments (Record payment / collection)
  router.post('/api/payments', (req, res) => {
    try {
      if (replayOperation(req, res)) return;
      const { debt_id, amount, allocations, payment_date, payment_method, reference_no, notes, client_created_at } = req.body;
      if (!debt_id) return res.status(400).json({ error: 'Loan ID is required' });
      if (!amount || isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Valid payment amount is required' });
      }

      const debt = queryOne(`SELECT * FROM debts WHERE id = ?`, [Number(debt_id)]);
      if (!debt) return res.status(404).json({ error: 'Loan record not found' });

      const now = new Date().toISOString();
      const createdAt = getClientCreatedAt(client_created_at);
      const pDate = payment_date || getPhilippineDateString();

      if (Array.isArray(allocations)) {
        const normalizedAllocations = allocations.map((allocation) => ({
          debtId: Number(allocation.debt_id),
          amount: Number(allocation.amount)
        }));
        const amountInCents = Math.round(Number(amount) * 100);
        const allocationTotalInCents = normalizedAllocations.reduce(
          (total, allocation) => total + Math.round(allocation.amount * 100),
          0
        );
        const allocationDebtIds = normalizedAllocations.map((allocation) => allocation.debtId);
        if (
          normalizedAllocations.length === 0 ||
          normalizedAllocations.some((allocation) =>
            !Number.isInteger(allocation.debtId) ||
            !Number.isFinite(allocation.amount) ||
            allocation.amount <= 0
          ) ||
          new Set(allocationDebtIds).size !== allocationDebtIds.length ||
          allocationTotalInCents !== amountInCents
        ) {
          return res.status(400).json({ error: 'Payment allocations must add up to the payment amount.' });
        }

        const allocationDebts = normalizedAllocations.map((allocation) => {
          const loan = queryOne(`
            SELECT d.*,
                   COALESCE((SELECT SUM(amount) FROM payments WHERE debt_id = d.id), 0) as total_paid
            FROM debts d
            WHERE d.id = ?
          `, [allocation.debtId]);
          if (!loan || loan.person_id !== debt.person_id) {
            return { ...allocation, loan: null };
          }
          return { ...allocation, loan };
        });

        if (allocationDebts.some((allocation) => !allocation.loan)) {
          return res.status(400).json({ error: 'All repayment allocations must belong to the same borrower.' });
        }
        if (allocationDebts.some((allocation) =>
          allocation.loan.status === 'forgiven' ||
          allocation.amount > Math.max(0, Number(allocation.loan.amount) - Number(allocation.loan.total_paid)) + 0.005
        )) {
          return res.status(400).json({ error: 'A repayment allocation exceeds a loan’s remaining balance.' });
        }

        const createdPayments = [];
        for (const allocation of allocationDebts) {
          const result = run(`
            INSERT INTO payments (debt_id, amount, payment_date, payment_method, reference_no, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            allocation.debtId,
            allocation.amount,
            pDate,
            payment_method || 'Cash',
            reference_no ? reference_no.trim() : null,
            notes ? notes.trim() : null,
            createdAt
          ]);
          createdPayments.push(queryOne(`SELECT * FROM payments WHERE id = ?`, [result.lastInsertRowid]));
        }

        for (const { debtId } of allocationDebts) {
          const totalPaidRow = queryOne(
            `SELECT SUM(amount) as total FROM payments WHERE debt_id = ?`,
            [debtId]
          );
          const totalPaid = Number(totalPaidRow?.total || 0);
          const loan = allocationDebts.find((allocation) => allocation.debtId === debtId).loan;
          if (totalPaid >= Number(loan.amount) && loan.status !== 'forgiven') {
            run(`UPDATE debts SET status = 'paid', updated_at = ? WHERE id = ?`, [now, debtId]);
          } else if (totalPaid < Number(loan.amount) && loan.status === 'paid') {
            run(`UPDATE debts SET status = 'active', updated_at = ? WHERE id = ?`, [now, debtId]);
          }
        }

        const updatedDebts = allocationDebts.map(({ debtId }) => enrichLoan(queryOne(`
          SELECT d.*,
                 COALESCE((SELECT SUM(amount) FROM payments WHERE debt_id = d.id), 0) as total_paid
          FROM debts d WHERE d.id = ?
        `, [debtId])));
        const personDebts = query(`
          SELECT d.amount, d.status,
                 COALESCE((SELECT SUM(amount) FROM payments WHERE debt_id = d.id), 0) as total_paid
          FROM debts d
          WHERE d.person_id = ? AND (d.type = 'lent' OR d.type IS NULL)
        `, [debt.person_id]);
        const remainingBalance = personDebts.reduce((total, loan) =>
          total + (loan.status === 'forgiven' ? 0 : Math.max(0, Number(loan.amount) - Number(loan.total_paid))), 0);
        const responseBody = {
          payment: createdPayments[0],
          payments: createdPayments,
          debt: updatedDebts[0],
          debts: updatedDebts,
          is_settled: remainingBalance <= 0
        };
        rememberOperation(req, 201, responseBody);
        return res.status(201).json(responseBody);
      }

      const pResult = run(`
        INSERT INTO payments (debt_id, amount, payment_date, payment_method, reference_no, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        Number(debt_id),
        Number(amount),
        pDate,
        payment_method || 'Cash',
        reference_no ? reference_no.trim() : null,
        notes ? notes.trim() : null,
        createdAt
      ]);

      const totalPaidRow = queryOne(`SELECT SUM(amount) as total FROM payments WHERE debt_id = ?`, [Number(debt_id)]);
      const newTotalPaid = Number(totalPaidRow?.total || 0);

      // If fully paid, mark status as paid
      if (newTotalPaid >= debt.amount && debt.status !== 'forgiven') {
        run(`UPDATE debts SET status = 'paid', updated_at = ? WHERE id = ?`, [now, Number(debt_id)]);
      } else if (newTotalPaid < debt.amount && debt.status === 'paid') {
        run(`UPDATE debts SET status = 'active', updated_at = ? WHERE id = ?`, [now, Number(debt_id)]);
      }

      const payment = queryOne(`SELECT * FROM payments WHERE id = ?`, [pResult.lastInsertRowid]);
      const updatedDebt = enrichLoan(queryOne(`
        SELECT d.*, 
               COALESCE((SELECT SUM(amount) FROM payments WHERE debt_id = d.id), 0) as total_paid
        FROM debts d WHERE d.id = ?
      `, [Number(debt_id)]));

      const responseBody = {
        payment,
        debt: updatedDebt,
        is_settled: updatedDebt.balance <= 0
      };
      rememberOperation(req, 201, responseBody);
      res.status(201).json(responseBody);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. PUT /api/payments/:id
  router.put('/api/payments/:id', (req, res) => {
    try {
      const paymentId = Number(req.params.id);
      const amount = Number(req.body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Valid payment amount is required' });
      }

      const payment = queryOne(`SELECT * FROM payments WHERE id = ?`, [paymentId]);
      if (!payment) return res.status(404).json({ error: 'Payment not found' });

      run(`UPDATE payments SET amount = ? WHERE id = ?`, [amount, paymentId]);

      const debt = queryOne(`SELECT * FROM debts WHERE id = ?`, [payment.debt_id]);
      if (debt && debt.status !== 'forgiven') {
        const totalPaidRow = queryOne(`SELECT SUM(amount) as total FROM payments WHERE debt_id = ?`, [payment.debt_id]);
        const newTotalPaid = Number(totalPaidRow?.total || 0);
        const now = new Date().toISOString();
        if (newTotalPaid >= debt.amount) {
          run(`UPDATE debts SET status = 'paid', updated_at = ? WHERE id = ?`, [now, payment.debt_id]);
        } else if (debt.status === 'paid') {
          run(`UPDATE debts SET status = 'active', updated_at = ? WHERE id = ?`, [now, payment.debt_id]);
        }
      }

      res.json(queryOne(`SELECT * FROM payments WHERE id = ?`, [paymentId]));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. DELETE /api/payments/:id
  router.delete('/api/payments/:id', (req, res) => {
    try {
      const paymentId = Number(req.params.id);
      const payment = queryOne(`SELECT * FROM payments WHERE id = ?`, [paymentId]);
      if (!payment) return res.status(404).json({ error: 'Payment not found' });

      run(`DELETE FROM payments WHERE id = ?`, [paymentId]);

      const debtId = payment.debt_id;
      const debt = queryOne(`SELECT * FROM debts WHERE id = ?`, [debtId]);
      if (debt) {
        const totalPaidRow = queryOne(`SELECT SUM(amount) as total FROM payments WHERE debt_id = ?`, [debtId]);
        const newTotalPaid = Number(totalPaidRow?.total || 0);
        const now = new Date().toISOString();
        if (newTotalPaid >= debt.amount) {
          run(`UPDATE debts SET status = 'paid', updated_at = ? WHERE id = ?`, [now, debtId]);
        } else if (debt.status === 'paid') {
          run(`UPDATE debts SET status = 'active', updated_at = ? WHERE id = ?`, [now, debtId]);
        }
      }

      res.json({ success: true, message: 'Payment record deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. GET /api/people (Borrowers directory)
  router.get('/api/people', (req, res) => {
    try {
      const people = query(`SELECT * FROM people ORDER BY name ASC`);
      const debts = query(`
        SELECT d.*, 
               COALESCE((SELECT SUM(amount) FROM payments WHERE debt_id = d.id), 0) as total_paid
        FROM debts d
        WHERE d.type = 'lent' OR d.type IS NULL
      `).map(enrichLoan);

      const result = people.map(p => {
        const personDebts = debts.filter(d => d.person_id === p.id);
        let totalLent = 0;
        let totalPaid = 0;
        let outstandingBalance = 0;
        let activeLoansCount = 0;

        for (const d of personDebts) {
          totalLent += d.amount;
          totalPaid += d.total_paid;
          if (d.status !== 'forgiven' && d.balance > 0) {
            activeLoansCount++;
            outstandingBalance += d.balance;
          }
        }

        return {
          ...p,
          total_lent: totalLent,
          total_paid: totalPaid,
          outstanding_balance: outstandingBalance,
          total_loans_count: personDebts.length,
          active_loans_count: activeLoansCount
        };
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 11. GET /api/people/:id
  router.get('/api/people/:id', (req, res) => {
    try {
      const personId = Number(req.params.id);
      const person = queryOne(`SELECT * FROM people WHERE id = ?`, [personId]);
      if (!person) return res.status(404).json({ error: 'Borrower not found' });

      const debts = query(`
        SELECT d.*, 
               COALESCE((SELECT SUM(amount) FROM payments WHERE debt_id = d.id), 0) as total_paid
        FROM debts d
        WHERE d.person_id = ? AND (d.type = 'lent' OR d.type IS NULL)
        ORDER BY d.date_incurred DESC, d.id DESC
      `, [personId]).map(enrichLoan);

      const payments = query(`
        SELECT p.*, d.reason as debt_reason
        FROM payments p
        JOIN debts d ON p.debt_id = d.id
        WHERE d.person_id = ?
        ORDER BY p.payment_date DESC, p.id DESC
      `, [personId]);

      let totalLent = 0;
      let totalPaid = 0;
      let outstandingBalance = 0;

      for (const d of debts) {
        totalLent += d.amount;
        totalPaid += d.total_paid;
        if (d.status !== 'forgiven' && d.balance > 0) {
          outstandingBalance += d.balance;
        }
      }

      res.json({
        ...person,
        total_lent: totalLent,
        total_paid: totalPaid,
        outstanding_balance: outstandingBalance,
        debts,
        payments
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 12. POST /api/people (Add borrower)
  router.post('/api/people', (req, res) => {
    try {
      if (replayOperation(req, res)) return;
      const { name, nickname, relationship, phone, facebook, notes, client_created_at } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Borrower name is required' });
      }

      const now = getClientCreatedAt(client_created_at);
      const result = run(`
        INSERT INTO people (name, nickname, relationship, phone, facebook, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        name.trim(),
        nickname ? nickname.trim() : null,
        relationship || 'Friend',
        phone ? phone.trim() : null,
        facebook ? facebook.trim() : null,
        notes ? notes.trim() : null,
        now
      ]);

      const created = queryOne(`SELECT * FROM people WHERE id = ?`, [result.lastInsertRowid]);
      rememberOperation(req, 201, created);
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 13. PUT /api/people/:id
  router.put('/api/people/:id', (req, res) => {
    try {
      const personId = Number(req.params.id);
      const { name, nickname, relationship, phone, facebook, notes } = req.body;
      const existing = queryOne(`SELECT * FROM people WHERE id = ?`, [personId]);
      if (!existing) return res.status(404).json({ error: 'Borrower not found' });

      run(`
        UPDATE people
        SET name = ?, nickname = ?, relationship = ?, phone = ?, facebook = ?, notes = ?
        WHERE id = ?
      `, [
        name !== undefined ? name.trim() : existing.name,
        nickname !== undefined ? nickname.trim() : existing.nickname,
        relationship !== undefined ? relationship : existing.relationship,
        phone !== undefined ? phone.trim() : existing.phone,
        facebook !== undefined ? facebook.trim() : existing.facebook,
        notes !== undefined ? notes : existing.notes,
        personId
      ]);

      const updated = queryOne(`SELECT * FROM people WHERE id = ?`, [personId]);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 14. DELETE /api/people/:id
  router.delete('/api/people/:id', (req, res) => {
    try {
      const personId = Number(req.params.id);
      const debts = query(`SELECT id FROM debts WHERE person_id = ?`, [personId]);
      for (const d of debts) {
        run(`DELETE FROM payments WHERE debt_id = ?`, [d.id]);
      }
      run(`DELETE FROM debts WHERE person_id = ?`, [personId]);
      run(`DELETE FROM people WHERE id = ?`, [personId]);

      res.json({ success: true, message: 'Borrower and associated loans deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 15. POST /api/demo/seed (English pautang sample data)
  router.post('/api/demo/seed', (req, res) => {
    try {
      // Clear existing records first
      run(`DELETE FROM payments`);
      run(`DELETE FROM debts`);
      run(`DELETE FROM people`);

      const now = new Date();
      const today = getPhilippineDateString(now);
      const daysAgo = (days) => addDaysToDateString(today, -days);
      const daysAhead = (days) => addDaysToDateString(today, days);

      // 1. Kuya Jun (Brother - Family)
      const p1 = run(`INSERT INTO people (name, nickname, relationship, phone, notes, created_at)
        VALUES ('Juan Santos Jr.', 'Kuya Jun', 'Family', '0917-123-4567', 'Older brother in Bulacan', ?)`, [now.toISOString()]).lastInsertRowid;
      
      const d1 = run(`INSERT INTO debts (person_id, type, amount, reason, date_incurred, due_date, notes, status, created_at, updated_at)
        VALUES (?, 'lent', 5000, 'Motorcycle Emergency Repair', ?, ?, 'Agreed to pay by end of the month', 'active', ?, ?)`,
        [p1, daysAgo(20), daysAhead(5), now.toISOString(), now.toISOString()]).lastInsertRowid;
      
      run(`INSERT INTO payments (debt_id, amount, payment_date, payment_method, reference_no, notes, created_at)
        VALUES (?, 2000, ?, 'GCash', 'GC-88392019', '1st installment payment', ?)`, [d1, daysAgo(5), now.toISOString()]);

      // 2. Maria Concepcion (Cousin - Overdue)
      const p2 = run(`INSERT INTO people (name, nickname, relationship, phone, notes, created_at)
        VALUES ('Maria Concepcion', 'Ate Maria', 'Family', '0928-555-0192', 'Cousin running small snack business', ?)`, [now.toISOString()]).lastInsertRowid;
      
      run(`INSERT INTO debts (person_id, type, amount, reason, date_incurred, due_date, notes, status, created_at, updated_at)
        VALUES (?, 'lent', 3500, 'School Tuition Fee Support', ?, ?, 'Promised to settle on the 15th', 'active', ?, ?)`,
        [p2, daysAgo(25), daysAgo(4), now.toISOString(), now.toISOString()]); // OVERDUE

      // 3. Mark Angelo Reyes (College Friend - Paid in full)
      const p3 = run(`INSERT INTO people (name, nickname, relationship, phone, notes, created_at)
        VALUES ('Mark Angelo Reyes', 'Mark', 'Friend', '0919-444-2281', 'Close college friend', ?)`, [now.toISOString()]).lastInsertRowid;
      
      const d3 = run(`INSERT INTO debts (person_id, type, amount, reason, date_incurred, due_date, notes, status, created_at, updated_at)
        VALUES (?, 'lent', 1500, 'Dinner & Reunion Shared Bill', ?, ?, 'Paid promptly via Maya', 'paid', ?, ?)`,
        [p3, daysAgo(30), daysAgo(10), now.toISOString(), now.toISOString()]).lastInsertRowid;
      
      run(`INSERT INTO payments (debt_id, amount, payment_date, payment_method, reference_no, notes, created_at)
        VALUES (?, 1500, ?, 'Maya', 'MY-991283', 'Settled in full via Maya transfer', ?)`, [d3, daysAgo(10), now.toISOString()]);

      // 4. Sarah Mae Dizon (Office Colleague - Active)
      const p4 = run(`INSERT INTO people (name, nickname, relationship, phone, notes, created_at)
        VALUES ('Sarah Mae Dizon', 'Sarah', 'Colleague', '0918-333-8822', 'Colleague in Finance Dept', ?)`, [now.toISOString()]).lastInsertRowid;
      
      run(`INSERT INTO debts (person_id, type, amount, reason, date_incurred, due_date, notes, status, created_at, updated_at)
        VALUES (?, 'lent', 1200, 'Office Group Lunch & Taxi Share', ?, ?, 'To settle on upcoming payday', 'active', ?, ?)`,
        [p4, daysAgo(3), daysAhead(3), now.toISOString(), now.toISOString()]);

      // 5. Roberto Cruz (Neighbor)
      const p5 = run(`INSERT INTO people (name, nickname, relationship, phone, notes, created_at)
        VALUES ('Roberto Cruz', 'Mang Berting', 'Neighbor', '0915-777-3312', 'Neighbor next door', ?)`, [now.toISOString()]).lastInsertRowid;
      
      const d5 = run(`INSERT INTO debts (person_id, type, amount, reason, date_incurred, due_date, notes, status, created_at, updated_at)
        VALUES (?, 'lent', 2500, 'Emergency Electric Utility Bill', ?, ?, 'Two bi-weekly installments agreed', 'active', ?, ?)`,
        [p5, daysAgo(15), daysAhead(10), now.toISOString(), now.toISOString()]).lastInsertRowid;
      
      run(`INSERT INTO payments (debt_id, amount, payment_date, payment_method, reference_no, notes, created_at)
        VALUES (?, 1000, ?, 'Cash', null, 'Handed cash at the house', ?)`, [d5, daysAgo(2), now.toISOString()]);

      res.json({ success: true, message: 'Sample pautang records successfully loaded!' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 16. POST /api/reset (Clear all data)
  router.post('/api/reset', (req, res) => {
    try {
      run(`DELETE FROM payments`);
      run(`DELETE FROM debts`);
      run(`DELETE FROM people`);
      res.json({ success: true, message: 'All loan records and borrowers have been cleared.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 17. GET /api/export/csv
  router.get('/api/export/csv', (req, res) => {
    try {
      const debts = query(`
        SELECT d.id, d.amount, d.reason, d.date_incurred, d.due_date, d.status,
               p.name as person_name, p.nickname as person_nickname, p.relationship, p.phone,
               COALESCE((SELECT SUM(amount) FROM payments WHERE debt_id = d.id), 0) as total_paid
        FROM debts d
        JOIN people p ON d.person_id = p.id
        WHERE d.type = 'lent' OR d.type IS NULL
        ORDER BY d.date_incurred DESC
      `).map(enrichLoan);

      const header = ['Loan ID', 'Borrower Name', 'Nickname', 'Relationship', 'Phone', 'Original Amount', 'Total Paid', 'Remaining Balance', 'Purpose', 'Date Lent', 'Due Date', 'Status', 'Overdue'];
      const rows = debts.map(d => [
        d.id,
        `"${(d.person_name || '').replace(/"/g, '""')}"`,
        `"${(d.person_nickname || '').replace(/"/g, '""')}"`,
        d.relationship || '',
        d.phone || '',
        d.amount.toFixed(2),
        d.total_paid.toFixed(2),
        d.balance.toFixed(2),
        `"${(d.reason || '').replace(/"/g, '""')}"`,
        d.date_incurred,
        d.due_date || '',
        d.computed_status,
        d.is_overdue ? 'YES' : 'NO'
      ]);

      const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="pautang_records.csv"');
      res.send(csvContent);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
