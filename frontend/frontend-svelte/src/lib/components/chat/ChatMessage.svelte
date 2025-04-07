<!-- src/lib/components/chat/ChatMessage.svelte -->
<script>
  import { marked } from 'marked';
  import { onMount, onDestroy } from 'svelte';
  import { 
    UserCircleIcon, 
    PencilIcon, 
    TrashIcon, 
    DocumentIcon, 
    ArrowDownTrayIcon, 
    PaperClipIcon 
  } from 'heroicons-svelte/24/outline';
  import { SparklesIcon } from 'heroicons-svelte/24/solid';
  import hljs from 'highlight.js/lib/core';
  import javascript from 'highlight.js/lib/languages/javascript';
  import python from 'highlight.js/lib/languages/python';
  import typescript from 'highlight.js/lib/languages/typescript';
  import css from 'highlight.js/lib/languages/css';
  import xml from 'highlight.js/lib/languages/xml'; // For HTML
  import shell from 'highlight.js/lib/languages/shell';
  import json from 'highlight.js/lib/languages/json';
  import sql from 'highlight.js/lib/languages/sql';
  import 'highlight.js/styles/github-dark.css'; // Import a theme (will adapt to light/dark)
  import CodeBlock from '$lib/components/common/CodeBlock.svelte';

  export let message = { role: 'user', content: '', id: '', files: [] };
  export let onEdit = null;
  export let onDelete = null;

  let contentEl;
  let codeBlocks = [];

  // Register common languages for highlighting
  onMount(() => {
    hljs.registerLanguage('javascript', javascript);
    hljs.registerLanguage('python', python);
    hljs.registerLanguage('typescript', typescript);
    hljs.registerLanguage('css', css);
    hljs.registerLanguage('html', xml);
    hljs.registerLanguage('shell', shell);
    hljs.registerLanguage('json', json);
    hljs.registerLanguage('sql', sql);
    
    // Parse/render code blocks after markdown is rendered
    if (message.role === 'assistant') {
      renderCodeBlocks();
    }
  });

  // Cleanup on component destroy
  onDestroy(() => {
    // Clean up any event listeners or state if needed
    codeBlocks = [];
  });

  // Create a custom renderer for code blocks
  const renderer = new marked.Renderer();
  
  // Store code blocks to be rendered as Svelte components
  renderer.code = (code, language, isEscaped) => {
    // Check for filename format (e.g., ```javascript:filename.js)
    let filename = '';
    if (language && language.includes(':')) {
      const parts = language.split(':');
      language = parts[0];
      filename = parts[1];
    }
    
    // Generate a unique ID for this code block
    const id = `code-block-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Store the code block info for later rendering
    codeBlocks.push({ id, code, language, filename });
    
    // Return placeholder div to be replaced
    return `<div id="${id}" class="code-block-placeholder"></div>`;
  };

  // Parse and render code blocks as Svelte components
  function renderCodeBlocks() {
    if (!contentEl || codeBlocks.length === 0) return;
    
    // Find all placeholders and replace with CodeBlock components
    codeBlocks.forEach(({ id, code, language, filename }) => {
      const placeholder = contentEl.querySelector(`#${id}`);
      if (placeholder) {
        // Create and mount the CodeBlock component
        new CodeBlock({
          target: placeholder,
          props: { code, language, filename }
        });
      }
    });
  }

  // Basic configuration for marked with our custom renderer
  marked.setOptions({
    gfm: true, // Enable GitHub Flavored Markdown
    breaks: true, // Convert single line breaks to <br>
    sanitize: false, // IMPORTANT: Set to true or use DOMPurify if content is potentially unsafe
    renderer: renderer,
    langPrefix: 'language-', // CSS class prefix for code blocks
  });

  let renderedContent = '';
  let isHovered = false;

  // Format file size
  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
  }

  // Get file icon based on file type
  function getFileIcon(file) {
    if (file.type?.startsWith('image/')) {
      return null; // Images will be shown directly
    }
    return DocumentIcon;
  }
  
  // Create object URL for file preview
  function getPreviewUrl(file) {
    if (file.type?.startsWith('image/')) {
      return URL.createObjectURL(file);
    }
    return null;
  }
  
  // Handle file download
  function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  // Use reactive declaration to re-render markdown when content changes
  $: {
    if (message.role === 'assistant' && message.content) {
      try {
        // Reset code blocks array before parsing new content
        codeBlocks = [];
        renderedContent = marked.parse(message.content);
        // We need to wait for the next tick for the DOM to update
        setTimeout(() => {
          renderCodeBlocks();
        }, 0);
      } catch (e) {
        console.error("Markdown parsing error:", e);
        renderedContent = `<p class="text-error">Error rendering message content.</p>`;
      }
    } else {
      // For user messages or empty content, just use the raw content
      renderedContent = message.content || '';
    }
  }

  // Check if message has files
  $: hasFiles = message.files && message.files.length > 0;

  // Determine styling based on role
  $: isUser = message.role === 'user';
  $: containerClasses = `flex gap-3 my-4 text-foreground ${isUser ? 'justify-end' : ''}`;
  $: bubbleClasses = `p-3 rounded-lg max-w-[80%] md:max-w-[70%] lg:max-w-[60%] shadow-sm ${isUser ? 'bg-primary/10 dark:bg-primary/20 order-2' : 'bg-card-bg border border-border-primary order-1'}`;
  $: iconClasses = `flex-shrink-0 w-6 h-6 rounded-full ${isUser ? 'text-primary order-1' : 'text-secondary order-2'}`;
  $: contentClasses = `prose prose-sm dark:prose-invert max-w-none break-words ${ 
    isUser ? '' : '' // Add specific prose adjustments if needed
  } prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-blockquote:my-2 prose-pre:my-3 prose-code:text-sm prose-code:before:content-none prose-code:after:content-none prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-code-bg`;

  // Handle edit button click
  function handleEdit() {
    if (onEdit) {
      onEdit(message);
    }
  }

  // Handle delete button click
  function handleDelete() {
    if (onDelete) {
      onDelete(message.id);
    }
  }
