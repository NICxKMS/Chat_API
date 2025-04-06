<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import Button from './Button.svelte';
  
  // Props
  export let open = false;
  export let title = '';
  export let size = 'md'; // sm, md, lg, xl
  export let closeOnEscape = true;
  export let closeOnOutsideClick = true;
  export let showCloseButton = true;
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Handle closing
  function close() {
    dispatch('close');
  }
  
  // Handle keydown events for Escape key
  function handleKeydown(event) {
    if (closeOnEscape && event.key === 'Escape' && open) {
      close();
    }
  }
  
  // Handle outside clicks
  function handleOutsideClick(event) {
    if (closeOnOutsideClick && event.target === event.currentTarget && open) {
      close();
    }
  }
  
  // Add/remove keyboard event listeners
  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });
  
  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
  
  // Compute size classes
  $: sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    'full': 'max-w-full'
  }[size] || 'max-w-md';
  
  // Prevent body scrolling when modal is open
  $: if (typeof document !== 'undefined') {
    if (open) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  }
</script>

{#if open}
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" 
    on:click={handleOutsideClick}
    transition:fade={{ duration: 200 }}
  >
    <div 
      class="w-full {sizeClasses} bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden"
      transition:scale={{ duration: 200, start: 0.95 }}
    >
      <!-- Header -->
      {#if title || showCloseButton}
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          {#if title}
            <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
              {title}
            </h3>
          {:else}
            <div></div>
          {/if}
          
          {#if showCloseButton}
            <button 
              on:click={close}
              class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
              aria-label="Close"
            >
              <span class="text-xl">×</span>
            </button>
          {/if}
        </div>
      {/if}
      
      <!-- Content -->
      <div class="px-6 py-4">
        <slot></slot>
      </div>
      
      <!-- Footer with actions -->
      {#if $$slots.footer}
        <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <slot name="footer"></slot>
        </div>
      {/if}
    </div>
  </div>
{/if}