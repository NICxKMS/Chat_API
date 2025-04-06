<script>
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import { onMount } from 'svelte';
  import { resolvedTheme } from '$lib/stores/theme';
  
  // State
  let sidebarOpen = true;
  
  // Toggle sidebar visibility
  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }
</script>

<div class="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <!-- Sidebar -->
  <Sidebar bind:open={sidebarOpen} />
  
  <!-- Main content -->
  <div class="flex-1 flex flex-col h-full overflow-hidden">
    <!-- Mobile header with toggle -->
    <div class="md:hidden p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center">
      <button 
        on:click={toggleSidebar}
        class="mr-4 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        ☰
      </button>
      <h1 class="text-lg font-semibold">Chat App</h1>
    </div>
    
    <!-- Content area -->
    <div class="flex-1 overflow-auto relative">
      <slot />
    </div>
  </div>
</div>