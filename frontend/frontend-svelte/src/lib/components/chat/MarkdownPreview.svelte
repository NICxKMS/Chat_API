<!-- src/lib/components/chat/MarkdownPreview.svelte -->
<script>
  import { marked } from 'marked';
  import { onMount } from 'svelte';

  export let content = '';
  export let isVisible = false;
  
  let renderedContent = '';
  
  // Configure marked renderer
  const renderer = new marked.Renderer();
  marked.setOptions({
    gfm: true,
    breaks: true,
    sanitize: false,
    renderer: renderer
  });
  
  // Update rendered content when input changes
  $: {
    if (content) {
      try {
        renderedContent = marked.parse(content);
      } catch (e) {
        console.error('Error parsing markdown:', e);
        renderedContent = '<p>Error parsing markdown</p>';
      }
    } else {
      renderedContent = '<p class="text-foreground/40 italic">Preview will appear here...</p>';
    }
  }
</script>

{#if isVisible}
  <div class="markdown-preview border border-border-primary rounded-md p-3 bg-card-bg text-foreground overflow-auto max-h-[200px] mb-3">
    <div class="text-xs font-medium mb-2 text-foreground/50">Markdown Preview</div>
    <div class="prose prose-sm dark:prose-invert max-w-none">
      {@html renderedContent}
    </div>
  </div>
{/if}

<style>
  :global(.markdown-preview code) {
    font-family: var(--font-family-mono);
    background-color: var(--color-code-bg);
    padding: 0.1em 0.3em;
    border-radius: 0.25rem;
    font-size: 0.875em;
  }
  
  :global(.markdown-preview pre) {
    padding: 0.5rem;
    border-radius: 0.375rem;
    background-color: var(--color-code-bg);
  }
  
  :global(.markdown-preview pre code) {
    background-color: transparent;
    padding: 0;
  }
</style> 