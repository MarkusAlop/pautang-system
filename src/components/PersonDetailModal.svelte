<script>
  import { 
    X, Plus, ArrowDownLeft, Phone, 
    Calendar, CheckCircle2, AlertCircle, Trash2, Clock, ChevronRight
  } from 'lucide-svelte';
  import { formatCurrency, formatDate, formatDateTime, getDueDateStatus, getRelationshipBadge } from '../lib/formatters.js';

  export let isOpen = false;
  export let person = null; // detailed borrower object with .debts and .payments
  export let onClose = () => {};
  export let onSelectDebt = (debt) => {};
  export let onAddDebtForPerson = (person) => {};
  export let onDeletePerson = (person) => {};

  function buildTransactionHistory(borrower) {
    const events = [
      ...(borrower?.debts || []).map((debt) => ({
        id: `loan-${debt.id}`,
        debtId: debt.id,
        type: 'loan',
        occurredAt: debt.created_at || debt.date_incurred,
        amount: Number(debt.amount) || 0,
        description: debt.reason ? `New loan: ${debt.reason}` : 'New loan'
      })),
      ...(borrower?.payments || []).map((payment) => ({
        id: `payment-${payment.id}`,
        debtId: payment.debt_id,
        type: 'payment',
        occurredAt: payment.created_at || payment.payment_date,
        amount: Number(payment.amount) || 0,
        description: `Payment${payment.debt_reason ? ` for ${payment.debt_reason}` : ''}${payment.payment_method ? ` (${payment.payment_method})` : ''}`
      }))
    ].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

    const balances = new Map();
    return events.map((event) => {
      const currentBalance = balances.get(event.debtId) || 0;
      balances.set(
        event.debtId,
        event.type === 'loan' ? event.amount : Math.max(0, currentBalance - event.amount)
      );

      const balanceAfter = [...balances.values()].reduce((total, balance) => total + balance, 0);
      return { ...event, balanceAfter };
    });
  }

  $: transactionHistory = buildTransactionHistory(person);
</script>

{#if isOpen && person}
  <div class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    
    <div class="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- Modal Header -->
      <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-base font-bold text-slate-900">{person.name}</h3>
            {#if person.nickname}
              <span class="text-xs text-slate-500 font-normal">({person.nickname})</span>
            {/if}
            {#if person.relationship}
              <span class={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getRelationshipBadge(person.relationship)}`}>
                {person.relationship}
              </span>
            {/if}
          </div>
          {#if person.phone}
            <div class="text-xs text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
              <Phone class="w-3 h-3 text-slate-400" />
              <span>{person.phone}</span>
            </div>
          {/if}
        </div>

        <button
          on:click={onClose}
          class="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
        
        <!-- Summary Stats for this borrower -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5">
            <span class="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Outstanding Balance</span>
            <span class="text-lg font-extrabold font-mono text-emerald-800">{formatCurrency(person.outstanding_balance)}</span>
            <span class="text-[10px] text-emerald-600 block mt-0.5">Currently owed to you</span>
          </div>

          <div class="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Total Amount Lent</span>
            <span class="text-lg font-extrabold font-mono text-slate-800">{formatCurrency(person.total_lent)}</span>
            <span class="text-[10px] text-slate-500 block mt-0.5">Cumulative principal</span>
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded-2xl p-3.5">
            <span class="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">Total Repayments</span>
            <span class="text-lg font-extrabold font-mono text-blue-800">
              {formatCurrency(person.total_paid)}
            </span>
            <span class="text-[10px] text-blue-600 block mt-0.5">Total collected back</span>
          </div>
        </div>

        <!-- Loans List for this borrower -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">
              All Loan Records ({person.debts ? person.debts.length : 0})
            </h4>

            <button
              on:click={() => onAddDebtForPerson(person)}
              class="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
            >
              <Plus class="w-3.5 h-3.5" />
              Add New Loan
            </button>
          </div>

          {#if !person.debts || person.debts.length === 0}
            <div class="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
              No loan records for this borrower yet.
            </div>
          {:else}
            <div class="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
              {#each person.debts as d (d.id)}
                {@const dueInfo = getDueDateStatus(d.due_date, d.balance <= 0 || d.status === 'forgiven')}
                <button
                  on:click={() => onSelectDebt(d)}
                  class="w-full p-3.5 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <ArrowDownLeft class="w-4 h-4 stroke-[2.5]" />
                    </div>

                    <div>
                      <div class="font-bold text-xs text-slate-900">{d.reason}</div>
                      <div class="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>Loan date: {formatDate(d.date_incurred)}</span>
                        <span>Recorded: {formatDateTime(d.created_at)}</span>
                        {#if dueInfo}
                          <span class={`font-semibold ${dueInfo.status === 'overdue' ? 'text-red-600' : 'text-slate-500'}`}>
                            • {dueInfo.text}
                          </span>
                        {/if}
                      </div>
                    </div>
                  </div>

                  <div class="text-right">
                    <div class={`font-mono font-bold text-xs ${d.balance > 0 ? 'text-emerald-700' : 'text-slate-400 line-through'}`}>
                      {formatCurrency(d.balance)}
                    </div>
                    <div class="text-[10px] text-slate-400">
                      {d.balance <= 0 ? 'Paid in Full' : `Original: ${formatCurrency(d.amount)}`}
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Transaction History -->
        <div>
          <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Transaction History ({transactionHistory.length})
          </h4>

          {#if transactionHistory.length === 0}
            <div class="p-5 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
              No loan or payment transactions recorded yet.
            </div>
          {:else}
            <div class="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
              {#each transactionHistory as transaction (transaction.id)}
                <div class="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div class="flex items-start gap-2.5 min-w-0">
                    <div class={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${transaction.type === 'loan' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                      {#if transaction.type === 'loan'}
                        <ArrowDownLeft class="w-4 h-4" />
                      {:else}
                        <CheckCircle2 class="w-4 h-4" />
                      {/if}
                    </div>
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-slate-900">
                        {transaction.type === 'loan' ? 'New Loan' : 'Payment'}
                      </div>
                      <div class="text-xs text-slate-600 break-words">{transaction.description}</div>
                      <div class="text-[10px] text-slate-400 mt-0.5">{formatDateTime(transaction.occurredAt)}</div>
                    </div>
                  </div>
                  <div class="flex items-center justify-between sm:justify-end gap-4 pl-9 sm:pl-0 shrink-0">
                    <span class={`text-xs font-bold font-mono ${transaction.type === 'loan' ? 'text-emerald-700' : 'text-blue-700'}`}>
                      {transaction.type === 'loan' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </span>
                    <span class="text-right">
                      <span class="block text-[10px] text-slate-400">Balance after</span>
                      <span class="text-xs font-semibold font-mono text-slate-700">{formatCurrency(transaction.balanceAfter)}</span>
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Delete Borrower Section -->
        <div class="pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            on:click={() => onDeletePerson(person)}
            class="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1.5 p-2 rounded-xl hover:bg-red-50 transition-colors"
          >
            <Trash2 class="w-3.5 h-3.5" />
            <span>Delete borrower and all loan history</span>
          </button>

          <button
            on:click={onClose}
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>

      </div>

    </div>

  </div>
{/if}
