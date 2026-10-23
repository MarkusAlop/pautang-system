<script>
  import { X, User, DollarSign, Calendar, FileText, AlertCircle } from 'lucide-svelte';
  import { formatAmount, handleAmountInput } from '../lib/formatters.js';
  import { getPhilippineDateString } from '../lib/dateTime.js';

  export let isOpen = false;
  export let person = null;
  export let onClose = () => {};
  export let onSubmit = async (data) => {};

  // New borrower fields
  let personName = '';
  let personRelationship = '';
  let customPersonRelationship = '';

  // Loan fields
  let amount = '';
  let reason = '';
  let dateIncurred = getCurrentPhilippineDate();
  let dueDate = '';
  let notes = '';

  let loading = false;
  let error = '';
  let fieldErrors = {};

  function getCurrentPhilippineDate() {
    return getPhilippineDateString();
  }

  function resetForm() {
    personName = '';
    personRelationship = '';
    customPersonRelationship = '';
    amount = '';
    reason = '';
    dateIncurred = getCurrentPhilippineDate();
    dueDate = '';
    notes = '';
    error = '';
    fieldErrors = {};
  }

  function clearFieldError(field) {
    if (!fieldErrors[field]) return;
    const nextErrors = { ...fieldErrors };
    delete nextErrors[field];
    fieldErrors = nextErrors;
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleFormSubmit() {
    error = '';
    const nextFieldErrors = {};

    if (!person) {
      if (!personName.trim()) {
        nextFieldErrors.personName = 'Enter the borrower name.';
      }
      if (!personRelationship) {
        nextFieldErrors.personRelationship = 'Select a relationship.';
      }
      if (personRelationship === 'Other' && !customPersonRelationship.trim()) {
        nextFieldErrors.customPersonRelationship = 'Enter the other relationship.';
      }
    }

    const numericAmount = Number(amount);
    if (!amount) {
      nextFieldErrors.amount = 'Enter the amount lent.';
    } else if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      nextFieldErrors.amount = 'Enter a valid amount.';
    }
    if (!reason.trim()) {
      nextFieldErrors.reason = 'Enter a purpose or description.';
    }

    fieldErrors = nextFieldErrors;
    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    loading = true;
    try {
      const payload = {
        type: 'lent',
        amount: numericAmount,
        reason: reason.trim(),
        date_incurred: dateIncurred,
        due_date: dueDate || null,
        notes: notes ? notes.trim() : null
      };

      if (person) {
        payload.person_id = Number(person.id);
      } else {
        payload.person_name = personName.trim();
        payload.person_relationship = personRelationship === 'Other'
          ? customPersonRelationship.trim()
          : personRelationship;
      }

      await onSubmit(payload);
      handleClose();
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
          on:click={handleClose}
          class="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Modal Body Form -->
      <form novalidate on:submit|preventDefault={handleFormSubmit} class="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
        
        {#if error}
          <div role="alert" aria-live="assertive" class="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
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
                <label for="new-loan-person-name" class="block text-xs font-semibold text-slate-600 mb-1.5">
                  Borrower name <span class="text-rose-600">*</span>
                </label>
                <input
                  id="new-loan-person-name"
                  type="text"
                  bind:value={personName}
                  on:input={() => clearFieldError('personName')}
                  required
                  placeholder="Full Name (e.g. John Doe)"
                  aria-invalid={Boolean(fieldErrors.personName)}
                  aria-describedby={fieldErrors.personName ? 'new-loan-person-name-error' : undefined}
                  class={`w-full px-3.5 py-2 bg-white border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none ${fieldErrors.personName ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                />
                {#if fieldErrors.personName}
                  <p id="new-loan-person-name-error" class="mt-1 text-xs text-red-600" role="alert">{fieldErrors.personName}</p>
                {/if}
              </div>
              
              <div>
                <label for="new-loan-relationship" class="block text-xs font-semibold text-slate-600 mb-1.5">
                  Relationship <span class="text-rose-600">*</span>
                </label>
                <select
                  id="new-loan-relationship"
                  bind:value={personRelationship}
                  on:change={() => {
                    clearFieldError('personRelationship');
                    clearFieldError('customPersonRelationship');
                  }}
                  required
                  aria-invalid={Boolean(fieldErrors.personRelationship)}
                  aria-describedby={fieldErrors.personRelationship ? 'new-loan-relationship-error' : undefined}
                  class={`w-full px-3.5 py-2 bg-white border rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none ${fieldErrors.personRelationship ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                >
                  <option value="" disabled>Select a relationship</option>
                  <option value="Family member">Family member</option>
                  <option value="Friend">Friend</option>
                  <option value="Relative">Relative</option>
                  <option value="Other">Other</option>
                </select>
                {#if fieldErrors.personRelationship}
                  <p id="new-loan-relationship-error" class="mt-1 text-xs text-red-600" role="alert">{fieldErrors.personRelationship}</p>
                {/if}
                {#if personRelationship === 'Other'}
                  <input
                    type="text"
                    bind:value={customPersonRelationship}
                    on:input={() => clearFieldError('customPersonRelationship')}
                    required
                    placeholder="Other relationship"
                    aria-invalid={Boolean(fieldErrors.customPersonRelationship)}
                    aria-describedby={fieldErrors.customPersonRelationship ? 'new-loan-custom-relationship-error' : undefined}
                    class={`custom-relationship-input mt-2 w-full px-3.5 py-2 bg-white border rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none ${fieldErrors.customPersonRelationship ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                  />
                  {#if fieldErrors.customPersonRelationship}
                    <p id="new-loan-custom-relationship-error" class="mt-1 text-xs text-red-600" role="alert">{fieldErrors.customPersonRelationship}</p>
                  {/if}
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <!-- 2. Loan Amount -->
        <div>
          <label for="new-loan-amount" class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Amount Lent (PHP ₱) <span class="text-rose-600">*</span>
          </label>
          <div class="relative">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">₱</span>
            <input
              id="new-loan-amount"
              type="text"
              inputmode="decimal"
              value={formatAmount(amount)}
              on:input={(event) => handleAmountInput(event, (value) => {
                amount = value;
                clearFieldError('amount');
              })}
              required
              placeholder="0.00"
              aria-invalid={Boolean(fieldErrors.amount)}
              aria-describedby={fieldErrors.amount ? 'new-loan-amount-error' : undefined}
              class={`w-full pl-9 pr-4 py-2.5 bg-slate-50 border rounded-xl text-lg font-bold font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none ${fieldErrors.amount ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
            />
          </div>
          {#if fieldErrors.amount}
            <p id="new-loan-amount-error" class="mt-1 text-xs text-red-600" role="alert">{fieldErrors.amount}</p>
          {/if}
        </div>

        <!-- 3. Loan Purpose / Reason -->
        <div>
          <label for="loan-purpose" class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Purpose / Description <span class="text-rose-600">*</span>
          </label>
          <input
            id="loan-purpose"
            type="text"
            bind:value={reason}
            on:input={() => clearFieldError('reason')}
            required
            placeholder="Enter a purpose or description"
            aria-invalid={Boolean(fieldErrors.reason)}
            aria-describedby={fieldErrors.reason ? 'loan-purpose-error' : undefined}
            class={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none ${fieldErrors.reason ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
          />
          {#if fieldErrors.reason}
            <p id="loan-purpose-error" class="mt-1 text-xs text-red-600" role="alert">{fieldErrors.reason}</p>
          {/if}
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
          </div>
        </div>

        <!-- 5. Additional Notes -->
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Additional Notes / Agreement (Optional)</label>
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
            on:click={handleClose}
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
