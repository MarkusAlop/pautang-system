<script>
  import { Wallet, Plus, Users, LayoutDashboard, FileSpreadsheet, Settings, Download } from 'lucide-svelte';

  export let activeTab = 'dashboard';
  export let onOpenAddDebt = () => {};
  export let canInstallApp = false;
  export let onInstallApp = () => {};
  export let onTabChange = (tab) => {};
  export let overdueCount = 0;

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'debts', label: 'Loans', icon: FileSpreadsheet },
    { id: 'people', label: 'Borrowers', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];
</script>

<header class="app-header no-print">
  <div class="app-header-inner">
    <a class="brand" href="#dashboard" on:click|preventDefault={() => onTabChange('dashboard')} aria-label="PautangTrack home">
      <span class="brand-mark"><Wallet class="w-5 h-5" /></span>
      <span class="brand-copy">
        <span class="brand-name">pautang<span>track</span></span>
        <span class="brand-caption">A calmer way to keep tabs</span>
      </span>
    </a>

    <nav class="desktop-nav" aria-label="Main navigation">
      {#each tabs as tab}
        <button
          type="button"
          on:click={() => onTabChange(tab.id)}
          aria-current={activeTab === tab.id ? 'page' : undefined}
          class:active={activeTab === tab.id}
          class="nav-link"
        >
          <svelte:component this={tab.icon} class="w-4 h-4" />
          <span>{tab.label}</span>
          {#if tab.id === 'debts' && overdueCount > 0}
            <span class="nav-count">{overdueCount}</span>
          {/if}
        </button>
      {/each}
    </nav>

    <div class="header-actions">
      {#if canInstallApp}
        <button type="button" on:click={onInstallApp} class="install-button" aria-label="Install PautangTrack app" title="Install app">
          <Download class="w-4 h-4" />
          <span>Install</span>
        </button>
      {/if}
      <button type="button" on:click={onOpenAddDebt} class="add-loan-button" aria-label="Record a new loan">
        <Plus class="w-4 h-4 stroke-[2.5]" />
        <span>Record loan</span>
      </button>
    </div>
  </div>

  <nav class="mobile-nav" aria-label="Main navigation">
    {#each tabs as tab}
      <button
        type="button"
        on:click={() => onTabChange(tab.id)}
        aria-current={activeTab === tab.id ? 'page' : undefined}
        class:active={activeTab === tab.id}
        class="mobile-nav-link"
      >
        <span class="mobile-nav-icon">
          <svelte:component this={tab.icon} class="w-5 h-5" />
          {#if tab.id === 'debts' && overdueCount > 0}
            <span class="mobile-nav-count">{overdueCount}</span>
          {/if}
        </span>
        <span>{tab.label}</span>
      </button>
    {/each}
  </nav>
</header>