</script>

<div 
  class={containerClasses}
  on:mouseenter={() => isHovered = true}
  on:mouseleave={() => isHovered = false}
>
    {#if !isUser}
    <div class={iconClasses} title="Assistant">
      <SparklesIcon />
    </div>
    {/if}
    <div class={bubbleClasses}>
        <!-- Message content -->
        {#if isUser}
            {#if message.content}
              <p class="whitespace-pre-wrap text-sm">{message.content}</p>
            {/if}
        {:else}
            <!-- Render parsed Markdown for assistant -->
            {#if message.content}
              <div class={contentClasses} key={message.id} bind:this={contentEl}>
                {@html renderedContent}
              </div>
            {/if}
        {/if}
        
        <!-- Files -->
        {#if hasFiles}
          <div class="mt-2 {message.content ? 'pt-2 border-t border-border-primary/50' : ''}">
            <div class="flex items-center gap-1 mb-2 text-xs text-foreground/70">
              <PaperClipIcon class="w-3.5 h-3.5" />
              <span>Attachments ({message.files.length})</span>
            </div>
            
            <div class="flex flex-wrap gap-2">
              {#each message.files as file, i}
                <div class="bg-foreground/5 rounded-md overflow-hidden border border-border-primary">
                  <!-- Image preview -->
                  {#if file.type?.startsWith('image/')}
                    <div class="relative">
                      <img 
                        src={getPreviewUrl(file)} 
                        alt={file.name} 
                        class="max-w-[200px] max-h-[150px] object-contain"
                      />
                      <button
                        type="button"
                        on:click={() => downloadFile(file)}
                        class="absolute bottom-1 right-1 p-1.5 rounded-full bg-background/80 text-foreground hover:bg-background transition-colors"
                        title="Download"
                      >
                        <ArrowDownTrayIcon class="w-4 h-4" />
                      </button>
                    </div>
                  {:else}
                    <!-- File info -->
                    <div class="p-2 flex items-center gap-2">
                      <div class="w-8 h-8 bg-foreground/10 rounded flex items-center justify-center">
                        <svelte:component this={getFileIcon(file)} class="w-5 h-5 text-foreground/70" />
                      </div>
                      
                      <div class="flex-1 min-w-0">
                        <div class="text-xs font-medium truncate">{file.name}</div>
                        <div class="text-xs text-foreground/60">{formatFileSize(file.size)}</div>
                      </div>
                      
                      <button
                        type="button"
                        on:click={() => downloadFile(file)}
                        class="p-1.5 text-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded transition-colors"
                        title="Download"
                      >
                        <ArrowDownTrayIcon class="w-4 h-4" />
                      </button>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
        
        <!-- Action buttons that appear on hover -->
        {#if isHovered && onEdit && onDelete}
          <div class="flex justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              on:click={handleEdit}
              class="p-1 text-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded-md transition-colors"
              title="Edit message"
            >
              <PencilIcon class="w-3.5 h-3.5" />
            </button>
            <button
              on:click={handleDelete}
              class="p-1 text-foreground/50 hover:text-error-text hover:bg-error-text/10 rounded-md transition-colors"
              title="Delete message"
            >
              <TrashIcon class="w-3.5 h-3.5" />
            </button>
          </div>
        {/if}
    </div>
     {#if isUser}
     <div class={iconClasses} title="User">
       <UserCircleIcon />
     </div>
     {/if}
</div>

<style>
    /* Add any necessary global overrides for prose styling within messages */
   :global(.prose code) {
     font-family: var(--font-family-mono);
   }
   
   /* Make inline code different from code blocks */
   :global(p code) {
     background-color: var(--color-code-bg);
     padding: 0.1em 0.3em;
     border-radius: 0.25rem;
     font-size: 0.875em;
   }
   
   /* Add empty space for code block to render */
   :global(.code-block-placeholder) {
     min-height: 3rem;
     margin: 1rem 0;
   }
</style> 