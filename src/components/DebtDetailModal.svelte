<script>
  import { 
    X, Plus, FileText, Trash2, Calendar, 
    ArrowDownLeft, CheckCircle2, AlertCircle, Phone, Printer, Pencil, Check
  } from 'lucide-svelte';
  import { formatCurrency, formatDate, formatDateTime, getDueDateStatus, getRelationshipBadge } from '../lib/formatters.js';

  export let isOpen = false;
  export let debt = null;
  export let onClose = () => {};
  export let onOpenPayment = (debt) => {};
  export let onOpenStatement = (debt) => {};
  export let onUpdateAmount = async (debt, amount) => {};
  export let onUpdatePayment = async (paymentId, amount) => {};
  export let onDeleteDebt = (debt) => {};
  export let onDeletePayment = (paymentId) => {};

  let isEditingAmount = false;
  let editedAmount = '';
  let amountError = '';
  let savingAmount = false;
  let editingPaymentId = null;
  let editedPaymentAmount = '';
  let paymentAmountError = '';
  let savingPaymentAmount = false;

  $: dueInfo = debt ? getDueDateStatus(debt.due_date, debt.balance <= 0 || debt.status === 'forgiven') : null;
  function startEditingAmount() {
    editedAmount = debt.amount;
    amountError = '';
    isEditingAmount = true;
  }

  function cancelEditingAmount() {
    isEditingAmount = false;
    amountError = '';
  }

  async function saveAmount() {
    const nextAmount = Number(editedAmount);
    const totalPaid = Number(debt.total_paid) || 0;

    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      amountError = 'Enter a valid amount greater than zero.';
      return;
    }

    if (nextAmount < totalPaid) {
      amountError = 'Amount cannot be less than the total already repaid.';
      return;
    }

    savingAmount = true;
    amountError = '';
    try {
      await onUpdateAmount(debt, nextAmount);
      isEditingAmount = false;
    } catch (error) {
      amountError = error.message || 'Could not update the loan amount.';
    } finally {
      savingAmount = false;
    }
  }

  function startEditingPayment(payment) {
    editingPaymentId = payment.id;
    editedPaymentAmount = payment.amount;
    paymentAmountError = '';
  }

  function cancelEditingPayment() {
    editingPaymentId = null;
    paymentAmountError = '';
  }

  async function savePaymentAmount(payment) {
    const nextAmount = Number(editedPaymentAmount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      paymentAmountError = 'Enter a valid amount greater than zero.';
      return;
    }

    savingPaymentAmount = true;
    paymentAmountError = '';
    try {
      await onUpdatePayment(payment.id, nextAmount);
      editingPaymentId = null;
    } catch (error) {
      paymentAmountError = error.message || 'Could not update the payment amount.';
    } finally {
      savingPaymentAmount = false;
    }
  }
</script>

