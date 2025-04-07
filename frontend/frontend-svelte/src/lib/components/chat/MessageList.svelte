<!-- src/lib/components/chat/MessageList.svelte -->
<script>
  import { onMount, beforeUpdate, afterUpdate } from 'svelte';
  import ChatMessage from './ChatMessage.svelte';
  import TypingIndicator from './TypingIndicator.svelte';
  import chatStore from '$lib/stores/chatStore.js';
  import chatHistoryStore from '$lib/stores/chatHistoryStore.js';

  export let messages = [];
  export let error = null;

  let messageListRef;
  let wasNearBottom = true;
  let editingMessageId = null;
  let editingMessageContent = '';
  let editingMessageFiles = [];

  // Check if user is near bottom before updates
  beforeUpdate(() => {
    if (messageListRef) {
      const { scrollTop, scrollHeight, clientHeight } = messageListRef;
      wasNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    }
  });

  // Scroll to bottom after updates if user was near bottom
  afterUpdate(() => {
    if (messageListRef && wasNearBottom) {
      messageListRef.scrollTop = messageListRef.scrollHeight;
    }
  });

  // Handle error recovery actions
  const handleErrorRecovery = async (action) => {
    switch (action) {
      case 'retry':
        await chatStore.retryLastMessage();
        break;
      case 'reauthenticate':
        // This should be handled by the auth system
        window.location.reload();
        break;
      default:
        console.warn('Unknown recovery action:', action);
    }
  };

  // Start editing a message
  function startEditingMessage(message) {
    editingMessageId = message.id;
    editingMessageContent = message.content;
    editingMessageFiles = message.files || [];
  }

  // Save edited message
  async function saveMessage() {
    if (editingMessageId && (editingMessageContent.trim() || editingMessageFiles.length > 0)) {
      // Find the message in the current chat
      const messageIndex = $chatStore.messages.findIndex(msg => msg.id === editingMessageId);
      
      if (messageIndex !== -1) {
        // Update the message in the chat store
        const updatedMessages = [...$chatStore.messages];
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          content: editingMessageContent.trim(),
          files: editingMessageFiles
        };
        
        // Update the chat store
        chatStore.setMessages(updatedMessages);
        
        // If this chat is saved, update it in the history
        const currentChat = $chatHistoryStore.find(chat => 
          JSON.stringify(chat.messages) === JSON.stringify($chatStore.messages)
        );
        
        if (currentChat) {
          await chatHistoryStore.updateChat(currentChat.id, { messages: updatedMessages });
        }
      }
      
      editingMessageId = null;
      editingMessageFiles = [];
    }
  }

  // Cancel message editing
  function cancelMessageEditing() {
    editingMessageId = null;
    editingMessageContent = '';
    editingMessageFiles = [];
  }

  // Handle file change during edit
  function handleFileChange(event) {
    editingMessageFiles = event.detail.files;
  }

  // Remove file from editing message
  function removeFile(index) {
    editingMessageFiles = editingMessageFiles.filter((_, i) => i !== index);
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
        const currentChat = $chatHistoryStore.find(chat => 
          JSON.stringify(chat.messages) === JSON.stringify($chatStore.messages)
        );
        
        if (currentChat) {
          await chatHistoryStore.updateChat(currentChat.id, { messages: updatedMessages });
        }
      }
    }
  }
</script>

<div 
  bind:this={messageListRef}
  class="flex-1 overflow-y-auto p-4 space-y-4"
>
  {#if messages.length === 0 && !$chatStore.isWaitingForResponse}
    <div class="flex flex-col items-center justify-center h-full text-center p-8">
      <h2 class="text-2xl font-semibold mb-2">Welcome to AI Chat!</h2>
      <p class="text-foreground/60">Select a model above and start your conversation.</p>
    </div>
  {:else}
    {#each messages as message (message.id)}
      <ChatMessage 
        {message} 
        onEdit={startEditingMessage}
        onDelete={deleteMessage}
      />
    {/each}

    {#if $chatStore.isWaitingForResponse && messages.length > 0}
      <TypingIndicator />
    {/if}

    {#if error}
      <div class="flex flex-col items-center p-4 bg-error/10 rounded-lg border border-error/20">
        <p class="text-error mb-2">{error.message}</p>
        {#if error.recoveryAction}
          <button
            class="px-3 py-1 bg-error/20 hover:bg-error/30 text-error rounded transition-colors"
            on:click={() => handleErrorRecovery(error.recoveryAction)}
          >
            {error.recoveryAction === 'retry' ? 'Retry' : 'Reauthenticate'}
          </button>
        {/if}
      </div>
    {/if}
  {/if}
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
      
      <!-- Files display in editing mode -->
      {#if editingMessageFiles.length > 0}
        <div class="mt-2 space-y-2">
          <p class="text-sm text-foreground/70">Attached files:</p>
          {#each editingMessageFiles as file, i}
            <div class="flex items-center justify-between p-2 bg-foreground/5 rounded">
              <span class="text-sm truncate">{file.name}</span>
              <button
                on:click={() => removeFile(i)}
                class="p-1 text-foreground/50 hover:text-error hover:bg-error/10 rounded transition-colors"
              >
                Remove
              </button>
            </div>
          {/each}
        </div>
      {/if}
      
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
          disabled={!editingMessageContent.trim() && editingMessageFiles.length === 0}
        >
          Save
        </button>
      </div>
    </div>
  </div>
{/if} 