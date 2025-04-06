<script>
  import { createEventDispatcher } from 'svelte';
  
  export let value = '';
  export let placeholder = 'Search...';
  export let debounceMs = 300;
  
  const dispatch = createEventDispatcher();
  let inputElement;
  let timeout;
  
  // Handle input changes with debounce
  function handleInput(e) {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      dispatch('search', value);
    }, debounceMs);
  }
  
  // Clear search
  function clearSearch() {
    value = '';
    dispatch('search', '');
    inputElement?.focus();
  }
  
  // Handle Enter key press
  function handleKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(timeout);
      dispatch('search', value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      clearSearch();
    }
  }
</script>

<div class="relative w-full">
  <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
    <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
    </svg>
  </div>
  
  <input
    bind:this={inputElement}
    bind:value
    type="text"
    class="w-full p-2 pl-10 pr-8 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
    {placeholder}
    on:input={handleInput}
    on:keydown={handleKeydown}
  />
  
  {#if value}
    <button 
      type="button" 
      class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300" 
      on:click={clearSearch}
      aria-label="Clear search"
    >
      <svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 12 12M1 13 13 1"/>
      </svg>
    </button>
  {/if}
</div>