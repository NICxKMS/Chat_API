<script>
  import { authStore, authError } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  
  // Form state
  let email = '';
  let loading = false;
  let errorMessage = '';
  let successMessage = '';
  
  // Clear error when inputs change
  $: if (email) {
    errorMessage = '';
    successMessage = '';
    authStore.clearError();
  }
  
  // Monitor auth store error
  $: if ($authError) {
    errorMessage = $authError;
  }
  
  async function handleResetPassword() {
    if (!email) {
      errorMessage = 'Please enter your email address';
      return;
    }
    
    try {
      loading = true;
      await authStore.resetPassword(email);
      successMessage = 'Password reset email sent. Check your inbox.';
      email = '';
    } catch (error) {
      // Error is already handled by the auth store
      console.error('Reset password error:', error);
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
  <div class="w-full max-w-md">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
        Reset Password
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Enter your email to receive a password reset link
      </p>
    </div>
    
    <div class="w-full max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      {#if errorMessage}
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {errorMessage}
        </div>
      {/if}
      
      {#if successMessage}
        <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {successMessage}
        </div>
      {/if}
      
      <form on:submit|preventDefault={handleResetPassword} class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            bind:value={email}
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
            placeholder="your@email.com"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if loading}
            <span class="mr-2">Sending email...</span>
          {:else}
            Reset Password
          {/if}
        </button>
      </form>
      
      <div class="mt-6 text-center">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          <a href="/login" class="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">
            Back to Login
          </a>
        </p>
      </div>
    </div>
  </div>
</div>