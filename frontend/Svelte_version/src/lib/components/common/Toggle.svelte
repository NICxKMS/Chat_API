<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  // Props
  export let checked = false;
  export let disabled = false;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let id = '';
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Toggle sizes
  type SizeConfig = {
    toggle: string;
    dot: string;
    translate: string;
  };
  
  type SizesMap = {
    sm: SizeConfig;
    md: SizeConfig;
    lg: SizeConfig;
  };
  
  const sizes: SizesMap = {
    sm: {
      toggle: 'w-8 h-4',
      dot: 'w-3 h-3',
      translate: 'translate-x-4'
    },
    md: {
      toggle: 'w-11 h-6',
      dot: 'w-5 h-5',
      translate: 'translate-x-5'
    },
    lg: {
      toggle: 'w-14 h-7',
      dot: 'w-6 h-6',
      translate: 'translate-x-7'
    }
  };
  
  // Handle toggle change
  function handleChange() {
    if (!disabled) {
      checked = !checked;
      dispatch('change', { checked });
    }
  }
</script>

<button
  type="button"
  class={`relative inline-flex items-center ${sizes[size].toggle} rounded-full transition-colors
    ${checked ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  `}
  role="switch"
  aria-checked={checked}
  aria-disabled={disabled}
  disabled={disabled}
  on:click={handleChange}
  {id}
>
  <span class="sr-only">Toggle</span>
  <span
    aria-hidden="true"
    class={`inline-block ${sizes[size].dot} transform transition-transform
      bg-white rounded-full shadow-sm
      ${checked ? sizes[size].translate : 'translate-x-0'}
    `}
  ></span>
</button>
