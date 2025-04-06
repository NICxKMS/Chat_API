<script>
  import { settings } from '$lib/stores/settings';
  
  // Props
  export let responseTime = 0; // in milliseconds
  export let promptTokens = 0;
  export let completionTokens = 0;
  export let totalTokens = 0;
  export let streaming = false;
  
  // Derived values
  $: tokenCost = calculateTokenCost(promptTokens, completionTokens);
  $: totalTokens = promptTokens + completionTokens;
  $: tokensPerSecond = responseTime > 0 ? Math.round((completionTokens / (responseTime / 1000)) * 10) / 10 : 0;
  
  // Format time for display
  function formatTime(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }
  
  // Calculate approximate token cost
  function calculateTokenCost(prompt, completion) {
    // These are example rates, adjust based on actual API pricing
    const promptRate = 0.0000015; // $0.0015 per 1000 tokens
    const completionRate = 0.000002; // $0.002 per 1000 tokens
    
    const cost = (prompt * promptRate) + (completion * completionRate);
    return cost.toFixed(6);
  }
</script>

{#if $settings.metricsEnabled}
  <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
    {#if responseTime > 0}
      <div title="Time taken to receive the full response">
        ⏱️ {formatTime(responseTime)}
      </div>
    {/if}
    
    {#if totalTokens > 0}
      <div title="Total tokens used in this exchange">
        🔤 {totalTokens} tokens
        <span class="text-gray-400 dark:text-gray-500">
          ({promptTokens} prompt, {completionTokens} completion)
        </span>
      </div>
    {/if}
    
    {#if tokensPerSecond > 0}
      <div title="Tokens generated per second">
        ⚡ {tokensPerSecond} tokens/sec
      </div>
    {/if}
    
    {#if tokenCost > 0}
      <div title="Estimated cost of this response">
        💰 ${tokenCost}
      </div>
    {/if}
    
    {#if streaming}
      <div class="text-primary-500 dark:text-primary-400 animate-pulse">
        ● Streaming
      </div>
    {/if}
  </div>
{/if}