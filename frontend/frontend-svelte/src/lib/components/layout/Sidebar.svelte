<!-- src/lib/components/layout/Sidebar.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { sidebarVisible } from '$lib/stores/ui';
  import ChatHistory from '$lib/components/chat/ChatHistory.svelte';
  
  const dispatch = createEventDispatcher();

  function toggleSidebar() {
    sidebarVisible.update(value => !value);
    dispatch('toggle');
  }
</script>

<div class="sidebar" class:sidebar-hidden={!$sidebarVisible}>
  <div class="h-full bg-sidebar-bg border-r border-border-primary flex flex-col">
    {#if !isCollapsed}
      <ChatHistory {isCollapsed} />
    {:else}
      <div class="p-4 text-center text-foreground/50 text-sm">
        <p>Chat history available when sidebar is expanded</p>
      </div>
    {/if}
  </div>
  <button
    class="side-button absolute -right-3 top-4"
    on:click={toggleSidebar}
    aria-label={$sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d={$sidebarVisible ? 'M11 19l-7-7 7-7m8 14l-7-7 7-7' : 'M13 5l7 7-7 7M5 5l7 7-7 7'}
      />
    </svg>
  </button>
</div> 