<script>
  import { authStore, authError } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  
  // Form state
  let email = '';
  let password = '';
  let loading = false;
  let errorMessage = '';
  
  // Clear error when inputs change
  $: if (email || password) {
    errorMessage = '';
    authStore.clearError();
  }
  
  // Monitor auth store error
  $: if ($authError) {
    errorMessage = $authError;
  }
  
  async function handleLogin() {
    if (!email || !password) {
      errorMessage = 'Please enter both email and password';
      return;
    }
    
    try {
      loading = true;
      await authStore.signIn(email, password);
      // Redirect to home page after successful login
      goto('/');
    } catch (error) {
      // Error is already handled by the auth store
      // but we can add additional handling here if needed
      console.error('Login error:', error);
    } finally {
      loading = false;
    }
  }
  
  function handleForgotPassword() {
    // For simplicity, we're just redirecting to a password reset page
    // In a complete implementation, you might want to show a modal or a form
    goto('/reset-password');
  }
</script>

<div class="w-full max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
  <h2 class="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">Log In</h2>
  
  {#if errorMessage}
    <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
      {errorMessage}
    </div>
  {/if}
  
  <form on:submit|preventDefault={handleLogin} class="space-y-4">
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
    
    <div>
      <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Password
      </label>
      <input
        type="password"
        id="password"
        bind:value={password}
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
        placeholder="••••••••"
        required
      />
    </div>
    
    <div class="flex items-center justify-between">
      <button
        type="button"
        on:click={handleForgotPassword}
        class="text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
      >
        Forgot password?
      </button>
    </div>
    
    <button
      type="submit"
      disabled={loading}
      class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {#if loading}
        <span class="mr-2">Logging in...</span>
        <!-- You could add a spinner icon here -->
      {:else}
        Log In
      {/if}
    </button>
  </form>
  
  <div class="mt-6 text-center">
    <p class="text-sm text-gray-600 dark:text-gray-400">
      Don't have an account? 
      <a href="/signup" class="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">
        Sign up
      </a>
    </p>
  </div>
</div>