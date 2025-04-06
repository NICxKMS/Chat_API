<script>
  import { isAuthenticated, isLoading, isAnonymousMode } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  
  export let redirectTo = '/login';
  
  // Allow both authenticated and anonymous users
  // Only redirect if not authenticated AND not in anonymous mode
  $: if (!$isLoading && !$isAuthenticated && !$isAnonymousMode) {
    goto(redirectTo);
  }
</script>

{#if $isLoading}
  <div class="flex justify-center items-center h-screen">
    <div class="text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
      <p class="mt-2 text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  </div>
{:else if $isAuthenticated || $isAnonymousMode}
  <slot />
{/if}