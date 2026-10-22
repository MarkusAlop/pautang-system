<script>
  import { 
    X, Plus, ArrowDownLeft, Phone, 
    Calendar, CheckCircle2, AlertCircle, Trash2, Clock, ChevronRight
  } from 'lucide-svelte';
  import { formatCurrency, formatDate, getDueDateStatus, getRelationshipBadge } from '../lib/formatters.js';

  export let isOpen = false;
  export let person = null; // detailed borrower object with .debts and .payments
  export let onClose = () => {};
  export let onSelectDebt = (debt) => {};
  export let onAddDebtForPerson = (person) => {};
  export let onDeletePerson = (person) => {};
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
              Record New Loan
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
                        <span>{formatDate(d.date_incurred)}</span>
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
