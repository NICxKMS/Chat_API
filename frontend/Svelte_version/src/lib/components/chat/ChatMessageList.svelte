<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { chatStore } from '$lib/stores/chat';
  import MessageBubble from './MessageBubble.svelte';
  import VirtualList from '@sveltejs/svelte-virtual-list';
  import ProgressiveMessageLoader from './ProgressiveMessageLoader.svelte';
  
  // Define message interface
  interface Message {
    id: string;
    content: string;
    role: string;
    timestamp: number;
    [key: string]: any;
  }
  
  // Props
  export let messages: Message[] = $chatStore.messages as Message[];
  export let autoScroll = true;
  export let loading = false;
  export let highlightedMessageIds: string[] = [];
  
  // Element references
  let messagesContainer: HTMLDivElement;
  let virtualList: any;
  let progressiveLoader: {
    scrollToBottom: () => void;
    scrollToMessage: (id: string) => void;
    loadAllMessages: () => void;
  };
  let isAutoScrollEnabled = autoScroll;
  let lastScrollTop = 0;
  let lastMessagesLength = 0;
  let visibleMessagesStart = 0;
  let visibleMessagesEnd = 0;
  
  // Determine if we should use progressive loading
  $: useProgressiveLoading = messages.length > 50;
  
  // Compute a reasonable estimate for message height
  // This is used for optimization but virtual list will adjust as needed
  const estimatedItemHeight = 80; // pixels, average height of a message
  
  // Detect manual scrolling to disable auto-scroll
  function handleScroll() {
    if (!messagesContainer) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    // If user scrolled up, disable auto-scroll
    if (scrollTop < lastScrollTop && !isScrolledToBottom) {
      isAutoScrollEnabled = false;
    }
    
    // If user scrolled to bottom, re-enable auto-scroll
    if (isScrolledToBottom) {
      isAutoScrollEnabled = true;
    }
    
    lastScrollTop = scrollTop;
  }
  
  // Scroll to bottom on mount
  onMount(() => {
    scrollToBottom();
  });
  
  // After update, scroll if necessary
  afterUpdate(() => {
    if (messages.length > lastMessagesLength && isAutoScrollEnabled) {
      scrollToBottom();
    }
    lastMessagesLength = messages.length;
  });
  
  // Scroll to bottom of messages container
  // Scroll to bottom of messages container
  export function scrollToBottom() {
    if (useProgressiveLoading && progressiveLoader) {
      progressiveLoader.scrollToBottom();
    } else if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
  
  // Scroll to a specific message
  export function scrollToMessage(messageId: string) {
    if (useProgressiveLoading && progressiveLoader) {
      progressiveLoader.scrollToMessage(messageId);
    } else if (messagesContainer) {
      setTimeout(() => {
        const messageElement = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  }
  
  // Enable auto-scrolling when new messages come in
  export function enableAutoScroll() {
    isAutoScrollEnabled = true;
    if (messages.length > 0) {
      scrollToBottom();
    }
  }
  
  // Handle message loading completion
  function handleLoadingComplete() {
    // Any additional logic when progressive loading completes
  }
</script>

{#if messages.length === 0 && !loading}
  <div class="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin flex flex-col items-center justify-center">
    <div class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
      <p class="text-center">No messages yet. Start a conversation!</p>
    </div>
  </div>
{:else if messages.length === 0 && loading}
  <div class="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin flex flex-col items-center justify-center">
    <div class="animate-pulse flex space-x-4">
      <div class="flex-1 space-y-4 py-1">
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        <div class="space-y-2">
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        </div>
      </div>
    </div>
  </div>
{:else if useProgressiveLoading}
  <ProgressiveMessageLoader
    bind:this={progressiveLoader}
    {messages}
    initialLoadCount={20}
    batchSize={10}
    prioritizeRecent={true}
    on:loadingComplete={handleLoadingComplete}
  >
    <svelte:fragment slot="default" let:messages={visibleMessages}>
      {#each visibleMessages as message (message.id)}
        <div class="mb-4">
          <MessageBubble 
            message={message} 
            highlighted={highlightedMessageIds.includes(message.id)} 
            data-message-id={message.id} 
          />
        </div>
      {/each}
    </svelte:fragment>
  </ProgressiveMessageLoader>
{:else}
  <div 
    bind:this={messagesContainer}
    on:scroll={handleScroll}
    class="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin"
  >
    <VirtualList 
      items={messages} 
      bind:start={visibleMessagesStart} 
      bind:end={visibleMessagesEnd}
      itemHeight={estimatedItemHeight}
      let:item
      bind:this={virtualList}
    >
      <div class="mb-4">
        <MessageBubble 
          message={item} 
          highlighted={highlightedMessageIds.includes(item.id)}
          data-message-id={item.id} 
        />
      </div>
    </VirtualList>
    <div class="text-xs text-gray-400 text-center mt-2" aria-hidden="true">
      Showing {visibleMessagesStart+1}-{visibleMessagesEnd} of {messages.length} messages
    </div>
  </div>

  <div class="flex justify-center my-2">
    {#if !isAutoScrollEnabled && messages.length > 0}
      <button 
        on:click={() => { isAutoScrollEnabled = true; scrollToBottom(); }}
        class="rounded-full bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 p-2 text-sm flex items-center shadow-md hover:bg-primary-200 dark:hover:bg-primary-800"
      >
        <span class="mr-1">↓</span> Scroll to bottom
      </button>
    {/if}
  </div>
{/if}