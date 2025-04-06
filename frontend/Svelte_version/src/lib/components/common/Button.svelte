<script>
  import { createEventDispatcher } from 'svelte';
  
  // Props
  export let type = 'button';
  export let variant = 'primary'; // primary, secondary, outline, ghost, danger
  export let size = 'md'; // sm, md, lg
  export let disabled = false;
  export let loading = false;
  export let fullWidth = false;
  export let icon = null; // optional icon component
  export let iconPosition = 'left'; // left, right
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Handle click event
  function handleClick(event) {
    if (!disabled && !loading) {
      dispatch('click', event);
    }
  }
  
  // Compute button classes based on props
  $: variantClasses = {
    primary: 'bg-primary-600 hover:bg-primary-700 text-white border-transparent focus:ring-primary-500',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800 border-transparent focus:ring-gray-500 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100',
    outline: 'bg-transparent hover:bg-gray-100 text-gray-800 border-gray-300 focus:ring-gray-500 dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-800',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-800 border-transparent focus:ring-gray-500 dark:text-gray-100 dark:hover:bg-gray-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white border-transparent focus:ring-red-500'
  }[variant] || variantClasses.primary;
  
  $: sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-6 py-3'
  }[size] || sizeClasses.md;
  
  $: widthClass = fullWidth ? 'w-full' : '';
  
  $: stateClasses = disabled 
    ? 'opacity-50 cursor-not-allowed'
    : loading 
      ? 'opacity-80 cursor-wait' 
      : 'cursor-pointer';
</script>

<button
  {type}
  disabled={disabled || loading}
  class="relative inline-flex items-center justify-center rounded-md border font-medium
         transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
         {variantClasses} {sizeClasses} {widthClass} {stateClasses}"
  on:click={handleClick}
>
  {#if loading}
    <span class="absolute inset-0 flex items-center justify-center">
      <span class="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin"
            class:border-white={variant === 'primary' || variant === 'danger'}
            class:border-gray-800={variant !== 'primary' && variant !== 'danger'}>
      </span>
    </span>
    <span class="invisible">{$$slots.default ? '' : 'Button'}</span>
  {:else}
    {#if icon && iconPosition === 'left'}
      <span class="mr-2">
        <svelte:component this={icon} />
      </span>
    {/if}
    
    <slot>Button</slot>
    
    {#if icon && iconPosition === 'right'}
      <span class="ml-2">
        <svelte:component this={icon} />
      </span>
    {/if}
  {/if}
</button>