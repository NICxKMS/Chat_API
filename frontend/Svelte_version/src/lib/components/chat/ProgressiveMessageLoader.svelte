<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { createProgressiveLoader } from '$lib/utils/progressiveLoader';
  import type { MessageType } from '$lib/types';
  import { writable } from 'svelte/store';
  
  // Props
  export let messages: MessageType[] = [];
  export let initialLoadCount = 10; 
  export let batchSize = 5;
  export let loadOnScroll = true;
  export let prioritizeRecent = true;
  
  // Event dispatcher
  const dispatch = createEventDispatcher<{
    messagesLoaded: { visibleMessages: MessageType[] };
    loadingComplete: void;
  }>();
  
  // Create a store for visible messages
  const visibleMessages = writable<MessageType[]>([]);
  
  // State
  let loader: ReturnType<typeof createProgressiveLoader<MessageType>> | null = null;
  let containerEl: HTMLDivElement;
  let isScrolledToBottom = true;
  let lastScrollHeight = 0;
  
  // Setup progressive loader
  $: if (messages && messages.length > 0) {
    setupLoader();
  }
  
  // Setup the progressive loader
  function setupLoader() {
    // Clean up existing loader
    if (loader) {
      loader.pause();
    }
    
    // Create a priority function that prioritizes recent messages
    const priorityFn = prioritizeRecent 
      ? (msg: MessageType, index: number) => {
          // Recent messages get higher priority
          return messages.length - index;
        }
      : undefined;
    
    // Create new loader
    loader = createProgressiveLoader<MessageType>(
      messages,
      (loadedItems) => {
        visibleMessages.set(loadedItems);
        dispatch('messagesLoaded', { visibleMessages: loadedItems });
        
        // Check if loading is complete
        if (loader?.isComplete) {
          dispatch('loadingComplete');
        }
        
        // Maintain scroll position when new items are loaded
        if (containerEl && !isScrolledToBottom) {
          const newScrollHeight = containerEl.scrollHeight;
          const scrollDiff = newScrollHeight - lastScrollHeight;
          if (scrollDiff > 0) {
            containerEl.scrollTop += scrollDiff;
          }
          lastScrollHeight = newScrollHeight;
        }
      },
      {
        initialCount: initialLoadCount,
        batchSize,
        minDelay: 50,
        maxDelay: 200,
        priorityFn
      }
    );
    
    // Start loading
    loader.start();
  }
  
  // Handle scroll events to load more messages
  function handleScroll() {
    if (!containerEl || !loader || !loadOnScroll || loader.isComplete) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerEl;
    
    // Detect if scrolled to bottom
    isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 20;
    
    // Load more when scrolled near top (20% from top)
    const scrollThreshold = clientHeight * 0.2;
    if (scrollTop < scrollThreshold && !loader.isComplete && !loader.isLoading) {
      loader.start();
    }
  }
  
  // Scroll to bottom
  export function scrollToBottom() {
    if (containerEl) {
      containerEl.scrollTop = containerEl.scrollHeight;
      isScrolledToBottom = true;
    }
  }
  
  // Scroll to message by ID
  export function scrollToMessage(messageId: string) {
    if (!containerEl) return;
    
    // Ensure the message is loaded
    if (loader && !loader.isComplete) {
      loader.loadAll();
    }
    
    // Find the message element
    setTimeout(() => {
      const messageEl = containerEl.querySelector(`[data-message-id="${messageId}"]`);
      if (messageEl) {
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  }
  
  // Load all messages immediately
  export function loadAllMessages() {
    if (loader) {
      loader.loadAll();
    }
  }
  
  // Cleanup on destroy
  onDestroy(() => {
    if (loader) {
      loader.pause();
    }
  });
  
  // Scroll to bottom on mount
  onMount(() => {
    if (containerEl) {
      lastScrollHeight = containerEl.scrollHeight;
      if (isScrolledToBottom) {
        scrollToBottom();
      }
    }
  });
</script>

<div
  bind:this={containerEl}
  on:scroll={handleScroll}
  class="h-full overflow-y-auto p-4 space-y-4"
>
  {#if $visibleMessages.length === 0 && messages.length > 0}
    <div class="flex justify-center items-center h-16">
      <div class="animate-pulse text-gray-500 dark:text-gray-400">
        Loading messages...
      </div>
    </div>
  {:else if messages.length === 0}
    <div class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
      <p class="text-center">No messages yet. Start a conversation!</p>
    </div>
  {:else}
    <slot messages={$visibleMessages}></slot>
    
    {#if loader && !loader.isComplete}
      <div class="flex justify-center my-2">
        <button
          on:click={loadAllMessages}
          class="text-sm text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
        >
          Load all messages
        </button>
      </div>
    {/if}
  {/if}
</div>
