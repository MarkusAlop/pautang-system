<script>
  import { 
    X, ArrowDownLeft, Phone,
    Calendar, CheckCircle2, AlertCircle, Trash2, Clock, ChevronRight
  } from 'lucide-svelte';
  import { formatCurrency, formatDateTime, getRelationshipBadge } from '../lib/formatters.js';

  export let isOpen = false;
  export let person = null; // detailed borrower object with .debts and .payments
  export let onClose = () => {};
  export let onDeletePerson = (person) => {};

  function buildTransactionHistory(borrower) {
    const events = [
      ...(borrower?.debts || []).map((debt) => ({
        id: `loan-${debt.id}`,
        debtId: debt.id,
        type: 'loan',
        occurredAt: debt.created_at || debt.date_incurred,
        amount: Number(debt.amount) || 0,
        description: debt.reason || 'Loan'
      })),
      ...(borrower?.payments || []).map((payment) => ({
        id: `payment-${payment.id}`,
        debtId: payment.debt_id,
        type: 'payment',
        occurredAt: payment.created_at || payment.payment_date,
        amount: Number(payment.amount) || 0,
        description: 'Payment'
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
            <span class="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Current Utang</span>
            <span class="text-lg font-extrabold font-mono text-emerald-800">{formatCurrency(person.outstanding_balance)}</span>
            <span class="text-[10px] text-emerald-600 block mt-0.5">Current balance</span>
          </div>

          <div class="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Total Amount Lent</span>
            <span class="text-lg font-extrabold font-mono text-slate-800">{formatCurrency(person.total_lent)}</span>
            <span class="text-[10px] text-slate-500 block mt-0.5">Total borrowed</span>
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded-2xl p-3.5">
            <span class="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">Total Repayments</span>
            <span class="text-lg font-extrabold font-mono text-blue-800">
              {formatCurrency(person.total_paid)}
            </span>
            <span class="text-[10px] text-blue-600 block mt-0.5">Total collected back</span>
          </div>
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
                      {#if transaction.type === 'payment'}
                        <div class="text-xs text-slate-600 break-words">Paid</div>
                      {:else}
                        <div class="text-xs text-slate-600 break-words">{transaction.description}</div>
                      {/if}
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
