<script>
  import { authStore, authError } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  
  // Form state
  let email = '';
  let password = '';
  let confirmPassword = '';
  let displayName = '';
  let loading = false;
  let errorMessage = '';
  
  // Clear error when inputs change
  $: if (email || password || confirmPassword || displayName) {
    errorMessage = '';
    authStore.clearError();
  }
  
  // Monitor auth store error
  $: if ($authError) {
    errorMessage = $authError;
  }
  
  async function handleSignup() {
    // Basic validation
    if (!email || !password || !confirmPassword) {
      errorMessage = 'Please fill in all required fields';
      return;
    }
    
    if (password !== confirmPassword) {
      errorMessage = 'Passwords do not match';
      return;
    }
    
    if (password.length < 6) {
      errorMessage = 'Password must be at least 6 characters';
      return;
    }
    
    try {
      loading = true;
      await authStore.signUp(email, password, displayName);
      // Redirect to home page after successful signup
      goto('/');
    } catch (error) {
      // Error is already handled by the auth store
      // but we can add additional handling here if needed
      console.error('Signup error:', error);
    } finally {
      loading = false;
    }
  }
</script>

<div class="w-full max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
  <h2 class="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">Create Account</h2>
  
  {#if errorMessage}
    <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
      {errorMessage}
    </div>
  {/if}
  
  <form on:submit|preventDefault={handleSignup} class="space-y-4">
    <div>
      <label for="displayName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Display Name (optional)
      </label>
      <input
        type="text"
        id="displayName"
        bind:value={displayName}
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
        placeholder="Your Name"
      />
    </div>
    
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
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Must be at least 6 characters
      </p>
    </div>
    
    <div>
      <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Confirm Password
      </label>
      <input
        type="password"
        id="confirmPassword"
        bind:value={confirmPassword}
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
        placeholder="••••••••"
        required
      />
    </div>
    
    <button
      type="submit"
      disabled={loading}
      class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {#if loading}
        <span class="mr-2">Creating account...</span>
        <!-- You could add a spinner icon here -->
      {:else}
        Sign Up
      {/if}
    </button>
  </form>
  
  <div class="mt-6 text-center">
    <p class="text-sm text-gray-600 dark:text-gray-400">
      Already have an account? 
      <a href="/login" class="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">
        Log in
      </a>
    </p>
  </div>
</div>