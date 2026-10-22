<script>
  import { X, User, DollarSign, Calendar, FileText, AlertCircle } from 'lucide-svelte';

  export let isOpen = false;
  export let person = null;
  export let onClose = () => {};
  export let onSubmit = async (data) => {};

  // New borrower fields
  let personName = '';
  let personRelationship = 'Friend';

  // Loan fields
  let amount = '';
  let reason = '';
  let dateIncurred = new Date().toISOString().split('T')[0];
  let dueDate = '';
  let notes = '';

  let loading = false;
  let error = '';

  const reasonsList = [
    'Emergency medical expenses',
    'Business capital / inventory',
    'Tuition fee / School supplies',
    'Car / Motorcycle repair',
    'Groceries / Food supplies',
    'Utility bills payment',
    'Personal loan'
  ];

  function resetForm() {
    personName = '';
    personRelationship = 'Friend';
    amount = '';
    reason = '';
    dateIncurred = new Date().toISOString().split('T')[0];
    dueDate = '';
    notes = '';
    error = '';
  }

  function setDueDateDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    dueDate = d.toISOString().split('T')[0];
  }

  function setDueEndOfMonth() {
    const now = new Date();
    const curDay = now.getDate();
    let target;
    if (curDay < 15) {
      target = new Date(now.getFullYear(), now.getMonth(), 15);
    } else {
      target = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    dueDate = target.toISOString().split('T')[0];
  }

  async function handleFormSubmit() {
    error = '';
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      error = 'Please enter a valid loan amount (₱).';
      return;
    }

    if (!reason.trim()) {
      error = 'Please enter the loan purpose or description.';
      return;
    }

    if (!person) {
      if (!personName.trim()) {
        error = 'Please enter the borrower\'s name.';
        return;
      }
    }

    loading = true;
    try {
      const payload = {
        type: 'lent',
        amount: Number(amount),
        reason: reason.trim(),
        date_incurred: dateIncurred,
        due_date: dueDate || null,
        notes: notes ? notes.trim() : null
      };

      if (person) {
        payload.person_id = Number(person.id);
      } else {
        payload.person_name = personName.trim();
        payload.person_relationship = personRelationship;
      }

      await onSubmit(payload);
      resetForm();
      onClose();
    } catch (err) {
      error = err.message || 'An error occurred while saving the loan.';
    } finally {
      loading = false;
    }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    
    <div class="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- Modal Header -->
      <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div>
          <h3 class="text-base font-bold text-slate-900">{person ? 'Add New Loan' : 'Record New Pautang'}</h3>
          <p class="text-xs text-slate-500">
            {person ? 'Add another loan for this borrower.' : 'Log money you lent to a family member, friend, or contact.'}
          </p>
        </div>
        <button
          on:click={onClose}
          class="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Modal Body Form -->
      <form on:submit|preventDefault={handleFormSubmit} class="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
        
        {#if error}
          <div class="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle class="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        {/if}

        <!-- 1. Borrower Information -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Who borrowed the money? (Borrower)
            </label>
          </div>

          {#if person}
            <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div class="text-sm font-semibold text-slate-900">{person.name}</div>
              {#if person.relationship}
                <div class="text-xs text-slate-500 mt-0.5">{person.relationship}</div>
              {/if}
            </div>
          {:else}
            <!-- New Borrower Inputs -->
            <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
              <div>
                <input
                  type="text"
                  bind:value={personName}
                  placeholder="Full Name (e.g. John Doe)"
                  class="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              
              <div>
                <select
                  bind:value={personRelationship}
                  class="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
          {/if}
        </div>

        <!-- 2. Loan Amount -->
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Amount Lent (PHP ₱)
          </label>
          <div class="relative">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">₱</span>
            <input
              type="number"
              step="any"
              min="1"
              bind:value={amount}
              placeholder="0.00"
              class="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>
          <!-- Quick Amount Buttons -->
          <div class="flex flex-wrap gap-1.5 mt-2">
            {#each [500, 1000, 2000, 5000, 10000] as preset}
              <button
                type="button"
                on:click={() => amount = preset}
                class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors font-mono"
              >
                +₱{preset.toLocaleString()}
              </button>
            {/each}
          </div>
        </div>

        <!-- 3. Loan Purpose / Reason -->
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Purpose / Description
          </label>
          <input
            type="text"
            bind:value={reason}
            placeholder="e.g. Emergency medical expenses, Grocery share, Business capital..."
            class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
          />
          <!-- Quick suggestions -->
          <div class="flex flex-wrap gap-1 mt-2">
            {#each reasonsList.slice(0, 4) as r}
              <button
                type="button"
                on:click={() => reason = r}
                class="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] rounded-md transition-colors"
              >
                {r}
              </button>
            {/each}
          </div>
        </div>

        <!-- 4. Dates: Date Incurred & Due Date -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Date Lent</label>
            <input
              type="date"
              bind:value={dateIncurred}
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-bold text-slate-700 uppercase tracking-wider">Due Date (Optional)</label>
            </div>
            <input
              type="date"
              bind:value={dueDate}
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <!-- Quick preset due dates -->
            <div class="flex gap-1 mt-1 text-[10px]">
              <button type="button" on:click={() => setDueDateDays(7)} class="text-emerald-700 hover:underline">+7 days</button>
              <span>•</span>
              <button type="button" on:click={setDueEndOfMonth} class="text-emerald-700 hover:underline">15th / End of Month</button>
              <span>•</span>
              <button type="button" on:click={() => setDueDateDays(30)} class="text-emerald-700 hover:underline">+30 days</button>
            </div>
          </div>
        </div>

        <!-- 5. Additional Notes -->
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Additional Notes / Agreement</label>
          <textarea
            bind:value={notes}
            rows="2"
            placeholder="e.g. Promised to transfer via GCash on upcoming cutoff..."
            class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
          ></textarea>
        </div>

        <!-- Modal Actions -->
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
            class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-600/30 transition-all"
          >
            {loading ? 'Saving...' : person ? 'Add Loan' : 'Save Pautang'}
          </button>
        </div>

      </form>

    </div>

  </div>
{/if}
