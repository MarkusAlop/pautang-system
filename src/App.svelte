<script>
  import { onMount } from 'svelte';
  import { api } from './lib/api.js';
  import Navbar from './components/Navbar.svelte';
  import DashboardStats from './components/DashboardStats.svelte';
  import DebtsList from './components/DebtsList.svelte';
  import PeopleView from './components/PeopleView.svelte';
  import BackupModal from './components/BackupModal.svelte';
  import AddDebtModal from './components/AddDebtModal.svelte';
  import AddPaymentModal from './components/AddPaymentModal.svelte';
  import DebtDetailModal from './components/DebtDetailModal.svelte';
  import StatementModal from './components/StatementModal.svelte';
  import PersonDetailModal from './components/PersonDetailModal.svelte';
  import { Plus, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-svelte';
  import { formatCurrency } from './lib/formatters.js';

  // Navigation State
  let activeTab = 'dashboard'; // 'dashboard', 'debts', 'people', 'settings'
  let filterStatus = 'all';
  let searchQuery = '';

  // Data States
  let stats = {
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
  let debts = [];
  let people = [];
  let toast = null;
  let loading = true;
  let isOnline = typeof navigator === 'undefined' || navigator.onLine;
  let pendingSyncCount = 0;
  let syncingOfflineRecords = false;
  let offlineSyncError = '';
  let installPrompt = null;

  // Modals state
  let isAddDebtOpen = false;
  let isAddPaymentOpen = false;
  let isDebtDetailOpen = false;
  let isStatementOpen = false;
  let isPersonDetailOpen = false;

  let activeDebt = null;
  let activePerson = null;
  let reopenDebtAfterPayment = false;

  function showToast(message, type = 'success') {
    toast = { message, type };
    setTimeout(() => toast = null, 3500);
  }

  async function refreshData() {
    loading = true;
    try {
      const [nextStats, nextDebts, nextPeople] = await Promise.all([
        api.getStats(),
        api.getDebts(),
        api.getPeople(),
      ]);
      stats = nextStats;
      debts = nextDebts;
      people = nextPeople;
    } finally {
      loading = false;
    }
  }

  async function loadOfflineData() {
    loading = true;
    try {
      const snapshot = await api.getOfflineSnapshot();
      stats = snapshot.stats;
      debts = snapshot.debts;
      people = snapshot.people;
    } finally {
      loading = false;
    }
  }

  async function handleInstallApp() {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    await prompt.prompt();
    await prompt.userChoice;
  }

  async function syncOfflineRecords() {
    if (!isOnline || syncingOfflineRecords) return;
    syncingOfflineRecords = true;
    offlineSyncError = '';
    try {
      const queuedBeforeSync = await api.getPendingOperationCount();
      if (!queuedBeforeSync) {
        await refreshData();
        return;
      }

      const result = await api.syncOfflineChanges();
      pendingSyncCount = result.pending;
      if (result.error) {
        offlineSyncError = result.error;
        await loadOfflineData();
        return;
      }

      if (result.pending > 0) {
        await loadOfflineData();
      } else if (result.synced > 0) {
        await refreshData();
        if (isPersonDetailOpen && activePerson) {
          const personId = result.idMappings?.people?.[String(activePerson.id)] || activePerson.id;
          activePerson = await api.getPerson(personId);
        }
        if (isDebtDetailOpen && activeDebt) {
          const debtId = result.idMappings?.debts?.[String(activeDebt.id)] || activeDebt.id;
          activeDebt = await api.getDebt(debtId);
        }
        showToast(`${result.synced} offline record${result.synced === 1 ? '' : 's'} synced.`);
      }
    } catch (error) {
      offlineSyncError = error.message || 'Could not sync offline records.';
    } finally {
      syncingOfflineRecords = false;
    }
  }

  onMount(() => {
    const handleOnline = () => {
      isOnline = true;
      void syncOfflineRecords();
    };
    const handleOffline = () => {
      isOnline = false;
    };
    const handleQueuedRecords = (event) => {
      pendingSyncCount = event.detail?.count || 0;
    };
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      installPrompt = event;
    };
    const handleAppInstalled = () => {
      installPrompt = null;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pautang:offline-queue', handleQueuedRecords);
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    void (async () => {
      isOnline = navigator.onLine;
      pendingSyncCount = await api.getPendingOperationCount();
      if (isOnline) {
        await syncOfflineRecords();
      } else {
        await loadOfflineData();
      }
    })();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pautang:offline-queue', handleQueuedRecords);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  });

  // Action handlers
  function handleOpenAddDebt() {
    activePerson = null;
    isAddDebtOpen = true;
  }

  async function handleCreateDebt(data) {
    const borrowerName = activePerson?.name;
    await api.createDebt(data);
    await refreshData();
    if (data.person_id) {
      activePerson = await api.getPerson(data.person_id);
      isPersonDetailOpen = true;
      showToast(`${borrowerName || activePerson.name} borrowed an additional ${formatCurrency(data.amount)}.`);
    } else {
      showToast('New pautang record successfully saved!');
    }
  }

  async function handleUpdateDebtAmount(debt, amount) {
    await api.updateDebt(debt.id, { amount });
    activeDebt = await api.getDebt(debt.id);
    await refreshData();
    showToast('Loan amount updated.');
  }

  async function handleOpenDebtDetail(debt) {
    try {
      const full = await api.getDebt(debt.id);
      activeDebt = full;
      isDebtDetailOpen = true;
    } catch (e) {
      activeDebt = debt;
      isDebtDetailOpen = true;
    }
  }

  function handleOpenPayment(debt, reopenDebtAfter = false) {
    activeDebt = debt;
    reopenDebtAfterPayment = reopenDebtAfter;
    isAddPaymentOpen = true;
  }

  async function handleRecordPayment(paymentData) {
    const res = await api.createPayment(paymentData);
    await refreshData();
    if (reopenDebtAfterPayment) {
      activeDebt = await api.getDebt(paymentData.debt_id);
      isDebtDetailOpen = true;
      reopenDebtAfterPayment = false;
    }
    showToast(
      res.is_settled 
        ? 'Great! This loan has been fully settled! 🎉' 
        : 'Payment successfully recorded!'
    );
    return res;
  }

  function handleOpenStatement(debt) {
    activeDebt = debt;
    isStatementOpen = true;
  }

  async function handleDeleteDebt(debt) {
    if (confirm(`Are you sure you want to delete this loan record?`)) {
      try {
        await api.deleteDebt(debt.id);
        await refreshData();
        showToast('Loan record deleted.');
        isDebtDetailOpen = false;
      } catch (e) {
        showToast(e.message, 'error');
      }
    }
  }

  async function handleDeletePayment(paymentId) {
    if (confirm('Are you sure you want to delete this payment record?')) {
      try {
        await api.deletePayment(paymentId);
        await refreshData();
        showToast('Payment record deleted.');
      } catch (e) {
        showToast(e.message, 'error');
      }
    }
  }

  async function handleUpdatePayment(paymentId, amount) {
    await api.updatePayment(paymentId, { amount });
    activeDebt = await api.getDebt(activeDebt.id);
    await refreshData();
    showToast('Payment amount updated.');
  }

  async function handleSelectPerson(person) {
    try {
      const fullPerson = await api.getPerson(person.id);
      activePerson = fullPerson;
      isPersonDetailOpen = true;
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function handleAddDebtForPerson(person) {
    activePerson = person;
    isPersonDetailOpen = false;
    isAddDebtOpen = true;
  }

  async function handleSavePerson(data) {
    await api.createPerson(data);
    await refreshData();
    showToast('Borrower successfully added to directory!');
  }

  async function handleDeletePerson(person) {
    if (confirm(`Are you sure you want to delete ${person.name} and all their loan history?`)) {
      try {
        await api.deletePerson(person.id);
        await refreshData();
        showToast('Borrower and associated records deleted.');
        isPersonDetailOpen = false;
      } catch (e) {
        showToast(e.message, 'error');
      }
    }
  }

  function handleViewOverdue() {
    activeTab = 'debts';
    filterStatus = 'overdue';
  }
</script>

<div class="app-shell min-h-screen flex flex-col bg-slate-50 selection:bg-emerald-500 selection:text-white">
  
  <!-- Navigation Header -->
  <Navbar 
    {activeTab}
    canInstallApp={Boolean(installPrompt)}
    onInstallApp={handleInstallApp}
    overdueCount={stats.overdue_count}
    onOpenAddDebt={handleOpenAddDebt}
    onTabChange={(tab) => {
      activeTab = tab;
      if (tab === 'debts') {
        filterStatus = 'all';
      }
    }}
  />

  {#if !isOnline || pendingSyncCount > 0}
    <div class={`px-4 py-2 text-xs ${isOnline ? 'bg-blue-50 text-blue-900 border-b border-blue-200' : 'bg-amber-50 text-amber-900 border-b border-amber-200'}`} role="status" aria-live="polite">
      <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <span>
          {#if isOnline}
            {syncingOfflineRecords ? 'Syncing offline records…' : `${pendingSyncCount} record${pendingSyncCount === 1 ? '' : 's'} waiting to sync.`}
          {:else}
            Offline mode. This device shows saved data; new borrowers, loans, and payments will sync when you reconnect.
          {/if}
          {#if offlineSyncError}<span class="block text-red-700 mt-1">{offlineSyncError}</span>{/if}
        </span>
        {#if isOnline && pendingSyncCount > 0 && !syncingOfflineRecords}
          <button type="button" on:click={syncOfflineRecords} class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold">
            Sync now
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Toast Notification -->
  {#if toast}
    <div class={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold transition-all animate-in slide-in-from-bottom-5 ${
      toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
    }`}>
      {#if toast.type === 'error'}
        <AlertCircle class="w-4 h-4 text-red-200" />
      {:else}
        <CheckCircle2 class="w-4 h-4 text-emerald-400" />
      {/if}
      <span>{toast.message}</span>
    </div>
  {/if}

  <!-- Main Content Layout -->
  <main class="app-main flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
    
    {#if loading}
      <div class="p-20 text-center text-slate-400 text-sm">
        <div class="w-8 h-8 mx-auto border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        Loading Pautang Tracker...
      </div>
    {:else}
      <section class="page-heading" aria-label="Current page">
        <div>
          <p class="page-eyebrow">YOUR PERSONAL LEDGER</p>
          <h1>
            {#if activeTab === 'dashboard'}
              Money, made easier.
            {:else if activeTab === 'debts'}
              Your loan ledger
            {:else if activeTab === 'people'}
              People you trust
            {:else}
              Your data & settings
            {/if}
          </h1>
          <p class="page-description">
            {#if activeTab === 'dashboard'}
              A clear picture of what’s lent, collected, and still to come.
            {:else if activeTab === 'debts'}
              Keep every loan, due date, and repayment in one place.
            {:else if activeTab === 'people'}
              Borrower details and their complete loan history.
            {:else}
              Back up, export, and manage your PautangTrack data.
            {/if}
          </p>
        </div>
        <div class="ledger-status">
          <span class:offline={!isOnline} class="status-dot"></span>
          {isOnline ? 'All changes up to date' : 'Offline · saved on this device'}
        </div>
      </section>

      <!-- TAB 1: DASHBOARD -->
      {#if activeTab === 'dashboard'}
        <div class="space-y-8">
          
          <!-- Key Statistics -->
          <DashboardStats 
            {stats}
            onViewOverdue={handleViewOverdue}
          />

          <!-- Welcome banner if empty -->
          {#if debts.length === 0}
            <div class="bg-gradient-to-r from-emerald-600 to-blue-800 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
              <div class="max-w-xl space-y-4">
                <span class="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold tracking-wide uppercase">
                  Welcome to PautangTrack
                </span>
                <h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  No active loan records yet.
                </h2>
                <p class="text-sm text-emerald-100 leading-relaxed">
                  Record and track money you have lent to family members, relatives, friends, or customers so you never lose track of balances and due dates.
                </p>
                <div class="flex flex-wrap gap-3 pt-2">
                  <button
                    on:click={handleOpenAddDebt}
                    class="px-5 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Plus class="w-4 h-4" />
                    <span>Record First Pautang</span>
                  </button>

                </div>
              </div>
            </div>
          {/if}

          <!-- Debts Ledger Table on Dashboard -->
          <div>
            <DebtsList
              {debts}
              bind:filterStatus
              bind:searchQuery
              onSelectDebt={handleOpenDebtDetail}
              onOpenPayment={handleOpenPayment}
              onOpenAddDebt={handleOpenAddDebt}
              onDeleteDebt={handleDeleteDebt}
            />
          </div>

        </div>

      <!-- TAB 2: PAUTANG LIST -->
      {:else if activeTab === 'debts'}
        <div>
          <DebtsList
            {debts}
            bind:filterStatus
            bind:searchQuery
            onSelectDebt={handleOpenDebtDetail}
            onOpenPayment={handleOpenPayment}
            onOpenAddDebt={handleOpenAddDebt}
            onDeleteDebt={handleDeleteDebt}
          />
        </div>

      <!-- TAB 3: BORROWERS & CONTACTS -->
      {:else if activeTab === 'people'}
        <div>
          <PeopleView
            {people}
            onSelectPerson={handleSelectPerson}
            onAddDebtForPerson={handleAddDebtForPerson}
            onSavePerson={handleSavePerson}
            onDeletePerson={handleDeletePerson}
          />
        </div>

      <!-- TAB 4: BACKUP & SETTINGS -->
      {:else if activeTab === 'settings'}
        <div>
          <BackupModal onRefresh={refreshData} />
        </div>

      {/if}

    {/if}

  </main>

  <!-- Footer -->
  <footer class="app-footer border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500 no-print">
    <div class="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
      <div class="flex flex-col items-center gap-0.5 sm:items-start">
        <div class="flex items-center gap-1">
          <span class="font-bold text-slate-700">PautangTrack</span>
          <span>• Money Lent & Debtors Management System</span>
        </div>
        <span class="text-[10px] text-slate-400">Created by Markus Alop · 2026 Pautang Track</span>
      </div>
      <div class="text-[11px] text-slate-400">
        Saved to local SQLite database: <code class="font-mono bg-slate-100 px-1 py-0.5 rounded">data/utang.sqlite</code>
      </div>
    </div>
  </footer>

  <!-- MODALS -->
  <AddDebtModal
    isOpen={isAddDebtOpen}
    person={activePerson}
    onClose={() => isAddDebtOpen = false}
    onSubmit={handleCreateDebt}
  />

  <AddPaymentModal
    isOpen={isAddPaymentOpen}
    debt={activeDebt}
    onClose={() => isAddPaymentOpen = false}
    onSubmit={handleRecordPayment}
  />

  <DebtDetailModal
    isOpen={isDebtDetailOpen}
    debt={activeDebt}
    onClose={() => isDebtDetailOpen = false}
    onOpenPayment={(d) => { isDebtDetailOpen = false; handleOpenPayment(d, true); }}
    onOpenStatement={(d) => { isDebtDetailOpen = false; handleOpenStatement(d); }}
    onUpdateAmount={handleUpdateDebtAmount}
    onDeleteDebt={handleDeleteDebt}
    onUpdatePayment={handleUpdatePayment}
    onDeletePayment={handleDeletePayment}
  />

  <StatementModal
    isOpen={isStatementOpen}
    debt={activeDebt}
    onClose={() => isStatementOpen = false}
  />

  <PersonDetailModal
    isOpen={isPersonDetailOpen}
    person={activePerson}
    onClose={() => isPersonDetailOpen = false}
    onSelectDebt={(d) => { isPersonDetailOpen = false; handleOpenDebtDetail(d); }}
    onAddDebtForPerson={handleAddDebtForPerson}
    onDeletePerson={handleDeletePerson}
  />

</div>
