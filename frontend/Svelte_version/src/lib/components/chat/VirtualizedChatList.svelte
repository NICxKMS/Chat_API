<script>
  import { onMount, afterUpdate } from 'svelte';
  import VirtualList from '@sveltejs/svelte-virtual-list';
  import MessageBubble from './MessageBubble.svelte';
  import TypingIndicator from './TypingIndicator.svelte';
  
  // Props
  export let messages = [];
  export let loading = false;
  export let highlightedMessageIds = [];
  
  // Element refs
  let virtualListContainer;
  let virtualListComponent;
  let lastScrollPosition = 0;
  let autoScroll = true;
  
  // Lifecycle
  onMount(() => {
    // Initialize auto-scroll behavior
    virtualListContainer.addEventListener('scroll', handleScroll);
    return () => {
      virtualListContainer.removeEventListener('scroll', handleScroll);
    };
  });
  
  afterUpdate(() => {
    // Auto-scroll to bottom when new messages arrive if user was already at bottom
    if (autoScroll && !loading && messages.length > 0) {
      scrollToBottom();
    }
  });
  
  // Monitor scroll position to determine if auto-scroll should be enabled
  function handleScroll() {
    const { scrollTop, scrollHeight, clientHeight } = virtualListContainer;
    lastScrollPosition = scrollTop;
    
    // Enable auto-scroll if user is near the bottom
    const scrollThreshold = 100; // pixels from bottom
    const isNearBottom = scrollHeight - (scrollTop + clientHeight) < scrollThreshold;
    autoScroll = isNearBottom;
  }
  
  // Scroll to bottom of chat
  export function scrollToBottom() {
    if (virtualListContainer) {
      virtualListContainer.scrollTop = virtualListContainer.scrollHeight;
    }
  }
  
  // Scroll to specific message by ID
  export function scrollToMessage(messageId) {
    if (!messageId) return;
    
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex >= 0 && virtualListComponent) {
      virtualListComponent.scrollToIndex(messageIndex);
      
      // Highlight the message briefly
      setTimeout(() => {
        const messageElement = virtualListContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }
</script>

<div 
  bind:this={virtualListContainer}
  class="h-full overflow-y-auto px-4 py-2"
>
  <VirtualList
    bind:this={virtualListComponent}
    items={messages}
    height="100%"
    itemHeight={100} 
    let:item={message}
  >
    <div data-message-id={message.id}>
      <MessageBubble 
        {message} 
        highlighted={highlightedMessageIds.includes(message.id)} 
      />
    </div>
  </VirtualList>
  
  {#if loading}
    <div class="py-2">
      <TypingIndicator />
    </div>
  {/if}
</div>

<style>
  .h-full.overflow-y-auto {
    scrollbar-width: thin;
    scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
  }
  
  .h-full.overflow-y-auto::-webkit-scrollbar {
    width: 8px;
  }
  
  .h-full.overflow-y-auto::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .h-full.overflow-y-auto::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.5);
    border-radius: 20px;
  }
</style>