<!-- src/lib/components/chat/TypingIndicator.svelte -->
<script>
  import { onMount } from 'svelte';
  import chatStore from '$lib/stores/chatStore.js';

  let dots = '';
  let intervalId;

  onMount(() => {
    intervalId = setInterval(() => {
      dots = dots.length >= 3 ? '' : dots + '.';
    }, 500);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  });
</script>

<div class="flex items-center space-x-2 p-4 bg-card-bg/50 rounded-lg border border-border-secondary">
  <div class="flex space-x-1">
    <div class="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div class="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div class="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
  </div>
  <span class="text-sm text-foreground/60">AI is thinking{dots}</span>
</div> 