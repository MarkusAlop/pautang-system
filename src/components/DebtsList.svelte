<script>
  import { 
    Search, Filter, Plus, Calendar, AlertTriangle, CheckCircle2, 
    ArrowDownLeft, MessageCircle, FileText, 
    Trash2, ChevronRight, Phone, Clock
  } from 'lucide-svelte';
  import { formatCurrency, formatDate, getDueDateStatus, getRelationshipBadge } from '../lib/formatters.js';

  export let debts = [];
  export let filterStatus = 'all'; // 'all', 'active', 'overdue', 'paid'
  export let searchQuery = '';

  export let onSelectDebt = (debt) => {};
  export let onOpenPayment = (debt) => {};
  export let onOpenReminder = (debt) => {};
  export let onOpenAddDebt = () => {};
  export let onDeleteDebt = (debt) => {};

  let sortField = 'date_incurred'; // 'date_incurred', 'due_date', 'balance', 'amount'
  let sortDirection = 'desc';

  $: filteredDebts = debts
    .filter(d => {
      // Status filter
      if (filterStatus === 'overdue') {
        if (!d.is_overdue || d.status === 'forgiven') return false;
      } else if (filterStatus === 'active') {
        if (d.balance <= 0 || d.status === 'forgiven') return false;
      } else if (filterStatus === 'paid') {
        if (d.computed_status !== 'paid') return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = d.person_name && d.person_name.toLowerCase().includes(q);
        const nickMatch = d.person_nickname && d.person_nickname.toLowerCase().includes(q);
        const reasonMatch = d.reason && d.reason.toLowerCase().includes(q);
        const notesMatch = d.notes && d.notes.toLowerCase().includes(q);
        if (!nameMatch && !nickMatch && !reasonMatch && !notesMatch) return false;
      }

      return true;
    })
    .sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'balance' || sortField === 'amount') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = valA || '';
        valB = valB || '';
      }

      if (sortDirection === 'asc') {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    });
</script>

