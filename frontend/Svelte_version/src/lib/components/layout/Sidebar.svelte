<script>
  import { sortedConversations, chatStore } from '$lib/stores/chat';
  import { user, authStore } from '$lib/stores/auth';
  import { theme, THEMES, resolvedTheme } from '$lib/stores/theme';
  import Button from '$lib/components/common/Button.svelte';
  
  // Props
  export let open = true;
  
  // Handle logout
  async function handleLogout() {
    try {
      await authStore.signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }
  
  // Toggle theme
  function toggleTheme() {
    if ($resolvedTheme === THEMES.DARK) {
      theme.setTheme(THEMES.LIGHT);
    } else {
      theme.setTheme(THEMES.DARK);
    }
  }
  
  // Load conversation
  function loadConversation(id) {
    chatStore.loadConversation(id);
  }
  
  // Delete conversation
  function deleteConversation(event, id) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this conversation?')) {
      chatStore.deleteConversation(id);
    }
  }
  
  // Format date for display
  function formatDate(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    
    if (date.toDateString() === now.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  }
</script>

<div class={`h-full flex flex-col bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 ${open ? 'w-64' : 'w-0'} transition-width duration-300 overflow-hidden`}>
  <!-- Header with user info -->
  <div class="p-4 border-b border-gray-200 dark:border-gray-800">
    <div class="flex justify-between items-center">
      <h1 class="text-xl font-bold">Chat App</h1>
      
      <button 
        on:click={toggleTheme}
        class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800"
        aria-label={$resolvedTheme === THEMES.DARK ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {#if $resolvedTheme === THEMES.DARK}
          <span>🌙</span> <!-- Moon icon for dark mode -->
        {:else}
          <span>☀️</span> <!-- Sun icon for light mode -->
        {/if}
      </button>
    </div>
    
    {#if $user}
      <div class="mt-2 text-sm text-gray-700 dark:text-gray-300">
        <div>{$user.displayName || 'User'}</div>
        <div class="text-xs text-gray-500 truncate">{$user.email}</div>
      </div>
    {/if}
    
    <div class="mt-4">
      <Button 
        variant="outline" 
        size="sm" 
        fullWidth={true}
        on:click={() => chatStore.createConversation()}
      >
        New Conversation
      </Button>
    </div>
  </div>
  
  <!-- Conversation list -->
  <div class="flex-1 overflow-y-auto">
    {#if $sortedConversations.length === 0}
      <div class="p-4 text-center text-gray-500 dark:text-gray-400">
        No conversations yet
      </div>
    {:else}
      <div class="divide-y divide-gray-200 dark:divide-gray-800">
        {#each $sortedConversations as conversation (conversation.id)}
          <div 
            class="p-3 hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer flex flex-col"
            class:bg-gray-200={$chatStore.currentConversationId === conversation.id}
            class:dark:bg-gray-800={$chatStore.currentConversationId === conversation.id}
            on:click={() => loadConversation(conversation.id)}
          >
            <div class="flex justify-between items-start">
              <div class="font-medium truncate flex-1">
                {conversation.title || 'Untitled Conversation'}
              </div>
              
              <button
                class="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 ml-2"
                on:click={(e) => deleteConversation(e, conversation.id)}
                aria-label="Delete conversation"
              >
                ×
              </button>
            </div>
            
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatDate(conversation.updatedAt)}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
  
  <!-- Footer with settings and logout -->
  <div class="p-4 border-t border-gray-200 dark:border-gray-800">
    <div class="flex flex-col space-y-2">
      <a 
        href="/settings" 
        class="text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
      >
        Settings
      </a>
      
      <button 
        on:click={handleLogout}
        class="text-sm text-left text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400"
      >
        Logout
      </button>
    </div>
  </div>
</div>