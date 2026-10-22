<script>
  import { X, Printer } from 'lucide-svelte';
  import { formatCurrency, formatDate } from '../lib/formatters.js';

  export let isOpen = false;
  export let debt = null;
  export let onClose = () => {};

  function handlePrint() {
    window.print();
  }
</script>

{#if isOpen && debt}
  <div class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    
    <div class="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- Top Action Bar (No-Print) -->
      <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 no-print">
        <span class="text-xs font-bold text-slate-700 uppercase tracking-wider">Statement of Account Preview</span>
        <div class="flex items-center gap-2">
          <button
            on:click={handlePrint}
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
          >
            <Printer class="w-3.5 h-3.5" />
            <span>Print / Save as PDF</span>
          </button>
          <button
            on:click={onClose}
            class="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Printable Document Area -->
      <div class="p-8 sm:p-10 space-y-6 text-slate-900 bg-white" id="printable-statement">
        
        <!-- Header -->
        <div class="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
          <div>
            <h1 class="text-xl font-extrabold tracking-tight uppercase">Statement of Account & Loan Acknowledgment</h1>
            <p class="text-xs text-slate-500 font-medium">Official Record of Loan & Repayment Ledger</p>
          </div>
          <div class="text-right text-xs">
            <div class="font-mono font-bold text-slate-800">SOA-REF#{debt.id.toString().padStart(5, '0')}</div>
            <div class="text-slate-500">Date Issued: {formatDate(new Date().toISOString())}</div>
          </div>
        </div>

        <!-- Parties Involved -->
        <div class="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-xs border border-slate-200">
          <div>
            <span class="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Lender (Creditor)
            </span>
            <div class="font-bold text-sm text-slate-900">
              Personal Lender
            </div>
            <div class="text-slate-500">Creditor Record</div>
          </div>

          <div>
            <span class="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Borrower (Debtor)
            </span>
            <div class="font-bold text-sm text-slate-900">
              {debt.person_name}
              {#if debt.person_nickname}
                <span class="font-normal text-slate-500">({debt.person_nickname})</span>
              {/if}
            </div>
            {#if debt.person_phone}
              <div class="text-slate-500">{debt.person_phone}</div>
            {/if}
          </div>
        </div>

        <!-- Loan Overview Details -->
        <div class="space-y-2 text-xs">
          <div class="flex justify-between py-1.5 border-b border-slate-100">
            <span class="text-slate-600 font-medium">Loan Purpose / Description:</span>
            <span class="font-bold text-slate-900">{debt.reason || 'Not specified'}</span>
          </div>
          <div class="flex justify-between py-1.5 border-b border-slate-100">
            <span class="text-slate-600 font-medium">Date Lent:</span>
            <span class="font-semibold text-slate-800">{formatDate(debt.date_incurred)}</span>
          </div>
          <div class="flex justify-between py-1.5 border-b border-slate-100">
            <span class="text-slate-600 font-medium">Target Due Date:</span>
            <span class="font-semibold text-slate-800">{debt.due_date ? formatDate(debt.due_date) : 'No fixed due date'}</span>
          </div>
          <div class="flex justify-between py-1.5 border-b border-slate-100">
            <span class="text-slate-600 font-medium">Original Principal Lent:</span>
            <span class="font-mono font-bold text-sm text-slate-900">{formatCurrency(debt.amount)}</span>
          </div>
        </div>

        <!-- Payment History Table -->
        <div>
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Repayment History (Payments Made)</h3>
          
          {#if !debt.payments || debt.payments.length === 0}
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500 italic">
              No payments recorded yet.
            </div>
          {:else}
            <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead class="bg-slate-100 text-slate-600 font-semibold text-left">
                <tr>
                  <th class="p-2 border-b border-slate-200">Date</th>
                  <th class="p-2 border-b border-slate-200">Method</th>
                  <th class="p-2 border-b border-slate-200">Reference / Remarks</th>
                  <th class="p-2 border-b border-slate-200 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                {#each debt.payments as p}
                  <tr>
                    <td class="p-2">{formatDate(p.payment_date)}</td>
                    <td class="p-2 font-medium">{p.payment_method}</td>
                    <td class="p-2 text-slate-500">{p.reference_no || p.notes || '-'}</td>
                    <td class="p-2 text-right font-mono font-bold text-emerald-700">{formatCurrency(p.amount)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>

        <!-- Total Calculation Box -->
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
          <div class="flex justify-between text-xs text-slate-600">
            <span>Original Principal Lent:</span>
            <span class="font-mono">{formatCurrency(debt.amount)}</span>
          </div>
          <div class="flex justify-between text-xs text-emerald-700">
            <span>Less: Total Payments Received:</span>
            <span class="font-mono font-semibold">- {formatCurrency(debt.total_paid)}</span>
          </div>
          <div class="pt-2 border-t border-slate-200 flex justify-between text-sm font-extrabold text-slate-900">
            <span>OUTSTANDING BALANCE DUE:</span>
            <span class="font-mono text-base text-emerald-800">{formatCurrency(debt.balance)}</span>
          </div>
        </div>

        <!-- Signatures -->
        <div class="grid grid-cols-2 gap-8 pt-10 text-xs text-center">
          <div>
            <div class="border-b border-slate-400 pb-1 mb-1 font-bold text-slate-800">
              Lender Signature
            </div>
            <span class="text-[11px] text-slate-500">Lender (Creditor)</span>
          </div>

          <div>
            <div class="border-b border-slate-400 pb-1 mb-1 font-bold text-slate-800">
              {debt.person_name}
            </div>
            <span class="text-[11px] text-slate-500">Borrower Acknowledgment (Debtor)</span>
          </div>
        </div>

      </div>

    </div>

  </div>
{/if}
