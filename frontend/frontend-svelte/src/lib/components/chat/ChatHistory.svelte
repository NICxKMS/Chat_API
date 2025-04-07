<!-- src/lib/components/chat/ChatHistory.svelte -->
<script>
  import { onMount } from 'svelte';
  import chatHistoryStore from '$lib/stores/chatHistoryStore.js';
  import chatStore from '$lib/stores/chatStore.js';
  import modelStore from '$lib/stores/modelStore.js';
  import settingsStore from '$lib/stores/settingsStore.js';
  import { formatDistanceToNow } from 'date-fns';
  
  // Icons
  import { 
    TrashIcon, 
    PencilIcon, 
    CheckIcon, 
    XMarkIcon, 
    MagnifyingGlassIcon, 
    ChatBubbleLeftIcon, 
    ArrowDownTrayIcon, 
    ArrowUpTrayIcon 
  } from 'heroicons-svelte/24/outline';

  // Props
  export let isCollapsed = false;

  // State
  let editingChatId = null;
  let editingTitle = '';
  let searchQuery = '';
  let searchTimeout = null;
  let isSearching = false;
  let searchResults = [];
  let selectedChat = null;
  let editingMessageId = null;
  let editingMessageContent = '';
  let fileInput;

  // Subscribe to stores
  $: chats = $chatHistoryStore;
  $: isLoading = $chatHistoryStore.isLoading;
  $: error = $chatHistoryStore.error;

  // Filter chats based on search query
  $: filteredChats = searchQuery 
    ? searchResults 
    : chats;

  // Load chats on mount
  onMount(() => {
    chatHistoryStore.loadChats();
  });

  // Handle search input
  function handleSearch() {
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set a timeout to avoid too many searches while typing
    searchTimeout = setTimeout(async () => {
      if (searchQuery.trim()) {
        isSearching = true;
        searchResults = await chatHistoryStore.searchChats(searchQuery);
        isSearching = false;
      } else {
        searchResults = [];
      }
    }, 300);
  }

  // Export chat history
  async function exportChatHistory() {
    const jsonData = await chatHistoryStore.exportChats();
    if (jsonData) {
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-history-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // Import chat history
  async function importChatHistory(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const jsonString = e.target.result;
        const success = await chatHistoryStore.importChats(jsonString);
        if (success) {
          alert('Chat history imported successfully!');
        }
      };
      reader.readAsText(file);
    }
  }

  // Start editing a chat title
  function startEditing(chat) {
    editingChatId = chat.id;
    editingTitle = chat.title;
  }

  // Save edited title
  async function saveTitle() {
    if (editingChatId && editingTitle.trim()) {
      await chatHistoryStore.updateChat(editingChatId, { title: editingTitle.trim() });
      editingChatId = null;
    }
  }

  // Cancel editing
  function cancelEditing() {
    editingChatId = null;
    editingTitle = '';
  }

  // Load a chat
  async function loadChat(chat) {
    selectedChat = chat;
    
    // Update model if different
    if (chat.model?.id !== $modelStore.selectedModel?.id) {
      await modelStore.selectModel(chat.model.id);
    }

    // Update settings if different
    const currentSettings = $settingsStore.settings;
    if (JSON.stringify(chat.settings) !== JSON.stringify(currentSettings)) {
      Object.entries(chat.settings).forEach(([key, value]) => {
        settingsStore.updateSetting(key, value);
      });
    }

    // Load messages
    chatStore.resetChat();
    chat.messages.forEach(msg => {
      chatStore.addMessage(msg);
    });
  }

  // Delete a chat
  async function deleteChat(id) {
    if (confirm('Are you sure you want to delete this chat?')) {
      await chatHistoryStore.deleteChat(id);
    }
  }

  // Save current chat
  async function saveCurrentChat() {
    const chat = {
      title: $chatStore.messages[0]?.content.slice(0, 50) + '...' || 'New Chat',
      messages: $chatStore.messages,
      model: $modelStore.selectedModel,
      settings: $settingsStore.settings
    };
    await chatHistoryStore.saveChat(chat);
  }

  // Start editing a message
  function startEditingMessage(message) {
    editingMessageId = message.id;
    editingMessageContent = message.content;
  }

  // Save edited message
  async function saveMessage() {
    if (editingMessageId && editingMessageContent.trim()) {
      // Find the message in the current chat
      const messageIndex = $chatStore.messages.findIndex(msg => msg.id === editingMessageId);
      
      if (messageIndex !== -1) {
        // Update the message in the chat store
        const updatedMessages = [...$chatStore.messages];
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          content: editingMessageContent.trim()
        };
        
        // Update the chat store
        chatStore.setMessages(updatedMessages);
        
        // If this chat is saved, update it in the history
        if (selectedChat) {
          await chatHistoryStore.updateChat(selectedChat.id, { messages: updatedMessages });
        }
      }
      
      editingMessageId = null;
    }
  }

  // Cancel message editing
  function cancelMessageEditing() {
    editingMessageId = null;
    editingMessageContent = '';
  }

  // Delete a message
  async function deleteMessage(messageId) {
    if (confirm('Are you sure you want to delete this message?')) {
      // Find the message in the current chat
      const messageIndex = $chatStore.messages.findIndex(msg => msg.id === messageId);
      
      if (messageIndex !== -1) {
        // Remove the message from the chat store
        const updatedMessages = [...$chatStore.messages];
        updatedMessages.splice(messageIndex, 1);
        
        // Update the chat store
        chatStore.setMessages(updatedMessages);
        
        // If this chat is saved, update it in the history
        if (selectedChat) {
          await chatHistoryStore.updateChat(selectedChat.id, { messages: updatedMessages });
        }
      }
    }
  }
