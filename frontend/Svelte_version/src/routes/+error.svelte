<script>
  import { goto } from '$app/navigation';
  import Button from '$lib/components/common/Button.svelte';
  
  function goHome() {
    goto('/');
  }
</script>

<div class="min-h-screen flex flex-col items-center justify-center p-4 text-center">
  <div class="text-6xl font-bold text-primary-600 mb-4">404</div>
  <h1 class="text-2xl font-semibold mb-4">Page Not Found</h1>
  <p class="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
    The page you are looking for might have been removed, had its name changed, 
    or is temporarily unavailable.
  </p>
  
  <Button on:click={goHome}>
    Return to Home
  </Button>
</div>