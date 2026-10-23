<script>
  import { X, CheckCircle2, DollarSign, Calendar, CreditCard, FileText, AlertCircle } from 'lucide-svelte';
  import confetti from 'canvas-confetti';
  import { formatAmount, formatCurrency, handleAmountInput } from '../lib/formatters.js';
  import { QR_PAYMENT_METHODS, getPaymentQrFilePath, loadPaymentQrs } from '../lib/paymentQrs.js';

  export let isOpen = false;
  export let debt = null;
  export let onClose = () => {};
  export let onSubmit = async (data) => {};

  let amount = '';
  let paymentDate = new Date().toISOString().split('T')[0];
  let paymentMethod = 'GCash';
  let paymentQrs = {};
  let missingFolderQrs = {};
  let qrPreviewOpen = false;
  let notes = '';

  let loading = false;
  let error = '';
  let initializedDebtId = null;

  $: if (!isOpen) {
    initializedDebtId = null;
    qrPreviewOpen = false;
  }

  $: if (isOpen) {
    paymentQrs = loadPaymentQrs();
  }

  $: qrImage = paymentQrs[paymentMethod] || (missingFolderQrs[paymentMethod] ? '' : getPaymentQrFilePath(paymentMethod));

  function handleFolderQrError(method) {
    missingFolderQrs = { ...missingFolderQrs, [method]: true };
  }

  $: if (debt && isOpen && initializedDebtId !== debt.id) {
    initializedDebtId = debt.id;
    amount = '';
    paymentDate = new Date().toISOString().split('T')[0];
    notes = '';
    error = '';
  }

  async function handleFormSubmit() {
    error = '';
    const numAmount = Number(amount);
    if (!amount || isNaN(amount) || numAmount <= 0) {
      error = 'Please enter a valid payment amount (₱).';
      return;
    }
    if (numAmount > Number(debt.balance)) {
      error = 'Payment amount cannot be greater than the remaining balance.';
      return;
    }

    loading = true;
    try {
      const result = await onSubmit({
        debt_id: debt.id,
        amount: numAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
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
            Purpose: <span class="font-medium text-slate-800">{debt.reason || 'Not specified'}</span>
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
              type="text"
              inputmode="decimal"
              value={formatAmount(amount)}
              on:input={(event) => handleAmountInput(event, (value) => amount = value)}
              placeholder="0.00"
              class="payment-amount-input w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <!-- 2. Payment Method -->
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Payment Method</label>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {#each QR_PAYMENT_METHODS as method}
              <button
                type="button"
                on:click={() => { paymentMethod = method; qrPreviewOpen = false; }}
                class={`py-2 px-2 rounded-xl border text-center transition-all ${
                  paymentMethod === method
                    ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                aria-pressed={paymentMethod === method}
              >
                {method}
              </button>
            {/each}
          </div>

          {#if QR_PAYMENT_METHODS.includes(paymentMethod)}
            {#if qrImage}
              <div class="mt-3 p-3 border border-slate-200 rounded-xl text-center">
                <p class="text-xs font-semibold text-slate-700 mb-2">{paymentMethod} QR</p>
                <button type="button" on:click={() => qrPreviewOpen = true} class="inline-flex flex-col items-center gap-2">
                  <img src={qrImage} alt={`${paymentMethod} payment QR`} on:error={() => handleFolderQrError(paymentMethod)} class="w-40 h-40 object-contain rounded-lg border border-slate-200" />
                  <span class="text-[11px] text-blue-700">Click to enlarge</span>
                </button>
              </div>
            {:else}
              <p class="mt-2 text-xs text-slate-500">
                No {paymentMethod} QR image found. Upload it in Settings → Payment QR Codes or add its PNG to public/payment-qrs/.
              </p>
            {/if}
          {/if}
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

        <!-- 4. Notes -->
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Notes / Remarks (Optional)</label>
          <input
            type="text"
            bind:value={notes}
            placeholder="Add payment details or remarks"
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

      {#if qrPreviewOpen && qrImage}
        <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button type="button" class="absolute inset-0 bg-slate-950/80" on:click={() => qrPreviewOpen = false} aria-label="Close QR preview"></button>
          <div class="relative z-10 w-full max-w-md bg-white rounded-2xl p-4 shadow-2xl" role="dialog" aria-modal="true" aria-label={`${paymentMethod} QR code`}>
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-bold text-slate-900">{paymentMethod} QR</h3>
              <button type="button" on:click={() => qrPreviewOpen = false} class="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg" aria-label="Close QR preview">
                <X class="w-5 h-5" />
              </button>
            </div>
            <img src={qrImage} alt={`${paymentMethod} payment QR`} on:error={() => handleFolderQrError(paymentMethod)} class="w-full max-h-[75vh] object-contain" />
          </div>
        </div>
      {/if}

    </div>

  </div>
{/if}
