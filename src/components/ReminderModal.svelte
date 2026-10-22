<script>
  import { X, Copy, Check, MessageSquare, Phone, Share2, Sparkles } from 'lucide-svelte';
  import { formatCurrency, formatDate } from '../lib/formatters.js';

  export let isOpen = false;
  export let debt = null;
  export let onClose = () => {};

  let tone = 'friendly_en'; // 'friendly_en', 'casual_en', 'short_sms', 'formal_en'
  let copied = false;

  $: nameToUse = (debt && (debt.person_nickname || debt.person_name)) || 'Friend';
  $: fullName = (debt && debt.person_name) || 'Friend';
  $: balanceStr = debt ? formatCurrency(debt.balance) : '₱0';
  $: reasonStr = debt ? debt.reason : '';
  $: dueDateStr = debt && debt.due_date ? formatDate(debt.due_date) : 'agreed schedule';

  $: reminderMessage = generateMessage(tone, nameToUse, fullName, balanceStr, reasonStr, dueDateStr);

  function generateMessage(selectedTone, nick, full, balance, reason, due) {
    switch (selectedTone) {
      case 'friendly_en':
        return `Hi ${nick}! Just a friendly reminder regarding your remaining balance of ${balance} for "${reason}" (Scheduled: ${due}). You can send your payment via GCash, Maya, or Cash whenever convenient. Thank you so much! 🙏`;
      
      case 'casual_en':
        return `Hey ${nick}! Hope you're doing well. Just checking in about the ${balance} balance for "${reason}". Let me know if you can settle or send a partial installment soon. Thanks a lot! 🙌`;

      case 'short_sms':
        return `Hi ${nick}, friendly reminder for your loan balance: ${balance} (${reason}). Due date: ${due}. Thank you!`;

      case 'formal_en':
        return `Dear ${full}, this is a gentle reminder regarding your outstanding loan balance of ${balance} for "${reason}", scheduled on ${due}. Please send payment via GCash or Bank Transfer at your earliest convenience. Thank you for your prompt attention.`;

      default:
        return '';
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(reminderMessage);
      copied = true;
      setTimeout(() => copied = false, 2500);
    } catch (e) {}
  }

  function sendViaSms() {
    if (!debt || !debt.person_phone) return;
    const cleanPhone = debt.person_phone.replace(/[^0-9+]/g, '');
    const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(reminderMessage)}`;
    window.open(smsUrl, '_blank');
  }

  async function shareWeb() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Loan Payment Reminder',
          text: reminderMessage,
        });
      } catch (e) {}
    } else {
      copyToClipboard();
    }
  }
</script>

{#if isOpen && debt}
  <div class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    
    <div class="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- Modal Header -->
      <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div class="flex items-center gap-2">
          <div class="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
            <Sparkles class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">Payment Reminder Generator</h3>
            <p class="text-xs text-slate-500">Generate polite and clear reminder messages.</p>
          </div>
        </div>
        <button
          on:click={onClose}
          class="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-6 space-y-5">
        
        <!-- Tone Selector Tabs -->
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Message Tone</label>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <button
              on:click={() => tone = 'friendly_en'}
              class={`p-2.5 rounded-xl border text-center transition-all ${
                tone === 'friendly_en'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-sm'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div>Friendly</div>
              <div class="text-[10px] text-slate-400">Polite & Gentle</div>
            </button>

            <button
              on:click={() => tone = 'casual_en'}
              class={`p-2.5 rounded-xl border text-center transition-all ${
                tone === 'casual_en'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-sm'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div>Casual</div>
              <div class="text-[10px] text-slate-400">Friends & Peers</div>
            </button>

            <button
              on:click={() => tone = 'short_sms'}
              class={`p-2.5 rounded-xl border text-center transition-all ${
                tone === 'short_sms'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-sm'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div>Short SMS</div>
              <div class="text-[10px] text-slate-400">Direct to point</div>
            </button>

            <button
              on:click={() => tone = 'formal_en'}
              class={`p-2.5 rounded-xl border text-center transition-all ${
                tone === 'formal_en'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-sm'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div>Formal</div>
              <div class="text-[10px] text-slate-400">Professional / Work</div>
            </button>
          </div>
        </div>

        <!-- Generated Message Box -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-bold text-slate-700 uppercase tracking-wider">Message Preview</span>
            <span class="text-[11px] text-slate-400">You can edit the text before sending</span>
          </div>

          <textarea
            bind:value={reminderMessage}
            rows="5"
            class="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm leading-relaxed text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
          ></textarea>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
          
          <div class="flex items-center gap-2">
            {#if debt.person_phone}
              <button
                on:click={sendViaSms}
                class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Phone class="w-3.5 h-3.5" />
                <span>Open in SMS ({debt.person_phone})</span>
              </button>
            {/if}

            <button
              on:click={shareWeb}
              class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Share2 class="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>

          <button
            on:click={copyToClipboard}
            class={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
              copied
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white'
            }`}
          >
            {#if copied}
              <Check class="w-4 h-4 stroke-[2.5]" />
              <span>Copied to Clipboard!</span>
            {:else}
              <Copy class="w-4 h-4" />
              <span>Copy Message</span>
            {/if}
          </button>

        </div>

      </div>

    </div>

  </div>
{/if}
