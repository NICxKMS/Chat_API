<script>
  import { onMount, afterUpdate } from 'svelte';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import hljs from 'highlight.js';
  
  // Props
  export let message = {};
  export let highlighted = false;
  
  // Constants
  const USER_ROLE = 'user';
  const ASSISTANT_ROLE = 'assistant';
  const SYSTEM_ROLE = 'system';
  
  // Component state
  let parsedContent = '';
  let isCodeBlock = false;
  let showCopyButton = false;
  let copySuccess = false;
  let copyTimeout;
  let contentElement;
  
  // Lifecycle
  onMount(() => {
    // Initialize the highlight.js renderer
    marked.setOptions({
      highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      },
      langPrefix: 'hljs language-'
    });
  });
  
  // Parse message content when it changes
  $: if (message?.content) {
    parseContent(message.content);
  }
  
  // Format timestamp
  $: formattedTime = message?.timestamp ? formatTime(message.timestamp) : '';
  
  // Parse and sanitize markdown content
  function parseContent(content) {
    try {
      // Check if content is a code block
      isCodeBlock = /^```[\s\S]*```$/.test(content.trim());
      
      // Parse markdown to HTML
      const rawHtml = marked(content);
      
      // Sanitize HTML to prevent XSS
      parsedContent = DOMPurify.sanitize(rawHtml);
    } catch (error) {
      console.error('Error parsing message content:', error);
      parsedContent = content;
    }
  }
  
  // Format timestamp
  function formatTime(timestamp) {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return '';
    }
  }
  
  // Copy code to clipboard
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      copySuccess = true;
      clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => {
        copySuccess = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }
  
  // Handle copy button click for code blocks
  function handleCopyClick(event) {
    // Find the nearest code element
    const codeElement = event.target.closest('.relative').querySelector('pre code');
    if (codeElement) {
      copyToClipboard(codeElement.textContent);
    }
  }
</script>

<div 
  class="flex flex-col mb-4 group transition-colors duration-200 {highlighted ? 'bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2 -mx-2' : ''}"
  class:justify-end={message.role === USER_ROLE}
>
  <div 
    class="flex flex-col max-w-[80%] {message.role === USER_ROLE ? 'ml-auto items-end' : 'mr-auto items-start'}"
  >
    <!-- Sender name -->
    <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">
      {#if message.role === USER_ROLE}
        You
      {:else if message.role === ASSISTANT_ROLE}
        Assistant
      {:else if message.role === SYSTEM_ROLE}
        System
      {:else}
        {message.role || 'Unknown'}
      {/if}
      
      {#if formattedTime}
        <span class="ml-2">{formattedTime}</span>
      {/if}
    </div>
    
    <!-- Message content -->
    <div 
      class="rounded-lg px-4 py-2 shadow-sm {
        message.role === USER_ROLE 
          ? 'bg-primary-500 text-white' 
          : message.role === SYSTEM_ROLE 
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200' 
            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
      }"
    >
      <!-- Render normal message -->
      <div 
        bind:this={contentElement}
        class="prose prose-sm dark:prose-invert max-w-none"
      >
        {@html parsedContent}
      </div>
      
      <!-- Copy button for code blocks -->
      {#if contentElement && contentElement.querySelectorAll('pre').length > 0}
        {#each [...contentElement.querySelectorAll('pre')] as codeBlock, i}
          <div class="relative -mt-8 mr-2">
            <button
              class="absolute top-2 right-2 p-1 rounded bg-gray-700 text-gray-200 text-xs hover:bg-gray-600 transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100"
              on:click={handleCopyClick}
              aria-label="Copy code"
            >
              {#if copySuccess}
                <span class="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </span>
              {:else}
                <span class="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                  Copy
                </span>
              {/if}
            </button>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>