<script lang="ts">
  import { chatStore } from '$lib/stores/chat';
  import { slide } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  
  // Define the MessageType interface inline since we can't import it yet
  interface MessageType {
    id: string;
    role: string;
    content: string;
    timestamp: number;
    isComplete?: boolean;
    preview?: string;
  }
  
  // Event dispatcher for search navigation
  const dispatch = createEventDispatcher<{
    select: { messageId: string };
    close: void;
  }>();
  
  // Props
  export let isOpen = false;
  
  // State variables
  let searchQuery = '';
  let searchResults: MessageType[] = [];
  let selectedResultIndex = -1;
  let inputEl: HTMLInputElement;
  
  // Focus the input when opened
  $: if (isOpen && inputEl) {
    setTimeout(() => inputEl.focus(), 50);
  }
  
  // Clear search when closed
  $: if (!isOpen) {
    searchQuery = '';
    searchResults = [];
    selectedResultIndex = -1;
  }
  
  // Execute search when query changes
  $: {
    if (searchQuery.trim()) {
      searchMessages(searchQuery);
    } else {
      searchResults = [];
      selectedResultIndex = -1;
    }
  }
  
  // Function to search through messages
  function searchMessages(query: string) {
    if (!query.trim()) return [];
    
    const queryLower = query.toLowerCase();
    
    // Filter messages that contain the search query
    const messages = ($chatStore.messages || []) as MessageType[];
    
    searchResults = messages
      .filter(msg => msg.content && typeof msg.content === 'string' && msg.content.toLowerCase().includes(queryLower))
      .map(msg => ({
        ...msg,
        // Create a preview that highlights the match
        preview: createPreview(msg.content, queryLower)
      }));
    
    // Reset selected index
    selectedResultIndex = searchResults.length > 0 ? 0 : -1;
  }
  
  // Create a preview of the message with context around the match
  function createPreview(content: string | undefined, queryLower: string) {
    if (!content || typeof content !== 'string') return '';
    
    const index = content.toLowerCase().indexOf(queryLower);
    if (index === -1) return content.slice(0, 100) + '...';
    
    // Create a preview window around the match
    const startIndex = Math.max(0, index - 30);
    const endIndex = Math.min(content.length, index + queryLower.length + 30);
    let preview = content.slice(startIndex, endIndex);
    
    // Add ellipsis if needed
    if (startIndex > 0) preview = '...' + preview;
    if (endIndex < content.length) preview = preview + '...';
    
    return preview;
  }
  
  // Navigate to previous/next result
  function navigatePrev() {
    if (searchResults.length === 0) return;
    selectedResultIndex = (selectedResultIndex - 1 + searchResults.length) % searchResults.length;
  }
  
  function navigateNext() {
    if (searchResults.length === 0) return;
    selectedResultIndex = (selectedResultIndex + 1) % searchResults.length;
  }
  
  // Select a result and emit event
  function selectResult(messageId: string) {
    dispatch('select', { messageId });
  }
  
  // Close search
  function closeSearch() {
    dispatch('close');
  }
  
  // Handle keyboard shortcuts
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeSearch();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      navigatePrev();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      navigateNext();
    } else if (event.key === 'Enter' && selectedResultIndex >= 0) {
      event.preventDefault();
      selectResult(searchResults[selectedResultIndex].id);
    }
  }
</script>

{#if isOpen}
  <div
    class="fixed inset-x-0 top-0 bg-white dark:bg-gray-800 shadow-md z-50 border-b border-gray-200 dark:border-gray-700"
    transition:slide={{ duration: 150, axis: 'y' }}
  >
    <div class="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
      <div class="flex-1 relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            class="h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          bind:this={inputEl}
          bind:value={searchQuery}
          on:keydown={handleKeyDown}
          placeholder="Search in conversation..."
          class="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
        />
      </div>
      <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        {#if searchResults.length > 0}
          <span>{selectedResultIndex + 1} of {searchResults.length}</span>
          <button
            class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            on:click={navigatePrev}
            aria-label="Previous result"
          >
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
          <button
            class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            on:click={navigateNext}
            aria-label="Next result"
          >
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        {:else if searchQuery.trim() !== ''}
          <span>No results</span>
        {/if}
        <button
          class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          on:click={closeSearch}
          aria-label="Close search"
        >
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Search results -->
    {#if searchResults.length > 0}
      <div class="max-h-64 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
        <div class="max-w-4xl mx-auto">
          {#each searchResults as result, index}
            <button
              class="block w-full text-left px-4 py-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 {selectedResultIndex === index ? 'bg-gray-100 dark:bg-gray-700' : ''}"
              on:click={() => {
                selectedResultIndex = index;
                selectResult(result.id);
              }}
            >
              <div class="flex items-start gap-2">
                <div class="flex-shrink-0">
                  <span
                    class="inline-block w-6 h-6 rounded-full text-xs flex items-center justify-center {result.role === 'user' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}"
                  >
                    {result.role === 'user' ? 'U' : 'A'}
                  </span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words line-clamp-2">
                    {result.preview}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(result.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}
