<script lang="ts">
  import { isAnonymousMode, authStore, isAuthenticated } from '$lib/stores/auth';
  import { onMount } from 'svelte';
  import Button from './Button.svelte';
  
  export let hideDelay = 0; // Hide automatically after X ms (0 = don't auto-hide)
  export let showCloseButton = true;
  export let showLoginLink = true;
  
  let visible = true;
  
  function enableAnonymousMode() {
    authStore.setAnonymousMode(true);
    hideWelcome();
  }
  
  function hideWelcome() {
    visible = false;
  }
  
  // Auto hide after delay if specified
  onMount(() => {
    if (hideDelay > 0) {
      const timer = setTimeout(() => {
        hideWelcome();
      }, hideDelay);
      
      return () => clearTimeout(timer);
    }
  });
</script>

{#if visible && !$isAuthenticated}
  <div class="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-md p-6 mb-6 relative">
    {#if showCloseButton}
      <button 
        class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200" 
        on:click={hideWelcome}
        aria-label="Close welcome banner"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    {/if}
    
    <h2 class="text-xl font-bold text-primary-800 dark:text-primary-300 mb-2">Welcome to the Chat App!</h2>
    
    <p class="mb-4 text-gray-700 dark:text-gray-300">
      You can use this application in guest mode without creating an account, 
      or sign in to save your conversations across devices.
    </p>
    
    <div class="flex flex-wrap gap-3">
      <Button 
        on:click={enableAnonymousMode} 
        variant={$isAnonymousMode ? "primary" : "outline"}
        size="sm"
      >
        {$isAnonymousMode ? 'Using Guest Mode' : 'Continue as Guest'}
      </Button>
      
      {#if showLoginLink}
        <Button 
          on:click={() => { window.location.href = "/login"; }} 
          variant={!$isAnonymousMode ? "primary" : "outline"}
          size="sm"
        >
          Sign In
        </Button>
      {/if}
    </div>
  </div>
{/if}
