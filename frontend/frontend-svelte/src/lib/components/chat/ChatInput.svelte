<!-- src/lib/components/chat/ChatInput.svelte -->
<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import autosizeTextarea from '$lib/utils/autosizeTextarea.js';
  import { fade } from 'svelte/transition';
  import { 
    PaperAirplaneIcon 
  } from 'heroicons-svelte/24/solid';
  import { 
    EyeIcon, 
    EyeSlashIcon 
  } from 'heroicons-svelte/24/outline';
  import { browser } from '$app/environment';
  import VoiceInput from '$lib/components/common/VoiceInput.svelte';
  import FileUploader from '$lib/components/common/FileUploader.svelte';
  import MarkdownPreview from './MarkdownPreview.svelte';
  import { chatInputVisible } from '$lib/stores/ui';

  export let placeholder = 'Type your message...';
  export let disabled = false;
  export let autoFocus = true;
  
  let message = '';
  let textareaEl;
  let isComposing = false; // For IME composition (e.g., Japanese, Chinese input)
  let isPreviewVisible = false;
  let attachedFiles = [];

  const dispatch = createEventDispatcher();

  function handleSubmit() {
    if ((message.trim() || attachedFiles.length > 0) && !disabled) {
      dispatch('sendMessage', {
        text: message.trim(),
        files: attachedFiles.map(f => f.file)
      });
      message = ''; // Clear input after sending
      attachedFiles = []; // Clear attached files
      
      // Focus the textarea after sending
      if (textareaEl) {
        setTimeout(() => textareaEl.focus(), 0);
      }
    }
  }

  function handleKeydown(event) {
    // Skip if in IME composition
    if (isComposing) return;
    
    // Send message with Enter (but not with Shift+Enter which adds a new line)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent newline on Enter
      handleSubmit();
    }
    
    // Also handle Ctrl+Enter or Command+Enter (macOS) to send
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSubmit();
    }
    
    // Toggle preview with Alt+P
    if (event.key === 'p' && event.altKey) {
      event.preventDefault();
      togglePreview();
    }
  }
  
  // Handle IME composition (for CJK languages)
  function handleCompositionStart() {
    isComposing = true;
  }
  
  function handleCompositionEnd() {
    isComposing = false;
  }
  
  // Handle voice input result
  function handleVoiceInput(event) {
    const transcript = event.detail;
    if (transcript) {
      // Append to the current message
      message += (message ? ' ' : '') + transcript;
      
      // Focus the textarea
      if (textareaEl) {
        textareaEl.focus();
      }
    }
  }
  
  // Handle file uploads
  function handleFileChange(event) {
    attachedFiles = event.detail.files;
  }
  
  // Toggle preview mode
  function togglePreview() {
    isPreviewVisible = !isPreviewVisible;
  }
  
  // Auto-resize textarea as user types
  function autoResizeTextarea() {
    if (!textareaEl) return;
    
    // Reset height to get correct scrollHeight
    textareaEl.style.height = 'auto';
    
    // Set new height based on scrollHeight (with a max height)
    const newHeight = Math.min(textareaEl.scrollHeight, 200);
    textareaEl.style.height = `${newHeight}px`;
  }
  
  // Insert markdown formatting
  function insertMarkdown(format) {
    if (!textareaEl) return;
    
    const start = textareaEl.selectionStart;
    const end = textareaEl.selectionEnd;
    const selectedText = message.substring(start, end);
    
    let formattedText = '';
    let cursorOffset = 0;
    
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText || 'bold text'}**`;
        cursorOffset = selectedText ? 0 : -2;
        break;
      case 'italic':
        formattedText = `*${selectedText || 'italic text'}*`;
        cursorOffset = selectedText ? 0 : -1;
        break;
      case 'code':
        formattedText = `\`${selectedText || 'code'}\``;
        cursorOffset = selectedText ? 0 : -1;
        break;
      case 'codeblock':
        formattedText = `\`\`\`\n${selectedText || 'code block'}\n\`\`\``;
        cursorOffset = selectedText ? 0 : -4;
        break;
      case 'link':
        formattedText = `[${selectedText || 'link text'}](url)`;
        cursorOffset = selectedText ? -1 : -6;
        break;
      case 'list':
        formattedText = `\n- ${selectedText || 'list item'}`;
        cursorOffset = selectedText ? 0 : -10;
        break;
    }
    
    // Insert the formatted text
    message = message.substring(0, start) + formattedText + message.substring(end);
    
    // Set cursor position after formatting
    setTimeout(() => {
      textareaEl.focus();
      const newCursorPos = start + formattedText.length + cursorOffset;
      textareaEl.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }
  
  // Watch for changes to resize the textarea
  $: if (browser && textareaEl && message) {
    autoResizeTextarea();
  }
  
  // Set focus on mount if autoFocus is true
  onMount(() => {
    if (autoFocus && textareaEl) {
      textareaEl.focus();
    }
  });

  function toggleChatInput() {
    chatInputVisible.update(value => !value);
  }
</script>

<div class="chat-input-container" class:hidden={!$chatInputVisible}>
  <div class="flex items-end gap-2 p-4">
    <textarea
      bind:value={message}
      bind:this={textareaEl}
      on:keydown={handleKeydown}
      on:input={autoResizeTextarea}
      on:compositionstart={handleCompositionStart}
      on:compositionend={handleCompositionEnd}
      {placeholder}
      {disabled}
      class="flex-1 min-h-[2.5rem] max-h-32 p-2 rounded-lg bg-input-bg border border-border-primary focus:border-primary focus:outline-none resize-none"
      rows="1"
    ></textarea>
    <div class="flex gap-2">
      <button
        class="side-button"
        on:click={toggleChatInput}
        aria-label="Hide chat input"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <button
        on:click={handleSubmit}
        disabled={!message.trim() || disabled}
        class="side-button"
        aria-label="Send message"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        </svg>
      </button>
    </div>
  </div>
</div>

<form on:submit|preventDefault={handleSubmit} class="p-4 border-t border-border-primary bg-background">
  <!-- Markdown Preview -->
  <MarkdownPreview content={message} isVisible={isPreviewVisible} />
  
  <!-- Markdown Formatting Toolbar -->
  <div class="flex items-center justify-between mb-2 text-xs text-foreground/70">
    <div class="flex gap-1.5">
      <button 
        type="button"
        on:click={() => insertMarkdown('bold')}
        class="px-1.5 py-1 rounded hover:bg-foreground/10 transition-colors"
        title="Bold (** **)"
      >
        <strong>B</strong>
      </button>
      <button 
        type="button"
        on:click={() => insertMarkdown('italic')}
        class="px-1.5 py-1 rounded hover:bg-foreground/10 transition-colors italic"
        title="Italic (* *)"
      >
        <em>I</em>
      </button>
      <button 
        type="button"
        on:click={() => insertMarkdown('code')}
        class="px-1.5 py-1 rounded hover:bg-foreground/10 transition-colors font-mono"
        title="Inline Code (` `)"
      >
        `C`
      </button>
      <button 
        type="button"
        on:click={() => insertMarkdown('codeblock')}
        class="px-1.5 py-1 rounded hover:bg-foreground/10 transition-colors font-mono"
        title="Code Block (```)"
      >
        ```
      </button>
      <button 
        type="button"
        on:click={() => insertMarkdown('link')}
        class="px-1.5 py-1 rounded hover:bg-foreground/10 transition-colors underline"
        title="Link [text](url)"
      >
        Link
      </button>
      <button 
        type="button"
        on:click={() => insertMarkdown('list')}
        class="px-1.5 py-1 rounded hover:bg-foreground/10 transition-colors"
        title="List Item (- )"
      >
        • List
      </button>
    </div>
    
    <button
      type="button"
      on:click={togglePreview}
      class="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-foreground/10 transition-colors"
      title="Toggle Markdown Preview (Alt+P)"
    >
      {#if isPreviewVisible}
        <EyeSlashIcon class="w-4 h-4" />
        <span>Hide Preview</span>
      {:else}
        <EyeIcon class="w-4 h-4" />
        <span>Preview</span>
      {/if}
    </button>
  </div>
  
  <div class="flex items-center gap-2">
    <!-- File Uploader -->
    <FileUploader 
      {disabled} 
      maxSizeMB={10} 
      acceptedTypes="image/*,.pdf,.txt,.md,.js,.ts,.html,.css,.json,.csv" 
      on:change={handleFileChange} 
    />
    
    <!-- Voice Input -->
    <VoiceInput {disabled} on:result={handleVoiceInput} />
  </div>
  
  <div class="flex justify-between mt-2 text-xs text-foreground/50">
    <div>
      <kbd class="px-1 py-0.5 bg-foreground/5 rounded">Enter</kbd> to send, 
      <kbd class="px-1 py-0.5 bg-foreground/5 rounded">Shift+Enter</kbd> for new line
    </div>
    <div>
      <kbd class="px-1 py-0.5 bg-foreground/5 rounded">Alt+P</kbd> toggle preview,
      <kbd class="px-1 py-0.5 bg-foreground/5 rounded">Alt+/</kbd> for shortcuts
    </div>
  </div>
</form> 