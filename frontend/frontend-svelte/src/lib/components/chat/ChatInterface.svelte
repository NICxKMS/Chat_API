<!-- src/lib/components/chat/ChatInterface.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { theme } from '$lib/stores/ui';
  import ChatHistory from './ChatHistory.svelte';
  import ChatInput from './ChatInput.svelte';
  import MessageList from './MessageList.svelte';
  import TypingIndicator from './TypingIndicator.svelte';
  import GlobalMetricsBar from './GlobalMetricsBar.svelte';

  export let messages = [];
  export let isLoading = false;
  export let error = null;

  const dispatch = createEventDispatcher();

  function handleSubmit(event) {
    dispatch('submit', event.detail);
  }

  function toggleTheme() {
    theme.update(value => value === 'light' ? 'dark' : 'light');
  }
</script>

<div class="flex flex-col h-full">
  <GlobalMetricsBar />
  
  <div class="flex-1 overflow-y-auto">
    <MessageList {messages} />
    {#if isLoading}
      <TypingIndicator />
    {/if}
    {#if error}
      <div class="p-4 text-error">
        {error}
      </div>
    {/if}
  </div>

  <ChatInput
    on:submit={handleSubmit}
    disabled={isLoading}
  />
</div> 