<script>
  import { theme, toggleTheme } from '$lib/stores/themeStore.js';
  import { SunIcon, MoonIcon } from 'heroicons-svelte/24/outline';

  // Define common icon props for size and stroke-width
  const iconProps = {
    size: "1.375em", // Roughly 22px
    strokeWidth: "2",
    class: "relative z-10 transition-transform duration-300 ease-in-out group-hover:rotate-[30deg]"
  };
</script>

<button
  on:click={toggleTheme}
  class="group relative w-11 h-11 rounded-full bg-background/5 dark:bg-background/10 border border-border-secondary/50
         flex items-center justify-center cursor-pointer
         text-foreground overflow-hidden shadow-md
         transition-all duration-300 ease-in-out
         hover:shadow-lg hover:-translate-y-0.5 hover:text-primary-text
         active:scale-95 active:shadow-sm
         focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  aria-label="Switch to {$theme === 'dark' ? 'light' : 'dark'} mode"
  title="Switch to {$theme === 'dark' ? 'light' : 'dark'} mode"
>
  <!-- Background Gradient on Hover -->
  <span
    class="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out rounded-full"
    aria-hidden="true"
  ></span>

  <!-- Icons -->
  {#if $theme === 'dark'}
    <SunIcon {...iconProps} />
  {:else}
    <MoonIcon {...iconProps} />
  {/if}
</button> 