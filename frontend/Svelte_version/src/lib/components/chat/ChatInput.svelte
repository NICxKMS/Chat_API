<script>
  import { createEventDispatcher } from 'svelte';
  import AutoResizingTextarea from '$lib/components/common/AutoResizingTextarea.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { chatStore } from '$lib/stores/chat';
  
  // Props
  export let disabled = false;
  export let placeholder = 'Type a message...';
  
  // Local state
  let inputValue = '';
  let inputComponent;
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Handle message submission
  async function handleSubmit() {
    if (!inputValue.trim() || disabled || $chatStore.isStreaming) return;
    
    const message = inputValue.trim();
    dispatch('submit', message);
    
    try {
      inputValue = ''; // Clear input immediately for better UX
      await chatStore.sendMessage(message);
      dispatch('messageSent', message); // Dispatch event after message is sent
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }
  
  // Handle stop streaming
  function handleStop() {
    chatStore.stopStreaming();
    dispatch('stopStreaming');
  }
  
  // Focus the input
  export function focus() {
    if (inputComponent) {
      inputComponent.focus();
    }
  }
</script>

<div class="flex flex-col gap-2">
  <div class="flex gap-2 items-end">
    <div class="flex-1">
      <AutoResizingTextarea
        bind:this={inputComponent}
        bind:value={inputValue}
        {placeholder}
        disabled={disabled || $chatStore.isStreaming}
        autoFocus={true}
        minRows={1}
        maxRows={5}
        on:submit={handleSubmit}
      />
    </div>
    
    <div>
      {#if $chatStore.isStreaming}
        <Button 
          variant="outline" 
          on:click={handleStop}
        >
          Stop
        </Button>
      {:else}
        <Button 
          disabled={!inputValue.trim() || disabled}
          on:click={handleSubmit}
        >
          Send
        </Button>
      {/if}
    </div>
  </div>
  
  {#if $chatStore.error}
    <div class="text-red-500 text-sm mt-1">
      {$chatStore.error}
    </div>
  {/if}
</div>