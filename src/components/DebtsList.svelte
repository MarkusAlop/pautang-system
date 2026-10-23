<script>
  import { 
    Search, Filter, Plus, Calendar, AlertTriangle, CheckCircle2, 
    ArrowDownLeft, FileText, 
    Trash2, Phone, Clock
  } from 'lucide-svelte';
  import { formatCurrency, formatDate, getDueDateStatus, getRelationshipBadge } from '../lib/formatters.js';

  export let debts = [];
  export let filterStatus = 'active'; // 'all', 'active', 'overdue', 'paid'
  export let searchQuery = '';

  export let onSelectBorrower = (debt) => {};
  export let onOpenPayment = (debt) => {};
  export let onOpenLoan = (debt) => {};
  export let onOpenAddDebt = () => {};
  export let onDeleteDebt = (debt) => {};

  let sortField = 'date_incurred'; // 'date_incurred', 'due_date', 'balance', 'amount'
  let sortDirection = 'desc';

  function groupLoansByBorrower(records) {
    const groups = new Map();
    for (const debt of records) {
      const key = debt.person_id ?? `loan-${debt.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(debt);
    }

    return [...groups.entries()].map(([personId, loans]) => {
      const orderedLoans = [...loans].sort((a, b) =>
        String(b.created_at || b.date_incurred).localeCompare(String(a.created_at || a.date_incurred))
      );
      const outstandingLoans = loans.filter((loan) => loan.status !== 'forgiven' && Number(loan.balance) > 0);
      const latestOutstandingLoan = [...outstandingLoans].sort((a, b) =>
        String(b.created_at || b.date_incurred).localeCompare(String(a.created_at || a.date_incurred))
      )[0] || null;
      const oldestOutstandingLoans = [...outstandingLoans].sort((a, b) =>
        String(a.created_at || a.date_incurred).localeCompare(String(b.created_at || b.date_incurred))
      );
      const overdueLoans = outstandingLoans.filter((loan) => loan.is_overdue);
      return {
        personId,
        loans,
        representative: orderedLoans[0],
        latestOutstandingLoan,
        oldestOutstandingLoans,
        totalAmount: loans.reduce((sum, loan) => sum + (Number(loan.amount) || 0), 0),
        totalPaid: loans.reduce((sum, loan) => sum + (Number(loan.total_paid) || 0), 0),
        balance: loans.reduce((sum, loan) => sum + (loan.status === 'forgiven' ? 0 : Number(loan.balance) || 0), 0),
        outstandingLoans,
        overdueLoans,
        allPaid: loans.length > 0 && loans.every((loan) => loan.computed_status === 'paid')
      };
    });
  }

  $: borrowerGroups = groupLoansByBorrower(debts);
  $: filteredBorrowers = borrowerGroups
    .filter((group) => {
      const { loans, balance, outstandingLoans, overdueLoans, allPaid } = group;
      if (filterStatus === 'overdue' && overdueLoans.length === 0) return false;
      if (filterStatus === 'active' && (balance <= 0 || outstandingLoans.length === 0)) return false;
      if (filterStatus === 'paid' && !allPaid) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = loans.some((loan) =>
          [loan.person_name, loan.person_nickname, loan.reason, loan.notes]
            .some((value) => value && value.toLowerCase().includes(q))
        );
        if (!matches) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const valA = sortField === 'balance' ? a.balance : sortField === 'amount' ? a.totalAmount : a.representative[sortField];
      const valB = sortField === 'balance' ? b.balance : sortField === 'amount' ? b.totalAmount : b.representative[sortField];
      if (sortField === 'balance' || sortField === 'amount') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      return sortDirection === 'asc'
        ? String(valA || '').localeCompare(String(valB || ''))
        : String(valB || '').localeCompare(String(valA || ''));
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
        Total Loans: <span class="font-bold text-slate-900">{filteredBorrowers.length}</span>
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
  {#if filteredBorrowers.length === 0}
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
      {#if !searchQuery && (filterStatus === 'all' || filterStatus === 'active')}
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
      {#each filteredBorrowers as group (group.personId)}
        {@const debt = group.representative}
        {@const dueInfo = group.overdueLoans.length
          ? getDueDateStatus(group.overdueLoans[0].due_date, false)
          : getDueDateStatus(group.outstandingLoans[0]?.due_date, group.balance <= 0)}
        
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
                  on:click={() => onSelectBorrower(debt)}
                  class="text-sm font-bold text-slate-900 hover:text-emerald-700 hover:underline focus-visible:underline transition-colors truncate text-left"
                  aria-label={debt.person_name}
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

              <div class="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 mt-1">
                <span>{group.loans.length} loan transaction{group.loans.length === 1 ? '' : 's'}</span>
                {#if group.overdueLoans.length}
                  <span class="font-semibold text-red-700">{group.overdueLoans.length} overdue</span>
                {:else if dueInfo}
                  <span>{dueInfo.text}</span>
                {/if}
                <span>Latest: {formatDate(debt.date_incurred)}</span>
              </div>

            </div>

          </div>

          <!-- Middle: Debt amounts -->
          <div class="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 shrink-0 min-w-[150px]">
            
            <div>
              <div class="text-right">
                <span class="text-xs text-slate-500 block md:hidden">Remaining:</span>
                <span class={`text-base font-extrabold font-mono ${
                  group.balance > 0 ? 'text-red-700' : 'text-slate-400 line-through'
                }`}>
                  {formatCurrency(group.balance)}
                </span>
              </div>
              <div class="text-[11px] text-slate-500 text-right">
                Original: {formatCurrency(group.totalAmount)}
              </div>
              <div class="text-[11px] text-emerald-700 text-right">
                Total paid: {formatCurrency(group.totalPaid)}
              </div>
            </div>

          </div>

          <!-- Right: Action Buttons -->
          <div class="flex items-center gap-1.5 self-end md:self-center shrink-0">
            
            {#if group.latestOutstandingLoan}
              <button
                on:click={() => onOpenPayment({
                  ...group.latestOutstandingLoan,
                  amount: group.totalAmount,
                  total_paid: group.totalPaid,
                  balance: group.balance,
                  payment_allocations: group.oldestOutstandingLoans.map((loan) => ({
                    debt_id: loan.id,
                    balance: Number(loan.balance) || 0
                  })),
                  person_name: debt.person_name,
                  person_nickname: debt.person_nickname,
                  person_relationship: debt.person_relationship
                })}
                class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200 transition-colors flex items-center gap-1"
                title="Record repayment against the borrower's current balance"
              >
                <span>Pay</span>
              </button>
            {/if}

            {#if group.allPaid}
              <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg">
                <CheckCircle2 class="w-3.5 h-3.5" />
                Paid in Full
              </span>
            {/if}

            <button
              on:click={() => onOpenLoan(debt)}
              class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold rounded-lg border border-blue-200 transition-colors"
              title="Record a new loan for this borrower"
            >
              Loan
            </button>

          </div>

        </div>
      {/each}
    </div>

  {/if}

</div>
