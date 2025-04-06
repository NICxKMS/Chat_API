<script>
  import SignupForm from '$lib/components/auth/SignupForm.svelte';
  import { isAuthenticated } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  
  // Redirect to home if already logged in
  $: if ($isAuthenticated) {
    goto('/');
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
  <div class="w-full max-w-md">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
        Chat Application
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Create an account to get started
      </p>
    </div>
    
    <SignupForm />
  </div>
</div>