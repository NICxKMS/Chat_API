<!-- src/lib/components/settings/SettingsPanel.svelte -->
<script>
  import { fly } from 'svelte/transition';
  import settingsStore from '$lib/stores/settingsStore.js';
  import IoMdClose from 'svelte-icons/io/IoMdClose.svelte';

  // Props for controlling visibility
  export let isOpen = false;
  export let onClose = () => {};

  // Helper to format setting keys into labels
  function formatLabel(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  // Descriptions for settings
  const descriptions = {
    temperature: "Controls randomness (0=deterministic, 2=very random).",
    max_tokens: "Maximum length of the response generated.",
    top_p: "Nucleus sampling threshold (1=consider all tokens).",
    frequency_penalty: "Penalty applied to repeated tokens (-2 to 2).",
    presence_penalty: "Penalty applied to new tokens (-2 to 2).",
    streaming: "Receive responses word-by-word as they're generated.",
  };

  // Define input properties based on the setting key
  function getInputProps(key, value) {
    let props = {
      type: 'number',
      min: undefined, max: undefined, step: undefined,
      class: "w-20 px-2 py-1 border border-border-primary rounded bg-input-bg text-foreground text-sm focus:ring-1 focus:ring-primary focus:border-primary" // Basic number input style
    };

    switch (key) {
      case 'temperature':
        props = { ...props, type: 'range', min: 0, max: 2, step: 0.01, class: "w-full h-2 bg-border-secondary rounded-lg appearance-none cursor-pointer accent-primary" };
        break;
      case 'max_tokens':
        props = { ...props, min: 1, max: 8192, step: 1 }; // Allow wider range
        break;
      case 'top_p':
        props = { ...props, type: 'range', min: 0, max: 1, step: 0.01, class: "w-full h-2 bg-border-secondary rounded-lg appearance-none cursor-pointer accent-primary" };
        break;
      case 'frequency_penalty':
      case 'presence_penalty':
        props = { ...props, type: 'range', min: -2, max: 2, step: 0.01, class: "w-full h-2 bg-border-secondary rounded-lg appearance-none cursor-pointer accent-primary" };
        break;
      default:
        return null; // Should not happen if iterating over store keys
    }
    return props;
  }

  // Handle input changes and update the store
  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    const newValue = type === 'checkbox' ? checked : value; // Handle checkbox type for switch
    settingsStore.updateSetting(name, newValue);
  };

  // Handle background click
  const handleBackgroundClick = (event) => {
     if (event.target === event.currentTarget) {
       onClose();
     }
   };

</script>

{#if isOpen}
  <!-- Overlay -->
  <div
    transition:fly={{ duration: 200, x: 300, opacity: 0 }}
    class="fixed inset-0 bg-black/30 dark:bg-black/50 z-40 flex justify-end"
    on:click={handleBackgroundClick}
    on:keydown={(e) => e.key === 'Escape' && onClose()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
    tabindex="-1"
  >
    <!-- Panel -->
    <div
      class="w-full max-w-md h-full bg-settings-bg text-foreground shadow-xl flex flex-col"
      on:click|stopPropagation
      role="document"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-border-primary sticky top-0 bg-inherit z-10">
        <h2 id="settings-title" class="text-lg font-semibold">Settings</h2>
        <button
          on:click={onClose}
          class="p-1 rounded-full text-foreground/70 hover:bg-foreground/10 hover:text-foreground transition-colors"
          aria-label="Close settings"
        >
           <IoMdClose size="24" />
        </button>
      </div>

      <!-- Content - Scrollable -->
      <div class="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <p class="text-sm text-foreground-secondary">
          Adjust global model parameters for chat responses.
        </p>

        <!-- Streaming Toggle -->
         <div class="flex items-center justify-between border border-border-primary rounded-md p-3 bg-background/30">
            <div>
                 <label for="streaming" class="font-medium text-sm cursor-pointer">
                   Enable Streaming
                 </label>
                 {#if descriptions.streaming}
                   <p class="text-xs text-foreground-secondary mt-1">{descriptions.streaming}</p>
                 {/if}
            </div>
             <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="streaming"
                  name="streaming"
                  bind:checked={$settingsStore.settings.streaming}
                  on:change={handleChange}
                  class="sr-only peer"
                />
                <div class="w-11 h-6 bg-border-secondary rounded-full peer peer-focus:ring-2 peer-focus:ring-primary/50 dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
             </label>
         </div>

        <!-- Other Settings -->
        {#each Object.entries($settingsStore.settings) as [key, value]}
          {@const inputProps = getInputProps(key, value)}
          {#if key !== 'streaming' && inputProps}
             <div class="space-y-2 border border-border-primary rounded-md p-3 bg-background/30">
                <div class="flex items-center justify-between">
                  <label for={key} class="font-medium text-sm">{formatLabel(key)}</label>
                  {#if inputProps.type !== 'checkbox'}
                     <span class="text-sm font-mono px-2 py-0.5 bg-code-bg rounded">
                       {typeof value === 'number' ? value.toFixed(inputProps.step < 0.1 ? 2 : (inputProps.step < 1 ? 1: 0)) : value}
                     </span>
                  {/if}
                </div>
                <input
                  {...inputProps}
                  id={key}
                  name={key}
                  bind:value={$settingsStore.settings[key]}
                  on:input={handleChange}
                  on:change={handleChange}
                />
                {#if descriptions[key]}
                  <p class="text-xs text-foreground-secondary pt-1">{descriptions[key]}</p>
                {/if}
              </div>
          {/if}
        {/each}
      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-border-primary sticky bottom-0 bg-inherit">
        <button
           on:click={settingsStore.resetSettings}
           class="w-full px-4 py-2 border border-border-primary rounded-md text-sm font-medium text-foreground-secondary hover:bg-foreground/5 hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
         >
          Reset Defaults
        </button>
      </div>
    </div>
  </div>
{/if} 