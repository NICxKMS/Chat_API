<!-- src/lib/components/chat/GlobalMetricsBar.svelte -->
<script>
  import chatStore from '$lib/stores/chatStore.js';
  import { onMount } from 'svelte';

  let metrics = $chatStore.metrics;
  let elapsedTime = 0;
  let tokensPerSecond = 0;

  $: if (metrics.endTime && metrics.startTime) {
    elapsedTime = metrics.endTime - metrics.startTime;
    if (elapsedTime > 500 && metrics.tokenCount) {
      tokensPerSecond = Math.round((metrics.tokenCount / elapsedTime) * 1000);
    }
  }
</script>

<div class="flex items-center justify-between px-4 py-2 bg-card-bg/50 backdrop-blur-sm border-b border-border-secondary text-xs">
  <div class="flex items-center space-x-4">
    {#if metrics.tokenCount !== null}
      <span class="text-foreground/60">
        Tokens: {metrics.tokenCount}
        {#if tokensPerSecond > 0}
          <span class="ml-1 text-foreground/40">({tokensPerSecond}/s)</span>
        {/if}
      </span>
    {/if}
    {#if elapsedTime > 0}
      <span class="text-foreground/60">
        Time: {(elapsedTime / 1000).toFixed(1)}s
      </span>
    {/if}
  </div>
  {#if $chatStore.isWaitingForResponse}
    <span class="text-primary animate-pulse">Generating...</span>
  {/if}
</div> 