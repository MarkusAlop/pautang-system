<script>
  import { createEventDispatcher } from 'svelte';
  import { ArrowRight, LockKeyhole, Wallet } from 'lucide-svelte';
  import { authenticate } from '../lib/auth.js';

  export let accountExists = false;
  export let initialError = '';

  const dispatch = createEventDispatcher();
  let mode = accountExists ? 'login' : 'signup';
  let email = '';
  let password = '';
  let error = initialError;
  let submitting = false;

  async function submit() {
    error = '';
    submitting = true;
    try {
      const result = await authenticate(mode, email, password);
      dispatch('authenticated', { user: result.user });
    } catch (cause) {
      error = cause.message || 'Could not sign in.';
    } finally {
      submitting = false;
    }
  }
</script>

<main class="auth-page">
  <section class="auth-card" aria-labelledby="auth-title">
    <div class="auth-brand-mark"><Wallet size={23} /></div>
    <p class="auth-eyebrow">YOUR DEVICE-ONLY LEDGER</p>
    <h1 id="auth-title">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
    <p class="auth-description">
      {#if mode === 'signup'}
        Create a profile to keep this browser’s lending records organized.
      {:else}
        Sign in to open your PautangTrack ledger.
      {/if}
    </p>

    <form on:submit|preventDefault={submit}>
      <label for="auth-email">Email address</label>
      <input
        id="auth-email"
        type="email"
        bind:value={email}
        autocomplete="username"
        maxlength="254"
        placeholder="you@example.com"
        required
      />

      <label for="auth-password">Password</label>
      <input
        id="auth-password"
        type="password"
        bind:value={password}
        autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
        minlength={mode === 'signup' ? 8 : undefined}
        maxlength="128"
        placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
        required
      />
      {#if mode === 'signup'}
        <p class="auth-field-hint">Use at least 8 characters. Creating profiles and signing in require an internet connection.</p>
      {/if}

      {#if error}
        <p class="auth-error" role="alert">{error}</p>
      {/if}

      <button class="auth-submit" type="submit" disabled={submitting}>
        <span>{submitting ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</span>
        <ArrowRight size={17} />
      </button>
    </form>

    <p class="auth-switch">
      {#if mode === 'signup'}
        Already have an account?
        <button type="button" on:click={() => { mode = 'login'; error = ''; }}>Sign in</button>
      {:else}
        Need an account?
        <button type="button" on:click={() => { mode = 'signup'; error = ''; }}>Create one</button>
      {/if}
    </p>

    <div class="auth-privacy-note">
      <LockKeyhole size={15} />
      <span>Profiles and records stay in this browser only. They are not encrypted or synced, and clearing browser data can erase them.</span>
    </div>
  </section>
</main>
