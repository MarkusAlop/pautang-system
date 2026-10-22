<script>
  import { 
    Users, Plus, Phone, Search, ArrowDownLeft, 
    MoreVertical, Trash2, Edit3, MessageSquare, ChevronRight, UserPlus, X
  } from 'lucide-svelte';
  import { formatCurrency, getRelationshipBadge } from '../lib/formatters.js';

  export let people = [];
  export let onSelectPerson = (person) => {};
  export let onAddDebtForPerson = (person) => {};
  export let onSavePerson = async (data) => {};

  let searchQuery = '';
  let isAddPersonModalOpen = false;

  // Add borrower form state
  let newName = '';
  let newNickname = '';
  let newRelationship = 'Friend';
  let newPhone = '';
  let newNotes = '';
  let formError = '';
  let formLoading = false;

  $: filteredPeople = people.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.nickname && p.nickname.toLowerCase().includes(q)) ||
      (p.phone && p.phone.toLowerCase().includes(q)) ||
      (p.relationship && p.relationship.toLowerCase().includes(q))
    );
  });

  async function handleAddPersonSubmit() {
    formError = '';
    if (!newName.trim()) {
      formError = 'Please enter the borrower\'s full name.';
      return;
    }

    formLoading = true;
    try {
      await onSavePerson({
        name: newName.trim(),
        nickname: newNickname ? newNickname.trim() : null,
        relationship: newRelationship,
        phone: newPhone ? newPhone.trim() : null,
        notes: newNotes ? newNotes.trim() : null
      });

      newName = '';
      newNickname = '';
      newRelationship = 'Friend';
      newPhone = '';
      newNotes = '';
      isAddPersonModalOpen = false;
    } catch (e) {
      formError = e.message || 'An error occurred while saving.';
    } finally {
      formLoading = false;
    }
  }
</script>

<div class="space-y-5">
  
  <!-- Header Bar -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
    <div>
      <h2 class="text-lg font-bold text-slate-900 tracking-tight">Borrowers Directory (Contacts)</h2>
      <p class="text-xs text-slate-500">Directory of family, friends, and contacts who have active or past loans.</p>
    </div>

    <div class="flex items-center gap-3">
      <!-- Search Input -->
      <div class="relative">
        <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search borrowers..."
          class="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none w-48 sm:w-60"
        />
      </div>

      <button
        on:click={() => isAddPersonModalOpen = true}
        class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap"
      >
        <UserPlus class="w-4 h-4" />
        <span>Add Borrower</span>
      </button>
    </div>
  </div>

  <!-- People Grid -->
  {#if filteredPeople.length === 0}
    <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center">
      <div class="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
        <Users class="w-6 h-6" />
      </div>
      <h3 class="text-sm font-bold text-slate-800">No borrowers found</h3>
      <p class="text-xs text-slate-500 mt-1">
        {searchQuery ? 'Try searching with different keywords.' : 'Start by adding a contact or recording a pautang.'}
      </p>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each filteredPeople as person (person.id)}
        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          
          <div>
            <!-- Top Card Header -->
            <div class="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 class="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  {person.name}
                </h3>
                {#if person.nickname}
                  <span class="text-xs text-slate-500">"{person.nickname}"</span>
                {/if}
              </div>

              {#if person.relationship}
                <span class={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getRelationshipBadge(person.relationship)}`}>
                  {person.relationship}
                </span>
              {/if}
            </div>

            <!-- Balances Section -->
            <div class="space-y-1.5 my-3 py-3 border-y border-slate-100 text-xs">
              <div class="flex justify-between items-center">
                <span class="text-slate-500 flex items-center gap-1">
                  <ArrowDownLeft class="w-3.5 h-3.5 text-emerald-600" />
                  Outstanding Balance:
                </span>
                <span class={`font-mono font-bold ${person.outstanding_balance > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {formatCurrency(person.outstanding_balance)}
                </span>
              </div>

              <div class="flex justify-between items-center text-slate-500 text-[11px]">
                <span>Total Principal Lent:</span>
                <span class="font-mono">{formatCurrency(person.total_lent)}</span>
              </div>

              <div class="flex justify-between items-center text-slate-500 text-[11px]">
                <span>Total Repayments:</span>
                <span class="font-mono text-emerald-600">{formatCurrency(person.total_paid)}</span>
              </div>
            </div>

            <!-- Phone and Details -->
            <div class="text-[11px] text-slate-500 space-y-1">
              {#if person.phone}
                <div class="flex items-center gap-1.5">
                  <Phone class="w-3 h-3 text-slate-400" />
                  <a href={`tel:${person.phone}`} class="hover:text-emerald-600 font-mono">{person.phone}</a>
                </div>
              {/if}
              {#if person.notes}
                <div class="italic text-slate-400 truncate">"{person.notes}"</div>
              {/if}
            </div>

          </div>

          <!-- Bottom Actions -->
          <div class="pt-4 mt-2 flex items-center justify-between gap-2 border-t border-slate-100">
            <button
              on:click={() => onSelectPerson(person)}
              class="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
            >
              <span>View Loans ({person.total_loans_count || 0})</span>
              <ChevronRight class="w-3.5 h-3.5" />
            </button>

            <button
              on:click={() => onAddDebtForPerson(person)}
              class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Add New Loan</span>
            </button>
          </div>

        </div>
      {/each}
    </div>
  {/if}

</div>

<!-- Add Borrower Modal -->
{#if isAddPersonModalOpen}
  <div class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div>
          <h3 class="text-base font-bold text-slate-900">Add New Borrower</h3>
          <p class="text-xs text-slate-500">Save to your contacts list for easy loan logging.</p>
        </div>
        <button
          on:click={() => isAddPersonModalOpen = false}
          class="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <form on:submit|preventDefault={handleAddPersonSubmit} class="p-6 space-y-4">
        {#if formError}
          <div class="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {formError}
          </div>
        {/if}

        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Full Name *</label>
          <input
            type="text"
            bind:value={newName}
            placeholder="e.g. John Doe"
            class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nickname / Alias</label>
            <input
              type="text"
              bind:value={newNickname}
              placeholder="e.g. Johnny"
              class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Relationship</label>
            <select
              bind:value={newRelationship}
              class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="Family">Family</option>
              <option value="Friend">Friend</option>
              <option value="Colleague">Colleague / Work</option>
              <option value="Customer">Customer / Client</option>
              <option value="Neighbor">Neighbor</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Phone / Mobile Number</label>
          <input
            type="text"
            bind:value={newPhone}
            placeholder="0917-xxx-xxxx"
            class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Remarks / Notes (Optional)</label>
          <textarea
            bind:value={newNotes}
            rows="2"
            placeholder="e.g. Lives in neighboring barangay, works at..."
            class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          ></textarea>
        </div>

        <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            on:click={() => isAddPersonModalOpen = false}
            class="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold rounded-xl"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={formLoading}
            class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm"
          >
            {formLoading ? 'Saving...' : 'Save Borrower'}
          </button>
        </div>
      </form>

    </div>
  </div>
{/if}
