<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  
  // Props
  export let position: 'top' | 'right' | 'bottom' | 'left' = 'bottom';
  export let delay = 300; // Delay before showing tooltip in ms
  export let offset = 8; // Distance from parent element
  export let maxWidth = 'max-w-xs';
  export let showOnMobile = false;
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // State
  let visible = false;
  let container: HTMLDivElement;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  // Position styles
  type PositionClassMap = {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  
  const positionClasses: PositionClassMap = {
    top: `-top-2 left-1/2 transform -translate-x-1/2 -translate-y-full mb-${offset}`,
    right: `top-1/2 -right-2 transform translate-x-full -translate-y-1/2 ml-${offset}`,
    bottom: `-bottom-2 left-1/2 transform -translate-x-1/2 translate-y-full mt-${offset}`,
    left: `top-1/2 -left-2 transform -translate-x-full -translate-y-1/2 mr-${offset}`
  };
  
  const arrowClasses: PositionClassMap = {
    top: 'bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45',
    right: 'left-0 top-1/2 transform -translate-y-1/2 -translate-x-1/2 rotate-45',
    bottom: 'top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-45',
    left: 'right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 rotate-45'
  };
  
  function showTooltip() {
    if (!showOnMobile && window.innerWidth < 640) return;
    
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      visible = true;
      dispatch('show');
    }, delay);
  }
  
  function hideTooltip() {
    if (timeoutId) clearTimeout(timeoutId);
    visible = false;
    dispatch('hide');
  }
  
  onDestroy(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
</script>

<div 
  class="relative inline-block"
  bind:this={container}
  on:mouseenter={showTooltip}
  on:mouseleave={hideTooltip}
  on:focusin={showTooltip}
  on:focusout={hideTooltip}
  role="presentation"
>
  <slot></slot>
  
  {#if visible}
    <div 
      class={`absolute z-50 pointer-events-none ${positionClasses[position]} ${maxWidth}`}
      role="tooltip"
    >
      <div class="bg-gray-900 dark:bg-gray-800 text-white text-sm rounded py-1 px-2 shadow-lg">
        <div 
          class={`absolute w-2 h-2 bg-gray-900 dark:bg-gray-800 ${arrowClasses[position]}`}
        ></div>
        <slot name="content">
          <!-- Default tooltip content goes here -->
        </slot>
      </div>
    </div>
  {/if}
</div>
