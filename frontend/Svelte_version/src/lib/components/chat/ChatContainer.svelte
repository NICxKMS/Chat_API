<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { chatStore } from '$lib/stores/chat';
  import { settings } from '$lib/stores/settings';
  import { selectedModel } from '$lib/stores/models';
  import { isAuthenticated, isAnonymousMode } from '$lib/stores/auth';
  import VirtualizedChatList from './VirtualizedChatList.svelte';
  import ChatInput from './ChatInput.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import AnonymousToggle from '$lib/components/common/AnonymousToggle.svelte';
  import MessageSearch from './MessageSearch.svelte';
  import { goto } from '$app/navigation';
  import { SHORTCUTS, ShortcutAction, createShortcutHandler } from '$lib/utils/keyboard';
  
  // Local state
  let inputComponent: { focus: () => void };
  let messageListComponent: { 
    scrollToMessage: (id: string) => void, 
    enableAutoScroll?: () => void,
    scrollToBottom?: () => void 
  };
  let searchOpen = false;
  let searchButtonEl: HTMLButtonElement;
  
  // Focus the input on mount
  onMount(() => {
    if (inputComponent) {
      inputComponent.focus();
    }
  });
  
  // Clear the chat
  function handleClearChat() {
    if (confirm('Are you sure you want to clear all messages?')) {
      chatStore.clearChat();
      setTimeout(() => {
        if (inputComponent) {
          inputComponent.focus();
        }
      }, 0);
    }
  }
  
  // New chat
  function handleNewChat() {
    chatStore.createConversation('New Conversation');
    setTimeout(() => {
      if (inputComponent) {
        inputComponent.focus();
      }
    }, 0);
  }
  
  // Toggle search
  function toggleSearch() {
    searchOpen = !searchOpen;
  }
  
  // Handle search result selection
  function handleSearchSelect(event: CustomEvent<{messageId: string}>) {
    // Scroll to the selected message
    if (messageListComponent) {
      messageListComponent.scrollToMessage(event.detail.messageId);
    }
  }
  
  // Handle keyboard shortcuts using our keyboard utilities
  const handleKeyDown = createShortcutHandler(
    {
      [ShortcutAction.SEARCH]: SHORTCUTS[ShortcutAction.SEARCH],
      [ShortcutAction.NEW_CHAT]: SHORTCUTS[ShortcutAction.NEW_CHAT],
      [ShortcutAction.CLEAR_CHAT]: SHORTCUTS[ShortcutAction.CLEAR_CHAT],
      [ShortcutAction.FOCUS_INPUT]: SHORTCUTS[ShortcutAction.FOCUS_INPUT],
      [ShortcutAction.TOGGLE_SETTINGS]: SHORTCUTS[ShortcutAction.TOGGLE_SETTINGS],
      [ShortcutAction.ESCAPE_CURRENT]: SHORTCUTS[ShortcutAction.ESCAPE_CURRENT],
      [ShortcutAction.SCROLL_BOTTOM]: SHORTCUTS[ShortcutAction.SCROLL_BOTTOM]
    },
    {
      [ShortcutAction.SEARCH]: toggleSearch,
      [ShortcutAction.NEW_CHAT]: handleNewChat,
      [ShortcutAction.CLEAR_CHAT]: () => {
        if ($chatStore.messages.length > 0) {
          handleClearChat();
        }
      },
      [ShortcutAction.FOCUS_INPUT]: () => {
        if (inputComponent) {
          inputComponent.focus();
        }
      },
      [ShortcutAction.TOGGLE_SETTINGS]: () => {
        goto('/settings');
      },
      [ShortcutAction.ESCAPE_CURRENT]: () => {
        if (searchOpen) {
          searchOpen = false;
        } else if ($chatStore.isStreaming) {
          chatStore.stopStreaming();
        }
      },
      [ShortcutAction.SCROLL_BOTTOM]: () => {
        if (messageListComponent && typeof messageListComponent.scrollToBottom === 'function') {
          messageListComponent.scrollToBottom();
        }
      }
    }
  );
</script>

<section class="flex flex-col h-full" aria-label="Chat interface">
  <!-- Keyboard shortcut handler - hidden but accessible -->
  <span class="sr-only" tabindex="0" on:keydown={handleKeyDown} aria-label="Chat keyboard shortcuts" role="button"></span>
  <!-- Chat header -->
  <div class="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-between items-center">
    <div>
      <h2 class="text-lg font-semibold">
        {#if $chatStore.currentConversationId}
          {(() => {
            const typedConversations = ($chatStore.conversations || []) as {id: string, title: string}[];
            const conv = typedConversations.find(c => c && typeof c === 'object' && c.id === $chatStore.currentConversationId);
            return conv?.title || 'Chat';
          })()}
        {:else}
          Chat
        {/if}
      </h2>
      <div class="text-sm text-gray-500 dark:text-gray-400">
        Using {$selectedModel.name}
      </div>
    </div>
    
    <div class="flex items-center space-x-2">
      <div class="mr-2">
        <AnonymousToggle label="Guest Mode" tooltipText="Use the chat without logging in. Your data won't be saved between sessions." />
      </div>
      
      <button
        bind:this={searchButtonEl}
        on:click={toggleSearch}
        class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md transition-colors"
        aria-label="Search messages"
        title="Search messages (Ctrl+F)"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      </button>
    
  
      <Button 
        variant="outline" 
        size="sm" 
        on:click={handleNewChat}
      >
        New Chat
      </Button>
      
      <Button 
        variant="outline" 
        size="sm" 
        on:click={handleClearChat} 
        disabled={$chatStore.messages.length === 0}
      >
        Clear
      </Button>
    </div>
  </div>
  
  <!-- Messages container -->
  <div class="flex-1 overflow-hidden">
    <VirtualizedChatList 
      bind:this={messageListComponent}
      messages={$chatStore.messages}
      loading={$chatStore.hasOwnProperty('isLoading') ? Boolean($chatStore?.isLoading) && !$chatStore.isStreaming : false}
    />
  </div>
  
  <!-- Input area -->
  <div class="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
    <ChatInput 
      bind:this={inputComponent}
      disabled={$chatStore.hasOwnProperty('isLoading') ? Boolean($chatStore?.isLoading) : false}
      placeholder={$chatStore.isStreaming ? 'Waiting for response...' : 'Type a message...'}
      on:messageSent={() => {
        if (messageListComponent) {
          // Use whatever scroll method is available
          try {
            if ('enableAutoScroll' in messageListComponent && 
typeof messageListComponent.enableAutoScroll === 'function') {
              messageListComponent.enableAutoScroll();
            } else if ('scrollToBottom' in messageListComponent && 
typeof messageListComponent.scrollToBottom === 'function') {
              messageListComponent.scrollToBottom();
            }
          } catch (e) {
            console.error('Error scrolling to bottom', e);
          }
        }
      }}
    />
  </div>
</section>