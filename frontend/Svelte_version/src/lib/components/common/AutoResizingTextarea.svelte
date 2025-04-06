<script>
  import { createEventDispatcher } from 'svelte';
  
  // Props
  export let value = '';
  export let placeholder = 'Type a message...';
  export let minRows = 1;
  export let maxRows = 10;
  export let disabled = false;
  export let autoFocus = false;
  export let clearOnSubmit = true;
  
  // Reactive state
  let textareaElement;
  let rows = minRows;
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Lifecycle
  import { onMount } from 'svelte';
  
  onMount(() => {
    if (autoFocus && textareaElement) {
      textareaElement.focus();
    }
    adjustHeight();
  });
  
  // Reactive statements
  $: if (textareaElement) {
    adjustHeight();
  }
  
  // Methods
  function adjustHeight() {
    if (!textareaElement) return;
    
    // Reset height to calculate proper scrollHeight
    textareaElement.style.height = 'auto';
    
    // Get the scrollHeight of the textarea content
    const scrollHeight = textareaElement.scrollHeight;
    
    // Calculate how many rows would fit
    const lineHeight = parseInt(getComputedStyle(textareaElement).lineHeight);
    const paddingTop = parseInt(getComputedStyle(textareaElement).paddingTop);
    const paddingBottom = parseInt(getComputedStyle(textareaElement).paddingBottom);
    const calculatedRows = Math.floor((scrollHeight - paddingTop - paddingBottom) / lineHeight);
    
    // Clamp rows between min and max
    rows = Math.max(minRows, Math.min(maxRows, calculatedRows));
    
    // Set the height of the textarea
    textareaElement.style.height = `${scrollHeight}px`;
  }
  
  function handleInput(event) {
    value = event.target.value;
    adjustHeight();
    dispatch('input', value);
  }
  
  function handleKeyDown(event) {
    // Submit on Enter without Shift key
    if (event.key === 'Enter' && !event.shiftKey && !disabled) {
      event.preventDefault();
      dispatch('submit', value);
      
      if (clearOnSubmit) {
        value = '';
        // Reset height on clear
        setTimeout(adjustHeight, 0);
      }
    }
    
    dispatch('keydown', event);
  }
  
  function handleFocus(event) {
    dispatch('focus', event);
  }
  
  function handleBlur(event) {
    dispatch('blur', event);
  }
  
  // Focus method that can be called from parent
  export function focus() {
    if (textareaElement) {
      textareaElement.focus();
    }
  }
  
  // Clear method that can be called from parent
  export function clear() {
    value = '';
    setTimeout(adjustHeight, 0);
  }
</script>

<div class="relative w-full">
  <textarea
    bind:this={textareaElement}
    {placeholder}
    {disabled}
    {rows}
    bind:value
    on:input={handleInput}
    on:keydown={handleKeyDown}
    on:focus={handleFocus}
    on:blur={handleBlur}
    class="w-full resize-none overflow-hidden border rounded-lg bg-white dark:bg-gray-800 
           border-gray-300 dark:border-gray-700 px-4 py-2 text-gray-900 dark:text-gray-100
           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
           disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:cursor-not-allowed"
  ></textarea>
</div>