<script>
  import { onMount } from 'svelte';
  import { resolvedTheme } from '$lib/stores/theme';
  import '../app.css';
  
  // Handle theme changes
  $: if (typeof document !== 'undefined') {
    if ($resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
  
  // Initialize theme on mount
  onMount(() => {
    // Force theme class to be applied on initial load
    if ($resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });
</script>

<svelte:head>
  <title>Chat Application</title>
  <meta name="description" content="A chat application with AI language models" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <slot />
</div>