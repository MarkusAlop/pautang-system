<script>
  import { 
    Download, Database, Trash2, RefreshCw,
    CheckCircle2, AlertTriangle, FileSpreadsheet, ShieldAlert, Upload
  } from 'lucide-svelte';
  import { api } from '../lib/api.js';
  import { QR_PAYMENT_METHODS, getPaymentQrFilePath, loadPaymentQrs, removePaymentQr, savePaymentQr } from '../lib/paymentQrs.js';

  export let onRefresh = async () => {};

  let message = '';
  let error = '';
  let loading = false;
  let confirmReset = false;
  let paymentQrs = loadPaymentQrs();
  let missingFolderQrs = {};
  let qrMessage = '';
  let qrError = '';

  async function prepareQrImage(file) {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Choose a QR image smaller than 5 MB.');
    }

    const bitmap = await createImageBitmap(file);
    const maxStoredSize = 400 * 1024;
    let dimension = 1400;
    let blob = null;

    while (dimension >= 560) {
      const scale = Math.min(1, dimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));

      const context = canvas.getContext('2d');
      if (!context) break;
      context.imageSmoothingEnabled = false;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob && blob.size <= maxStoredSize) break;
      dimension = Math.floor(dimension * 0.8);
    }

    bitmap.close();
    if (!blob || blob.size > maxStoredSize) {
      throw new Error('Could not shrink this QR image enough. Try a cleaner or cropped image.');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read the optimized QR image.'));
      reader.readAsDataURL(blob);
    });
  }

  function handleFolderQrError(method) {
    missingFolderQrs = { ...missingFolderQrs, [method]: true };
  }

  async function handleQrUpload(method, event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    qrMessage = '';
    qrError = '';

    if (!file) return;
    if (!file.type.startsWith('image/')) {
      qrError = 'Choose an image file for the QR code.';
      return;
    }

    try {
      const optimizedImage = await prepareQrImage(file);
      paymentQrs = savePaymentQr(method, optimizedImage);
      missingFolderQrs = { ...missingFolderQrs, [method]: false };
      qrMessage = `${method} QR saved in this browser.`;
    } catch (uploadError) {
      qrError = uploadError.message || 'Could not save the QR image. Try a smaller image.';
    }
  }

  function handleRemoveQr(method) {
    paymentQrs = removePaymentQr(method);
    missingFolderQrs = { ...missingFolderQrs, [method]: false };
    qrMessage = `${method} browser upload removed. A folder image will be used if available.`;
    qrError = '';
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
    <p class="text-xs text-slate-500">Export your loan ledger to Excel/CSV or manage your local database.</p>
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

    <!-- 2. SQLite Database Storage Info -->
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

    <!-- 3. Danger Zone: Reset All Data -->
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

  <section class="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
    <div class="mb-4">
      <h3 class="text-sm font-bold text-slate-900">Payment QR Codes</h3>
      <p class="text-xs text-slate-500 mt-1">Upload your own QR image for each payment method. Images are saved in this browser.</p>
    </div>

    {#if qrMessage}
      <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800" role="status">
        {qrMessage}
      </div>
    {/if}
    {#if qrError}
      <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700" role="alert">
        {qrError}
      </div>
    {/if}

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {#each QR_PAYMENT_METHODS as method}
        {@const folderQrPath = getPaymentQrFilePath(method)}
        {@const qrIsAvailable = Boolean(paymentQrs[method]) || !missingFolderQrs[method]}
        <div class="border border-slate-200 rounded-xl p-3 flex flex-col gap-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-slate-800">{method}</span>
            <span class={`text-[10px] font-semibold ${qrIsAvailable ? 'text-blue-700' : 'text-slate-400'}`}>
              {qrIsAvailable ? 'QR ready' : 'Not set'}
            </span>
          </div>

          {#if paymentQrs[method]}
            <img src={paymentQrs[method]} alt={`${method} payment QR`} class="w-full aspect-square object-contain bg-white rounded-lg border border-slate-100" />
          {:else if !missingFolderQrs[method]}
            <img src={folderQrPath} alt={`${method} payment QR`} on:error={() => handleFolderQrError(method)} class="w-full aspect-square object-contain bg-white rounded-lg border border-slate-100" />
          {:else}
            <div class="w-full aspect-square bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-[11px] text-slate-400">
              No image uploaded
            </div>
          {/if}

          <label class="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors">
            <Upload class="w-3.5 h-3.5" />
            <span>{paymentQrs[method] ? 'Replace QR' : 'Upload QR'}</span>
            <input type="file" accept="image/*" class="sr-only" on:change={(event) => handleQrUpload(method, event)} />
          </label>

          {#if paymentQrs[method]}
            <button type="button" on:click={() => handleRemoveQr(method)} class="text-xs text-slate-500 hover:text-red-600">
              Remove QR
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </section>

</div>
