<script>
  import { X, CheckCircle2, DollarSign, Calendar, CreditCard, FileText, AlertCircle } from 'lucide-svelte';
  import confetti from 'canvas-confetti';
  import { formatCurrency } from '../lib/formatters.js';

  export let isOpen = false;
  export let debt = null;
  export let onClose = () => {};
  export let onSubmit = async (data) => {};

  let amount = '';
  let paymentDate = new Date().toISOString().split('T')[0];
  let paymentMethod = 'GCash';
  let referenceNo = '';
  let notes = '';

  let loading = false;
  let error = '';
  let initializedDebtId = null;

  $: if (!isOpen) {
    initializedDebtId = null;
  }

  $: if (debt && isOpen && initializedDebtId !== debt.id) {
    initializedDebtId = debt.id;
    amount = debt.balance > 0 ? debt.balance : '';
    paymentDate = new Date().toISOString().split('T')[0];
    referenceNo = '';
    notes = '';
    error = '';
  }

  function setAmount(val) {
    amount = val;
  }

  function setHalfAmount() {
    if (debt) {
      amount = Math.round((debt.balance / 2) * 100) / 100;
    }
  }

  async function handleFormSubmit() {
    error = '';
    const numAmount = Number(amount);
    if (!amount || isNaN(amount) || numAmount <= 0) {
      error = 'Please enter a valid payment amount (₱).';
      return;
    }

    loading = true;
    try {
      const result = await onSubmit({
        debt_id: debt.id,
        amount: numAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference_no: referenceNo ? referenceNo.trim() : null,
        notes: notes ? notes.trim() : null
      });

      // If loan is settled, launch celebratory confetti!
      if (result && result.is_settled) {
        try {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch (e) {}
      }

      onClose();
    } catch (err) {
      error = err.message || 'An error occurred while saving payment.';
    } finally {
      loading = false;
    }
  }
</script>

{#if isOpen && debt}
  <div class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    
    <div class="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- Modal Header -->
      <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div>
          <h3 class="text-base font-bold text-slate-900">Record Repayment</h3>
          <p class="text-xs text-slate-500">Log a partial or full payment received from the borrower.</p>
        </div>
        <button
          on:click={onClose}
          class="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Debt Summary Card -->
      <div class="px-6 pt-5">
        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div class="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Borrower:</span>
            <span class="font-bold text-slate-800">{debt.person_name} {debt.person_nickname ? `(${debt.person_nickname})` : ''}</span>
          </div>
          <div class="text-xs text-slate-600 truncate mb-2">
            Purpose: <span class="font-medium text-slate-800">{debt.reason}</span>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
            <div>
              <div class="text-[11px] text-slate-500">Original Amount</div>
              <div class="font-mono font-semibold text-slate-700">{formatCurrency(debt.amount)}</div>
            </div>
            <div>
              <div class="text-[11px] text-slate-500">Total Repaid</div>
              <div class="font-mono font-semibold text-emerald-600">{formatCurrency(debt.total_paid)}</div>
            </div>
            <div class="text-right">
              <div class="text-[11px] text-slate-500">Remaining Balance</div>
              <div class="font-mono font-extrabold text-sm text-emerald-700">{formatCurrency(debt.balance)}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Payment Form -->
      <form on:submit|preventDefault={handleFormSubmit} class="p-6 space-y-4">
        
        {#if error}
          <div class="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle class="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        {/if}

        <!-- 1. Payment Amount -->
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Payment Amount (PHP ₱)
          </label>
          <div class="relative">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">₱</span>
            <input
              type="number"
              step="any"
              min="1"
              max={debt.balance}
              bind:value={amount}
              placeholder="0.00"
              class="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>

          <!-- Quick Preset Buttons -->
          <div class="flex flex-wrap gap-1.5 mt-2">
            <button
              type="button"
              on:click={() => setAmount(debt.balance)}
              class="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold rounded-lg transition-colors"
            >
              Full Balance ({formatCurrency(debt.balance)})
            </button>
            <button
              type="button"
              on:click={setHalfAmount}
              class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              50% Partial
            </button>
          </div>
        </div>

        <!-- 2. Payment Method -->
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Payment Method</label>
          <div class="grid grid-cols-3 gap-2 text-xs">
            {#each ['GCash', 'Cash', 'Maya', 'Bank Transfer', 'Other'] as method}
              <button
                type="button"
                on:click={() => paymentMethod = method}
                class={`py-2 px-2 rounded-xl border text-center transition-all ${
                  paymentMethod === method
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {method}
              </button>
            {/each}
          </div>
        </div>

        <!-- 3. Payment Date -->
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Payment Date</label>
          <input
            type="date"
            bind:value={paymentDate}
            class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <!-- 4. Reference Number -->
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Reference / Transaction ID (Optional)
          </label>
          <input
            type="text"
            bind:value={referenceNo}
            placeholder="e.g. GCash Ref No. or Bank Transfer ID"
            class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
          />
        </div>

        <!-- 5. Notes -->
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Notes / Remarks (Optional)</label>
          <input
            type="text"
            bind:value={notes}
            placeholder="e.g. Handed cash at home, screenshot saved"
            class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
          />
        </div>

        <!-- Actions -->
        <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            on:click={onClose}
            class="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={loading}
            class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5"
          >
            <CheckCircle2 class="w-4 h-4" />
            <span>{loading ? 'Recording...' : 'Confirm Payment'}</span>
          </button>
        </div>

      </form>

    </div>

  </div>
{/if}
