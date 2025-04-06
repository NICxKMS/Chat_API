<script>
  import { onMount } from 'svelte';
  import SearchInput from '$lib/components/common/SearchInput.svelte';
  import VirtualizedChatList from './VirtualizedChatList.svelte';
  
  // Props
  export let messages = [];
  export let loading = false;
  
  // State
  let searchQuery = '';
  let searchResults = [];
  let highlightedMessageIds = [];
  let virtualListComponent;
  
  // Perform search when query changes
  $: if (searchQuery) {
    searchMessages(searchQuery);
  } else {
    searchResults = [];
    highlightedMessageIds = [];
  }
  
  // Search through messages
  function searchMessages(query) {
    if (!query || query.trim() === '') {
      searchResults = [];
      highlightedMessageIds = [];
      return;
    }
    
    const normalizedQuery = query.toLowerCase().trim();
    
    // Search through message content
    searchResults = messages.filter(message => 
      message.content && message.content.toLowerCase().includes(normalizedQuery)
    );
    
    // Update highlighted message IDs
    highlightedMessageIds = searchResults.map(msg => msg.id);
    
    // Scroll to first result if any
    if (searchResults.length > 0 && virtualListComponent) {
      setTimeout(() => {
        virtualListComponent.scrollToMessage(searchResults[0].id);
      }, 100);
    }
  }
  
  // Handle search event from SearchInput
  function handleSearch(event) {
    searchQuery = event.detail;
  }
  
  // Navigate to next/previous result
  function navigateSearchResults(direction) {
    if (searchResults.length === 0 || !virtualListComponent) return;
    
    const currentIndex = highlightedMessageIds.findIndex(id => id === searchResults[0]?.id);
    let newIndex;
    
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % searchResults.length;
    } else {
      newIndex = (currentIndex - 1 + searchResults.length) % searchResults.length;
    }
    
    if (newIndex >= 0 && newIndex < searchResults.length) {
      virtualListComponent.scrollToMessage(searchResults[newIndex].id);
    }
  }
</script>

<div class="flex flex-col h-full">
  <div class="p-2 border-b border-gray-200 dark:border-gray-700">
    <SearchInput 
      bind:value={searchQuery} 
      on:search={handleSearch}
      placeholder="Search messages..."
    />
    
    {#if searchResults.length > 0}
      <div class="flex items-center justify-between mt-2 text-sm text-gray-500 dark:text-gray-400">
        <span>{searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}</span>
        
        <div class="flex space-x-2">
          <button 
            class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700" 
            on:click={() => navigateSearchResults('prev')}
            aria-label="Previous result"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button 
            class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700" 
            on:click={() => navigateSearchResults('next')}
            aria-label="Next result"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    {/if}
  </div>
  
  <div class="flex-1 overflow-hidden">
    <VirtualizedChatList 
      bind:this={virtualListComponent}
      {messages} 
      {loading}
      {highlightedMessageIds}
    />
  </div>
</div>