<div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
  
  <!-- Header & Filter Bar -->
  <div class="p-4 sm:p-5 border-b border-slate-200 space-y-4">
    
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-bold text-slate-900 tracking-tight">Pautang Ledger (Money Lent)</h2>
        <p class="text-xs text-slate-500">Track and manage all money lent to borrowers, repayments, and due dates.</p>
      </div>

      <div class="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
        Total Loans: <span class="font-bold text-slate-900">{debts.length}</span>
      </div>
    </div>

    <!-- Search & Status Filters -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
      
      <!-- Search Input -->
      <div class="relative flex-1 max-w-md">
        <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search borrower name, nickname, purpose, or notes..."
          class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
        />
        {#if searchQuery}
          <button 
            on:click={() => searchQuery = ''}
            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
          >
            Clear
          </button>
        {/if}
      </div>

      <!-- Status Filters -->
      <div class="flex flex-wrap items-center gap-1.5 text-xs">
        <span class="text-slate-500 text-[11px] font-bold mr-1">Filter:</span>
        <button
          on:click={() => filterStatus = 'all'}
          class={`px-3 py-1.5 rounded-lg border transition-colors ${
            filterStatus === 'all' ? 'bg-slate-900 text-white border-slate-900 font-semibold' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          All Loans
        </button>
        <button
          on:click={() => filterStatus = 'active'}
          class={`px-3 py-1.5 rounded-lg border transition-colors ${
            filterStatus === 'active' ? 'bg-blue-600 text-white border-blue-600 font-semibold' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          Active (Unpaid)
        </button>
        <button
          on:click={() => filterStatus = 'overdue'}
          class={`px-3 py-1.5 rounded-lg border transition-colors ${
            filterStatus === 'overdue' ? 'bg-red-600 text-white border-red-600 font-semibold' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
          }`}
        >
          Overdue
        </button>
        <button
          on:click={() => filterStatus = 'paid'}
          class={`px-3 py-1.5 rounded-lg border transition-colors ${
            filterStatus === 'paid' ? 'bg-emerald-600 text-white border-emerald-600 font-semibold' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          Paid in Full
        </button>
      </div>

    </div>

  </div>

  <!-- Content: Table / List -->
  {#if filteredDebts.length === 0}
    <div class="p-12 text-center">
      <div class="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
        <FileText class="w-7 h-7" />
      </div>
      <h3 class="text-sm font-bold text-slate-800">No loan records found</h3>
      <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
        {#if searchQuery || filterStatus !== 'all'}
          Try adjusting or clearing your search filters to find records.
        {:else}
          Start recording money lent out to family, relatives, or friends.
        {/if}
      </p>
      {#if !searchQuery && filterStatus === 'all'}
        <button
          on:click={onOpenAddDebt}
          class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm"
        >
          <Plus class="w-4 h-4" />
          Record First Pautang
        </button>
      {/if}
    </div>
  {:else}
    
    <div class="divide-y divide-slate-100">
      {#each filteredDebts as debt (debt.id)}
        {@const dueInfo = getDueDateStatus(debt.due_date, debt.balance <= 0 || debt.status === 'forgiven')}
        
        <div class="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <!-- Left: Borrower & Loan Details -->
          <div class="flex items-start gap-3.5 flex-1 min-w-0">
            
            <!-- Avatar/Icon -->
            <div class="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <ArrowDownLeft class="w-5 h-5 stroke-[2.5]" />
            </div>

            <!-- Details -->
            <div class="flex-1 min-w-0">
              
              <div class="flex flex-wrap items-center gap-2">
                <button
                  on:click={() => onSelectDebt(debt)}
                  class="text-sm font-bold text-slate-900 hover:text-emerald-700 transition-colors truncate text-left"
                >
                  {debt.person_name}
                  {#if debt.person_nickname}
                    <span class="text-xs font-normal text-slate-500">({debt.person_nickname})</span>
                  {/if}
                </button>

                <!-- Relationship Badge -->
                {#if debt.person_relationship}
                  <span class={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getRelationshipBadge(debt.person_relationship)}`}>
                    {debt.person_relationship}
                  </span>
                {/if}

                <!-- Due date alert if overdue/due today -->
                {#if dueInfo}
                  <span class={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${dueInfo.color}`}>
                    <Clock class="w-3 h-3" />
                    {dueInfo.text}
                  </span>
                {/if}
              </div>

              <!-- Reason and Date -->
              <p class="text-xs text-slate-700 font-medium mt-1 truncate">
                {debt.reason}
              </p>

              <div class="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 mt-1">
                <span>Lent on: {formatDate(debt.date_incurred)}</span>
                {#if debt.due_date}
                  <span>• Target Due: {formatDate(debt.due_date)}</span>
                {/if}
                {#if debt.notes}
                  <span class="text-slate-500 italic truncate max-w-xs">• "{debt.notes}"</span>
                {/if}
              </div>

            </div>

          </div>

          <!-- Middle: Debt amounts -->
          <div class="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 shrink-0 min-w-[150px]">
            
            <div>
              <div class="text-right">
                <span class="text-xs text-slate-500 block md:hidden">Remaining:</span>
                <span class={`text-base font-extrabold font-mono ${
                  debt.balance > 0 ? 'text-emerald-700' : 'text-slate-400 line-through'
                }`}>
                  {formatCurrency(debt.balance)}
                </span>
              </div>
              <div class="text-[11px] text-slate-500 text-right">
                Original: {formatCurrency(debt.amount)}
              </div>
              <div class="text-[11px] text-slate-500 text-right">
                Total paid: {formatCurrency(debt.total_paid)}
              </div>
            </div>

          </div>

          <!-- Right: Action Buttons -->
          <div class="flex items-center gap-1.5 self-end md:self-center shrink-0">
            
            {#if debt.balance > 0 && debt.status !== 'forgiven'}
              <!-- Record Payment Button -->
              <button
                on:click={() => onOpenPayment(debt)}
                class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200 transition-colors flex items-center gap-1"
                title="Record a payment / collection"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>+ Payment</span>
              </button>

              <!-- Reminder Generator -->
              <button
                on:click={() => onOpenReminder(debt)}
                class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                title="Generate reminder message"
              >
                <MessageCircle class="w-4 h-4" />
              </button>
            {:else if debt.computed_status === 'paid'}
              <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg">
                <CheckCircle2 class="w-3.5 h-3.5" />
                Paid in Full
              </span>
            {:else if debt.status === 'forgiven'}
              <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-lg">
                Forgiven
              </span>
            {/if}

            <!-- View Ledger / Details -->
            <button
              on:click={() => onSelectDebt(debt)}
              class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              title="View full loan history & statement"
            >
              <ChevronRight class="w-4 h-4" />
            </button>

          </div>

        </div>
      {/each}
    </div>

  {/if}

</div>
