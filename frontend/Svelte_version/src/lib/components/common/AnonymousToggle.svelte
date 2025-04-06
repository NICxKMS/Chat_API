<script lang="ts">
  import { authStore, isAnonymousMode } from '$lib/stores/auth';
  import Toggle from '$lib/components/common/Toggle.svelte';
  import Tooltip from '$lib/components/common/Tooltip.svelte';
  
  export let label = 'Anonymous Mode';
  export let tooltipText = 'When enabled, you can use the chat without an account, but your conversations will not be saved between sessions.';
  
  function toggleAnonymousMode() {
    authStore.setAnonymousMode(!$isAnonymousMode);
  }
</script>

<div class="flex items-center gap-2">
  <Toggle 
    checked={$isAnonymousMode} 
    on:change={toggleAnonymousMode}
    size="sm"
  />
  <div class="relative inline-block">
    <span class="text-sm text-gray-600 dark:text-gray-300">{label}</span>
    <Tooltip position="top">
      <div class="max-w-xs p-2">{tooltipText}</div>
    </Tooltip>
  </div>
</div>
