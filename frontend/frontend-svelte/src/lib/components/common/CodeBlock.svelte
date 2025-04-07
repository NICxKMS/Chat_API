<!-- src/lib/components/common/CodeBlock.svelte -->
<script>
  import { onMount } from 'svelte';
  import hljs from 'highlight.js/lib/core';
  import { theme } from '$lib/stores/themeStore.js';
  import { 
    ClipboardDocumentCheckIcon, 
    ClipboardDocumentIcon 
  } from 'heroicons-svelte/24/outline';

  export let code = '';
  export let language = '';
  export let filename = '';
  export let showLineNumbers = true;

  let highlighted = '';
  let codeElement;
  let copied = false;
  let copyTimeout;

  // Format display language
  $: displayLanguage = language ? formatLanguage(language) : 'Text';

  function formatLanguage(lang) {
    const languageMap = {
      'js': 'JavaScript',
      'javascript': 'JavaScript',
      'ts': 'TypeScript',
      'typescript': 'TypeScript',
      'py': 'Python',
      'python': 'Python',
      'html': 'HTML',
      'css': 'CSS',
      'json': 'JSON',
      'jsx': 'React JSX',
      'tsx': 'React TSX',
      'shell': 'Shell',
      'bash': 'Bash',
      'sh': 'Shell',
      'sql': 'SQL',
      'rust': 'Rust',
      'go': 'Go',
      'java': 'Java',
      'c': 'C',
      'cpp': 'C++',
      'csharp': 'C#',
      'php': 'PHP',
      'ruby': 'Ruby',
      'swift': 'Swift',
      'kotlin': 'Kotlin',
      'dart': 'Dart',
      'yml': 'YAML',
      'yaml': 'YAML',
      'markdown': 'Markdown',
      'md': 'Markdown',
      'xml': 'XML',
      'graphql': 'GraphQL',
      'dockerfile': 'Dockerfile',
    };
    
    return languageMap[lang.toLowerCase()] || lang.charAt(0).toUpperCase() + lang.slice(1);
  }

  // Copy the code to the clipboard
  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(code);
      copied = true;
      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  }

  // Generate line numbers
  function generateLineNumbers() {
    const lines = code.split('\n');
    let lineNumbers = '';
    for (let i = 1; i <= lines.length; i++) {
      lineNumbers += `<span class="line-number">${i}</span>\n`;
    }
    return lineNumbers;
  }
  
  onMount(() => {
    if (language && hljs.getLanguage(language)) {
      try {
        highlighted = hljs.highlight(code, { language }).value;
      } catch (error) {
        console.error('Error highlighting code:', error);
        highlighted = hljs.highlightAuto(code).value;
      }
    } else {
      highlighted = hljs.highlightAuto(code).value;
    }
  });
</script>

<div class="code-block-wrapper my-4 rounded-md overflow-hidden border border-border-primary bg-code-bg">
  <!-- Header -->
  <div class="code-header flex items-center justify-between bg-foreground/10 px-3 py-1.5 text-xs">
    <div class="flex items-center gap-1.5">
      {#if filename}
        <span class="font-medium">{filename}</span>
      {:else}
        <span class="font-medium">{displayLanguage}</span>
      {/if}
    </div>
    <button 
      on:click={copyToClipboard}
      class="flex items-center gap-1 text-foreground/70 hover:text-foreground transition-colors py-1 px-1.5 rounded hover:bg-foreground/10"
      title="Copy code"
    >
      {#if copied}
        <ClipboardDocumentCheckIcon class="w-4 h-4" />
        <span>Copied!</span>
      {:else}
        <ClipboardDocumentIcon class="w-4 h-4" />
        <span>Copy</span>
      {/if}
    </button>
  </div>
  
  <!-- Code content -->
  <div class="code-container relative overflow-x-auto p-3 text-xs md:text-sm font-mono">
    {#if showLineNumbers}
      <div class="line-numbers absolute left-0 top-0 pt-3 pl-3 pr-2 text-foreground/30 select-none text-right">
        {@html generateLineNumbers()}
      </div>
      <pre class="pl-10"><code class={`language-${language}`}>{@html highlighted || code}</code></pre>
    {:else}
      <pre><code class={`language-${language}`}>{@html highlighted || code}</code></pre>
    {/if}
  </div>
</div>

<style>
  .code-block-wrapper {
    position: relative;
    font-size: 0.9em;
  }
  
  pre {
    margin: 0;
    padding: 0;
    background: transparent;
  }
  
  code {
    display: block;
    overflow-x: auto;
    line-height: 1.5;
  }
  
  .line-numbers {
    user-select: none;
    border-right: 1px solid var(--color-border-primary);
  }
  
  .line-number {
    display: block;
    line-height: 1.5;
  }
</style> 