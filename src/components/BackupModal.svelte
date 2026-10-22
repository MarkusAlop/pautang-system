<script>
  import { 
    Download, Database, Sparkles, Trash2, RefreshCw, 
    CheckCircle2, AlertTriangle, FileSpreadsheet, ShieldAlert
  } from 'lucide-svelte';
  import { api } from '../lib/api.js';

  export let onRefresh = async () => {};

  let message = '';
  let error = '';
  let loading = false;
  let confirmReset = false;

  async function handleSeedDemo() {
    message = '';
    error = '';
    loading = true;
    try {
      await api.seedDemo();
      message = 'Sample pautang records successfully loaded!';
      await onRefresh();
    } catch (e) {
      error = e.message || 'An error occurred while seeding sample data.';
    } finally {
      loading = false;
    }
  }

  async function handleResetData() {
    message = '';
    error = '';
    loading = true;
    try {
      await api.resetAll();
      message = 'All loan records and borrowers have been successfully cleared.';
      confirmReset = false;
      await onRefresh();
    } catch (e) {
      error = e.message || 'An error occurred while resetting data.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="max-w-4xl mx-auto space-y-6">
  
  <div>
    <h2 class="text-lg font-bold text-slate-900 tracking-tight">Data Management & Export</h2>
    <p class="text-xs text-slate-500">Export your loan ledger to Excel/CSV, inspect the SQLite database, or load sample data.</p>
  </div>

  {#if message}
    <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
      <CheckCircle2 class="w-4 h-4 shrink-0 text-emerald-600" />
      <span>{message}</span>
    </div>
  {/if}

  {#if error}
    <div class="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex items-center gap-2">
      <AlertTriangle class="w-4 h-4 shrink-0 text-red-600" />
      <span>{error}</span>
    </div>
  {/if}

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    
    <!-- 1. CSV Export Card -->
    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
          <FileSpreadsheet class="w-5 h-5" />
        </div>
        <h3 class="text-sm font-bold text-slate-900 mb-1">Export to Excel / CSV</h3>
        <p class="text-xs text-slate-500 mb-4">
          Download the complete loan ledger including borrower names, original amounts, repayments, balances, and due dates in CSV format ready for Microsoft Excel or Google Sheets.
        </p>
      </div>

      <a
        href={api.exportCsvUrl}
        download="pautang_records.csv"
        class="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
      >
        <Download class="w-4 h-4" />
        <span>Download CSV File</span>
      </a>
    </div>

    <!-- 2. Seed Sample Demo Data -->
    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
          <Sparkles class="w-5 h-5" />
        </div>
        <h3 class="text-sm font-bold text-slate-900 mb-1">Load Sample Pautang Data</h3>
        <p class="text-xs text-slate-500 mb-4">
          Want to test all features? Load realistic sample loan records with partial payments, overdue tracking, and active borrowers.
        </p>
      </div>

      <button
        on:click={handleSeedDemo}
        disabled={loading}
        class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
      >
        <Sparkles class="w-4 h-4" />
        <span>{loading ? 'Loading...' : 'Load Sample Data'}</span>
      </button>
    </div>

    <!-- 3. SQLite Database Storage Info -->
    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div class="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
        <Database class="w-5 h-5" />
      </div>
      <h3 class="text-sm font-bold text-slate-900 mb-1">Local SQLite Database</h3>
      <p class="text-xs text-slate-500 mb-3">
        All records and payments are stored in a persistent SQLite database file located at:
      </p>
      <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-700 select-all">
        data/utang.sqlite
      </div>
      <p class="text-[11px] text-slate-400 mt-2">
        You can copy or back up this file anytime or inspect it using DB Browser for SQLite.
      </p>
    </div>

    <!-- 4. Danger Zone: Reset All Data -->
    <div class="bg-white rounded-2xl border border-rose-200 p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
          <ShieldAlert class="w-5 h-5" />
        </div>
        <h3 class="text-sm font-bold text-rose-900 mb-1">Reset All Data</h3>
        <p class="text-xs text-rose-700/80 mb-4">
          Permanently delete all borrowers, loan records, and repayment history. This action cannot be undone.
        </p>
      </div>

      {#if !confirmReset}
        <button
          on:click={() => confirmReset = true}
          class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all"
        >
          <Trash2 class="w-4 h-4" />
          <span>Reset All Data...</span>
        </button>
      {:else}
        <div class="space-y-2">
          <p class="text-xs font-bold text-rose-900">Are you sure? All data will be erased.</p>
          <div class="flex gap-2">
            <button
              on:click={handleResetData}
              disabled={loading}
              class="flex-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm"
            >
              Yes, Delete All
            </button>
            <button
              on:click={() => confirmReset = false}
              class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
          </div>
        </div>
      {/if}
    </div>

  </div>

</div>