{#if isOpen && debt}
  <div class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    
    <div class="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- Modal Header -->
      <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <ArrowDownLeft class="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-base font-bold text-slate-900">
                {debt.person_name}
                {#if debt.person_nickname}
                  <span class="text-xs font-normal text-slate-500">({debt.person_nickname})</span>
                {/if}
              </h3>
              {#if debt.person_relationship}
                <span class={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getRelationshipBadge(debt.person_relationship)}`}>
                  {debt.person_relationship}
                </span>
              {/if}
            </div>
            <p class="text-xs text-slate-500">
              Money Lent Out (Pautang)
            </p>
          </div>
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
        
        <!-- Summary Cards Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Principal Lent</span>
            {#if isEditingAmount}
              <div class="mt-1 flex items-center gap-1">
                <span class="text-sm font-bold text-slate-500">₱</span>
                <input
                  type="number"
                  min={debt.total_paid || 0.01}
                  step="any"
                  bind:value={editedAmount}
                  class="w-full min-w-0 px-2 py-1 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-label="Loan amount"
                />
                <button
                  type="button"
                  on:click={saveAmount}
                  disabled={savingAmount}
                  class="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg disabled:opacity-50"
                  title="Save amount"
                  aria-label="Save amount"
                >
                  <Check class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  on:click={cancelEditingAmount}
                  disabled={savingAmount}
                  class="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg disabled:opacity-50"
                  title="Cancel editing"
                  aria-label="Cancel editing"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>
              {#if amountError}
                <span class="text-[10px] text-red-600 block mt-1">{amountError}</span>
              {/if}
            {:else}
              <div class="flex items-center justify-between gap-1">
                <span class="text-lg font-bold font-mono text-slate-800">{formatCurrency(debt.amount)}</span>
                <button
                  type="button"
                  on:click={startEditingAmount}
                  class="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                  title="Edit loan amount"
                  aria-label="Edit loan amount"
                >
                  <Pencil class="w-3.5 h-3.5" />
                </button>
              </div>
            {/if}
            <span class="text-[10px] text-slate-400 block mt-0.5">Loan date: {formatDate(debt.date_incurred)}</span>
            <span class="text-[10px] text-slate-400 block">Recorded: {formatDateTime(debt.created_at)}</span>
          </div>

          <div class="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Repaid</span>
            <span class="text-lg font-bold font-mono text-emerald-600">{formatCurrency(debt.total_paid)}</span>
          </div>

          <div class={`rounded-2xl p-3.5 border ${
            debt.balance > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-100 border-slate-200'
          }`}>
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Remaining Balance</span>
            <span class={`text-xl font-extrabold font-mono ${
              debt.balance > 0 ? 'text-emerald-700' : 'text-slate-500 line-through'
            }`}>
              {formatCurrency(debt.balance)}
            </span>
            <span class="text-[10px] font-semibold block mt-0.5">
              {#if debt.status === 'forgiven'}
                <span class="text-purple-700">Loan Forgiven</span>
              {:else if debt.balance <= 0}
                <span class="text-emerald-700">Paid in Full ✓</span>
              {:else if dueInfo}
                <span class={dueInfo.status === 'overdue' ? 'text-red-700 font-bold' : 'text-slate-600'}>
                  {dueInfo.text}
                </span>
              {:else}
                <span class="text-slate-500">No due date set</span>
              {/if}
            </span>
          </div>
        </div>

        <!-- Description & Notes -->
        <div class="space-y-2 text-xs">
          <div class="flex items-start gap-2">
            <span class="font-bold text-slate-600 shrink-0 w-28">Purpose:</span>
            <span class="text-slate-900 font-medium">{debt.reason || 'Not specified'}</span>
          </div>
          {#if debt.notes}
            <div class="flex items-start gap-2">
              <span class="font-bold text-slate-600 shrink-0 w-28">Agreement / Notes:</span>
              <span class="text-slate-700 italic">{debt.notes}</span>
            </div>
          {/if}
          {#if debt.person_phone}
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-600 shrink-0 w-28">Contact:</span>
              <a href={`tel:${debt.person_phone}`} class="text-emerald-600 hover:underline flex items-center gap-1 font-mono">
                <Phone class="w-3 h-3" />
                {debt.person_phone}
              </a>
            </div>
          {/if}
        </div>

        <!-- Payment History Ledger -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Repayment History ({debt.payments ? debt.payments.length : 0})
            </h4>

            {#if debt.balance > 0 && debt.status !== 'forgiven'}
              <button
                on:click={() => onOpenPayment(debt)}
                class="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
              >
                <Plus class="w-3.5 h-3.5" />
                Record Repayment
              </button>
            {/if}
          </div>

          {#if !debt.payments || debt.payments.length === 0}
            <div class="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
              No payments recorded for this loan yet.
            </div>
          {:else}
            <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
              {#each debt.payments as p (p.id)}
                <div class="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50 transition-colors">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                      {p.payment_method === 'GCash' ? 'GC' : p.payment_method === 'Maya' ? 'MY' : '₱'}
                    </div>
                    <div>
                      <div class="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>{formatDate(p.payment_date)}</span>
                        <span>• {p.payment_method}</span>
                        {#if p.reference_no}
                          <span class="font-mono text-slate-400">Ref: {p.reference_no}</span>
                        {/if}
                      </div>
                      <div class="text-[10px] text-slate-400">Recorded: {formatDateTime(p.created_at)}</div>
                      {#if p.notes}
                        <div class="text-[10px] text-slate-400 italic">"{p.notes}"</div>
                      {/if}
                    </div>
                  </div>

                  <div class="flex items-center gap-1 self-end sm:self-auto">
                    <div class="text-right">
                      {#if editingPaymentId === p.id}
                        <div class="flex items-center justify-end gap-1.5">
                          <span class="text-xs font-bold text-slate-500">₱</span>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            bind:value={editedPaymentAmount}
                            class="w-28 px-2 py-1.5 border border-slate-300 rounded-lg text-right font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            aria-label="Payment amount"
                          />
                          <button
                            type="button"
                            on:click={() => savePaymentAmount(p)}
                            disabled={savingPaymentAmount}
                            class="px-2 py-1.5 flex items-center gap-1 text-emerald-700 hover:bg-emerald-100 rounded-lg disabled:opacity-50"
                          >
                            <Check class="w-3.5 h-3.5" />
                            <span>{savingPaymentAmount ? 'Saving' : 'Save'}</span>
                          </button>
                          <button
                            type="button"
                            on:click={cancelEditingPayment}
                            disabled={savingPaymentAmount}
                            class="px-2 py-1.5 text-slate-500 hover:bg-slate-200 rounded-lg disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                        {#if paymentAmountError}
                          <div class="text-[10px] text-red-600 mt-1">{paymentAmountError}</div>
                        {/if}
                      {:else}
                        <div class="flex items-center justify-end gap-1">
                          <div class="font-bold text-slate-900 font-mono">{formatCurrency(p.amount)}</div>
                          <button
                            type="button"
                            on:click={() => startEditingPayment(p)}
                            class="px-2 py-1.5 flex items-center gap-1 text-emerald-700 hover:bg-emerald-50 rounded-lg"
                          >
                            <Pencil class="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        </div>
                      {/if}
                    </div>

                    <button
                      on:click={() => onDeletePayment(p.id)}
                      class="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                      title="Delete this payment record"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Action Bar at Bottom -->
        <div class="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          
          <div class="flex items-center gap-2">
            <!-- Statement of Account / Slip -->
            <button
              on:click={() => onOpenStatement(debt)}
              class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Printer class="w-3.5 h-3.5" />
              <span>Statement Slip</span>
            </button>

            <!-- Delete Debt -->
            <button
              on:click={() => onDeleteDebt(debt)}
              class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              title="Delete this entire loan record"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>

          <div class="flex items-center gap-2">
            {#if debt.balance > 0 && debt.status !== 'forgiven'}
              <button
                on:click={() => onOpenPayment(debt)}
                class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5"
              >
                <Plus class="w-4 h-4" />
                <span>Record Repayment</span>
              </button>
            {/if}
          </div>

        </div>

      </div>

    </div>

  </div>
{/if}
