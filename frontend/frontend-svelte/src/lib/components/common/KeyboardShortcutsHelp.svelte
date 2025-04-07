<!-- src/lib/components/common/KeyboardShortcutsHelp.svelte -->
<script>
  import { fly, fade, scale } from 'svelte/transition';
  import  keyboardShortcutsStore  from '$lib/stores/keyboardShortcutsStore.js';
  import { XMarkIcon, CommandLineIcon } from 'heroicons-svelte/24/outline';

  // Extract shortcuts from the store
  const { shortcuts } = keyboardShortcutsStore;
</script>

{#if $keyboardShortcutsStore.isHelpVisible}
  <!-- Overlay -->
  <div 
    transition:fade={{ duration: 150 }}
    class="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
    on:click={keyboardShortcutsStore.closeHelp}
    on:keydown={(e) => e.key === 'Escape' && keyboardShortcutsStore.closeHelp()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="keyboard-shortcuts-title"
    tabindex="-1"
  >
    <!-- Modal -->
    <div 
      transition:fly={{ duration: 200, y: 20 }}
      class="bg-card-bg rounded-lg shadow-xl border border-border-primary w-full max-w-md p-6 relative"
      on:click|stopPropagation
      role="document"
    >
      <!-- Close Button -->
      <button 
        on:click={keyboardShortcutsStore.closeHelp}
        class="absolute top-3 right-3 text-foreground/50 hover:text-foreground p-1 rounded-full transition-colors"
        aria-label="Close keyboard shortcuts help"
      >
        <XMarkIcon class="w-5 h-5" />
      </button>

      <!-- Header -->
      <div class="flex items-center gap-2 mb-4">
        <CommandLineIcon class="w-6 h-6 text-primary" />
        <h2 id="keyboard-shortcuts-title" class="text-xl font-semibold">Keyboard Shortcuts</h2>
      </div>

      <!-- Shortcuts List -->
      <div class="space-y-4">
        <p class="text-sm text-foreground/70">
          Press <kbd class="px-2 py-1 bg-foreground/10 rounded text-xs font-mono">Alt</kbd> + the following keys:
        </p>
        
        <div class="grid grid-cols-1 gap-2">
          {#each Object.entries(shortcuts) as [key, { description }]}
            <div class="flex items-center justify-between py-1.5 border-b border-border-primary/50 last:border-b-0">
              <span class="text-sm">{description}</span>
              <kbd class="px-2 py-1 bg-foreground/10 rounded text-xs font-mono">
                {key === 'Escape' ? 'Esc' : key}
              </kbd>
            </div>
          {/each}
        </div>

        <p class="text-sm text-foreground/70 pt-2">
          Tip: Press <kbd class="px-2 py-1 bg-foreground/10 rounded text-xs font-mono">Alt</kbd> + <kbd class="px-2 py-1 bg-foreground/10 rounded text-xs font-mono">/</kbd> to toggle this help screen.
        </p>
      </div>
    </div>
  </div>
{/if} 