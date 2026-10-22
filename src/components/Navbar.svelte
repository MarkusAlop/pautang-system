<script>
  import { Wallet, Plus, Users, LayoutDashboard, FileSpreadsheet, Settings, Download } from 'lucide-svelte';
  
  export let activeTab = 'dashboard';
  export let onOpenAddDebt = () => {};
  export let canInstallApp = false;
  export let onInstallApp = () => {};
  export let onTabChange = (tab) => {};
  export let overdueCount = 0;
</script>

<header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      
      <!-- Brand Logo -->
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
          <Wallet class="w-5 h-5" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xl font-extrabold tracking-tight text-slate-900">Pautang<span class="text-emerald-600">Track</span></span>
          </div>
          <p class="text-xs text-slate-500 hidden sm:block">Money Lent & Debtors Management</p>
        </div>
      </div>

      <!-- Navigation Tabs (Desktop) -->
      <nav class="hidden md:flex items-center space-x-1">
        <button
          on:click={() => onTabChange('dashboard')}
          aria-current={activeTab === 'dashboard' ? 'page' : undefined}
          class={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'dashboard'
              ? 'bg-emerald-50 text-emerald-700 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <LayoutDashboard class="w-4 h-4" />
          Dashboard
        </button>

        <button
          on:click={() => onTabChange('debts')}
          aria-current={activeTab === 'debts' ? 'page' : undefined}
          class={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
            activeTab === 'debts'
              ? 'bg-emerald-50 text-emerald-700 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet class="w-4 h-4" />
          Loans
          {#if overdueCount > 0}
            <span class="px-1.5 py-0.2 bg-red-500 text-white text-[10px] font-bold rounded-full">
              {overdueCount}
            </span>
          {/if}
        </button>

        <button
          on:click={() => onTabChange('people')}
          aria-current={activeTab === 'people' ? 'page' : undefined}
          class={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'people'
              ? 'bg-emerald-50 text-emerald-700 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users class="w-4 h-4" />
          Borrowers
        </button>

        <button
          on:click={() => onTabChange('settings')}
          aria-current={activeTab === 'settings' ? 'page' : undefined}
          class={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'settings'
              ? 'bg-emerald-50 text-emerald-700 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Settings class="w-4 h-4" />
          Settings
        </button>
      </nav>

      <!-- Action Button -->
      <div class="flex items-center gap-3">
        {#if canInstallApp}
          <button
            type="button"
            on:click={onInstallApp}
            class="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-blue-700 hover:bg-blue-50 rounded-lg text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label="Install PautangTrack app"
            title="Install app"
          >
            <Download class="w-4 h-4" />
            <span class="hidden sm:inline">Install</span>
          </button>
        {/if}
        <button
          on:click={onOpenAddDebt}
          class="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm shadow-emerald-600/30 transition-all hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          aria-label="Record a new loan"
        >
          <Plus class="w-4 h-4 stroke-[2.5]" />
          <span class="hidden sm:inline">Record Loan</span>
          <span class="sm:hidden">Add Loan</span>
        </button>
      </div>

    </div>
  </div>

  <!-- Mobile Navigation Bar -->
  <div class="md:hidden flex border-t border-slate-200 bg-slate-50 px-2 py-1 justify-around text-xs">
    <button
      on:click={() => onTabChange('dashboard')}
      aria-current={activeTab === 'dashboard' ? 'page' : undefined}
      class={`flex flex-col items-center py-1.5 px-3 rounded-lg ${
        activeTab === 'dashboard' ? 'text-emerald-700 font-semibold bg-emerald-100/50' : 'text-slate-500'
      }`}
    >
      <LayoutDashboard class="w-4 h-4 mb-0.5" />
      Dashboard
    </button>
    <button
      on:click={() => onTabChange('debts')}
      aria-current={activeTab === 'debts' ? 'page' : undefined}
      class={`flex flex-col items-center py-1.5 px-3 rounded-lg relative ${
        activeTab === 'debts' ? 'text-emerald-700 font-semibold bg-emerald-100/50' : 'text-slate-500'
      }`}
    >
      <FileSpreadsheet class="w-4 h-4 mb-0.5" />
      Loans
      {#if overdueCount > 0}
        <span class="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
      {/if}
    </button>
    <button
      on:click={() => onTabChange('people')}
      aria-current={activeTab === 'people' ? 'page' : undefined}
      class={`flex flex-col items-center py-1.5 px-3 rounded-lg ${
        activeTab === 'people' ? 'text-emerald-700 font-semibold bg-emerald-100/50' : 'text-slate-500'
      }`}
    >
      <Users class="w-4 h-4 mb-0.5" />
      Borrowers
    </button>
    <button
      on:click={() => onTabChange('settings')}
      aria-current={activeTab === 'settings' ? 'page' : undefined}
      class={`flex flex-col items-center py-1.5 px-3 rounded-lg ${
        activeTab === 'settings' ? 'text-emerald-700 font-semibold bg-emerald-100/50' : 'text-slate-500'
      }`}
    >
      <Settings class="w-4 h-4 mb-0.5" />
      Settings
    </button>
  </div>
</header>
