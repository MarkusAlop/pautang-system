<script>
  import { ArrowDownLeft, Wallet, CheckCircle2, AlertCircle, TrendingUp, Users } from 'lucide-svelte';
  import { formatCurrency } from '../lib/formatters.js';

  export let stats = {
    total_outstanding: 0,
    total_lent: 0,
    total_collected: 0,
    collected_this_month: 0,
    overdue_count: 0,
    overdue_amount: 0,
    active_borrowers_count: 0,
    total_borrowers_count: 0,
    total_loans_count: 0,
    settled_loans_count: 0,
  };

  export let onViewOverdue = () => {};
</script>

<div class="space-y-6">
  
  <!-- Overdue Banner (if any) -->
  {#if stats.overdue_count > 0}
    <div class="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
      <div class="flex items-start gap-3">
        <div class="p-2 bg-red-100 rounded-lg text-red-600 shrink-0">
          <AlertCircle class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-red-900">
            {stats.overdue_count} {stats.overdue_count === 1 ? 'Loan is' : 'Loans are'} Past Due Date!
          </h3>
          <p class="text-xs text-red-700 mt-0.5">
            Total overdue amount: <span class="font-bold">{formatCurrency(stats.overdue_amount)}</span>. You can send polite reminder messages directly to borrowers.
          </p>
        </div>
      </div>
      <button
        on:click={onViewOverdue}
        class="self-start sm:self-center px-3.5 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
      >
        View Overdue Loans
      </button>
    </div>
  {/if}

  <!-- Main 4 Metric Cards -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    
    <!-- 1. Total Outstanding Balance (Collectibles) -->
    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
      <div class="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 transition-all"></div>
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-700">Total Outstanding</span>
        <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <ArrowDownLeft class="w-4 h-4 stroke-[2.5]" />
        </div>
      </div>
      <div class="text-2xl font-extrabold text-emerald-800 font-mono tracking-tight">
        {formatCurrency(stats.total_outstanding)}
      </div>
      <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700">
        <span>Active Borrowers:</span>
        <span class="font-bold text-slate-900">{stats.active_borrowers_count} people</span>
      </div>
      <div class="mt-1 text-[11px] text-slate-500">
        Total unpaid money currently lent out
      </div>
    </div>

    <!-- 2. Total Collected Repayments -->
    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
      <div class="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-all"></div>
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-700">Total Collected</span>
        <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
          <CheckCircle2 class="w-4 h-4 stroke-[2.5]" />
        </div>
      </div>
      <div class="text-2xl font-extrabold text-blue-800 font-mono tracking-tight">
        {formatCurrency(stats.total_collected)}
      </div>
      <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700">
        <span>Settled Loans:</span>
        <span class="font-bold text-emerald-700">{stats.settled_loans_count} paid off</span>
      </div>
      <div class="mt-1 text-[11px] text-slate-500">
        All-time repayments received
      </div>
    </div>

    <!-- 3. Total Principal Lent -->
    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
      <div class="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 transition-all"></div>
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-700">Total Amount Lent</span>
        <div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
          <Wallet class="w-4 h-4 stroke-[2.5]" />
        </div>
      </div>
      <div class="text-2xl font-extrabold text-purple-800 font-mono tracking-tight">
        {formatCurrency(stats.total_lent)}
      </div>
      <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700">
        <span>Total Records:</span>
        <span class="font-bold text-slate-900">{stats.total_loans_count} loans</span>
      </div>
      <div class="mt-1 text-[11px] text-slate-500">
        Cumulative principal lent out to date
      </div>
    </div>

    <!-- 4. Collected This Month -->
    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
      <div class="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-4 -mt-4 transition-all"></div>
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-700">Collected This Month</span>
        <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
          <TrendingUp class="w-4 h-4 stroke-[2.5]" />
        </div>
      </div>
      <div class="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
        {formatCurrency(stats.collected_this_month)}
      </div>
      <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700">
        <span>Status:</span>
        <span class="font-semibold text-emerald-700">Active Month</span>
      </div>
      <div class="mt-1 text-[11px] text-slate-500">
        Inflow payments recorded in current month
      </div>
    </div>

  </div>

</div>
