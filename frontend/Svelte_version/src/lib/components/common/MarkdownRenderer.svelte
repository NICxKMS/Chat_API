<script>
  import { onMount } from 'svelte';
  import { settings } from '$lib/stores/settings';
  
  // Props
  export let content = '';
  export let highlightEnabled = true;
  
  // Element reference
  let markdownContainer;
  
  // Handle markdown rendering on mount and content updates
  $: if (markdownContainer && content) {
    renderMarkdown();
  }
  
  onMount(() => {
    if (content) {
      renderMarkdown();
    }
  });
  
  // Simple markdown rendering for essential elements
  // In a production app, you'd use a full Markdown parser like mdsvex
  async function renderMarkdown() {
    if (!markdownContainer) return;
    
    // In this simplified version, we'll handle basic markdown
    // For a complete implementation, use mdsvex or other Markdown libraries
    
    // Process code blocks
    let processedContent = content.replace(/```(\w*)([\s\S]*?)```/g, (match, language, code) => {
      return `<pre class="language-${language || 'text'}"><code>${escapeHtml(code.trim())}</code></pre>`;
    });
    
    // Process inline code
    processedContent = processedContent.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Process bold text
    processedContent = processedContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Process italic text
    processedContent = processedContent.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Process links
    processedContent = processedContent.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary-600 hover:underline">$1</a>');
    
    // Process lists
    processedContent = processedContent.replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>');
    processedContent = processedContent.replace(/(<li>.*<\/li>)/s, '<ul class="list-disc pl-5 my-2">$1</ul>');
    
    // Process headers
    processedContent = processedContent.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold my-2">$1</h3>');
    processedContent = processedContent.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold my-3">$1</h2>');
    processedContent = processedContent.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold my-4">$1</h1>');
    
    // Process paragraphs (must be done last)
    processedContent = processedContent.replace(/^(?!<[uo]l|<li|<h[1-6]|<pre|<code)(.+)$/gm, '<p class="my-2">$1</p>');
    
    // Set innerHTML
    markdownContainer.innerHTML = processedContent;
    
    // Apply syntax highlighting if enabled
    if (highlightEnabled && window.Prism) {
      window.Prism.highlightAllUnder(markdownContainer);
    }
  }
  
  // Helper function to escape HTML
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
</script>

<div 
  bind:this={markdownContainer}
  class="prose dark:prose-invert max-w-none break-words"
  class:text-sm={$settings.fontSize === 'small'}
  class:text-base={$settings.fontSize === 'medium'}
  class:text-lg={$settings.fontSize === 'large'}
>
  {#if !content}
    <p class="my-1 text-gray-400 dark:text-gray-600 italic">Empty message</p>
  {/if}
</div>

<style>
  /* Basic styling for code blocks */
  :global(.prose pre) {
    background-color: #2d2d2d;
    color: #ccc;
    border-radius: 0.375rem;
    padding: 1rem;
    overflow-x: auto;
    margin: 1rem 0;
  }
  
  :global(.prose code) {
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 0.25rem;
    padding: 0.125rem 0.25rem;
    font-family: monospace;
  }
  
  :global(.dark .prose code) {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  :global(.prose a) {
    color: #2563eb;
    text-decoration: none;
  }
  
  :global(.prose a:hover) {
    text-decoration: underline;
  }
  
  :global(.dark .prose a) {
    color: #60a5fa;
  }
</style>