</script>

<div class="flex flex-col h-full">
  <!-- Header -->
  <div class="p-4 border-b border-border-primary">
    <div class="flex items-center justify-between mb-2">
      <h2 class="text-lg font-semibold">Chat History</h2>
      <div class="flex items-center gap-2">
        <button
          on:click={exportChatHistory}
          class="p-1.5 text-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded-md transition-colors"
          title="Export chat history"
        >
          <ArrowDownTrayIcon class="w-4 h-4" />
        </button>
        <label
          class="p-1.5 text-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded-md transition-colors cursor-pointer"
          title="Import chat history"
        >
          <ArrowUpTrayIcon class="w-4 h-4" />
          <input
            type="file"
            accept=".json"
            on:change={importChatHistory}
            class="hidden"
            bind:this={fileInput}
          />
        </label>
      </div>
    </div>
    <div class="relative">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <MagnifyingGlassIcon class="w-4 h-4 text-foreground/50" />
      </div>
      <input
        type="text"
        bind:value={searchQuery}
        on:input={handleSearch}
        placeholder="Search chats and messages..."
        class="w-full pl-9 pr-3 py-1.5 text-sm bg-input-bg border border-border-primary rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  </div>

  <!-- Chat List -->
  <div class="flex-1 overflow-y-auto">
    {#if isLoading || isSearching}
      <div class="flex items-center justify-center p-4">
        <div class="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
      </div>
    {:else if error}
      <div class="p-4 text-error-text text-sm">{error}</div>
    {:else if filteredChats.length === 0}
      <div class="p-4 text-foreground/50 text-sm text-center">
        {searchQuery ? 'No chats match your search' : 'No saved chats yet'}
      </div>
    {:else}
      <div class="divide-y divide-border-primary">
        {#each filteredChats as chat (chat.id)}
          <div class="group p-3 hover:bg-foreground/5 transition-colors">
            {#if editingChatId === chat.id}
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  bind:value={editingTitle}
                  class="flex-1 px-2 py-1 text-sm bg-input-bg border border-border-primary rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  on:keydown={(e) => e.key === 'Enter' && saveTitle()}
                />
                <button
                  on:click={saveTitle}
                  class="p-1 text-success-text hover:bg-success-text/10 rounded-md transition-colors"
                  title="Save"
                >
                  <CheckIcon class="w-4 h-4" />
                </button>
                <button
                  on:click={cancelEditing}
                  class="p-1 text-error-text hover:bg-error-text/10 rounded-md transition-colors"
                  title="Cancel"
                >
                  <XMarkIcon class="w-4 h-4" />
                </button>
              </div>
            {:else}
              <div class="flex items-start gap-2">
                <button
                  on:click={() => loadChat(chat)}
                  class="flex-1 text-left"
                >
                  <div class="font-medium text-sm line-clamp-1">{chat.title}</div>
                  <div class="text-xs text-foreground/50">
                    {formatDistanceToNow(chat.timestamp, { addSuffix: true })}
                  </div>
                </button>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    on:click={() => startEditing(chat)}
                    class="p-1 text-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded-md transition-colors"
                    title="Rename"
                  >
                    <PencilIcon class="w-4 h-4" />
                  </button>
                  <button
                    on:click={() => deleteChat(chat.id)}
                    class="p-1 text-foreground/50 hover:text-error-text hover:bg-error-text/10 rounded-md transition-colors"
                    title="Delete"
                  >
                    <TrashIcon class="w-4 h-4" />
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Footer -->
  <div class="p-4 border-t border-border-primary">
    <button
      on:click={saveCurrentChat}
      class="w-full px-4 py-2 text-sm font-medium text-primary-text bg-primary rounded-md hover:bg-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      Save Current Chat
    </button>
  </div>
</div>

<!-- Message Editing Modal -->
{#if editingMessageId}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-sidebar-bg rounded-lg shadow-lg w-full max-w-lg p-4">
      <h3 class="text-lg font-semibold mb-2">Edit Message</h3>
      <textarea
        bind:value={editingMessageContent}
        class="w-full h-32 px-3 py-2 text-sm bg-input-bg border border-border-primary rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder="Message content..."
      ></textarea>
      <div class="flex justify-end gap-2 mt-4">
        <button
          on:click={cancelMessageEditing}
          class="px-3 py-1.5 text-sm font-medium text-foreground bg-foreground/10 rounded-md hover:bg-foreground/20 transition-colors"
        >
          Cancel
        </button>
        <button
          on:click={saveMessage}
          class="px-3 py-1.5 text-sm font-medium text-primary-text bg-primary rounded-md hover:bg-primary/90 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  </div>
{/if} 