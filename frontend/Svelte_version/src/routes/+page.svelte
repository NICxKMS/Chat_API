<script lang="ts">
  import { onMount } from 'svelte';
  import { user, authStore, effectiveUser, isAnonymousMode } from '$lib/stores/auth';
  import { browser } from '$app/environment';
  import type { ComponentType } from 'svelte';
  import ChatContainer from '$lib/components/chat/ChatContainer.svelte';
  import WelcomeBanner from '$lib/components/common/WelcomeBanner.svelte';
  
  // Lazy-load authentication component
  let AuthGuard: ComponentType | undefined = undefined;
  
  onMount(async () => {
    const module = await import('$lib/components/auth/AuthGuard.svelte');
    AuthGuard = module.default;
  });
  
  // Logout function
  async function handleLogout() {
    try {
      await authStore.signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }
  
  // Type-safe user access
  $: typedUser = $effectiveUser as { displayName?: string; email?: string; isAnonymous?: boolean } | null;
</script>

{#if AuthGuard}
  <svelte:component this={AuthGuard}>
    <div class="h-screen flex flex-col">
      <!-- App header -->
      <header class="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
        <div class="container mx-auto px-4 py-2 flex justify-between items-center">
          <h1 class="text-2xl font-bold text-primary-600">Chat App</h1>
          
          <div class="flex items-center gap-4">
            {#if !$isAnonymousMode && $user}
              <div class="text-right hidden md:block">
                <p class="font-medium">{typedUser?.displayName || 'User'}</p>
                <p class="text-sm text-gray-600 dark:text-gray-400">{typedUser?.email}</p>
              </div>
              
              <button 
                on:click={handleLogout}
                class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm transition-colors"
              >
                Log Out
              </button>
            {:else if $isAnonymousMode}
              <span class="text-sm text-gray-600 dark:text-gray-400">Guest Mode</span>
            {/if}
          </div>
        </div>
      </header>
      
      <!-- Main content -->
      <div class="flex-1 overflow-hidden flex flex-col">
        <!-- Welcome banner for new users -->
        <div class="p-4">
          <WelcomeBanner hideDelay={0} />
        </div>
        
        <!-- Chat container -->
        <div class="flex-1">
          <ChatContainer />
        </div>
      </div>
    </div>
  </svelte:component>
{:else}
  <div class="flex items-center justify-center h-screen">
    <div class="animate-pulse text-center">
      <div class="h-8 w-32 bg-gray-300 dark:bg-gray-700 rounded mb-4 mx-auto"></div>
      <div class="h-4 w-48 bg-gray-200 dark:bg-gray-800 rounded mx-auto"></div>
    </div>
  </div>
{/if}
