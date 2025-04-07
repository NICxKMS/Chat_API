<!-- src/lib/components/settings/SettingsModal.svelte -->
<script>
    import settingsStore from '$lib/stores/settingsStore.js';
    import modelStore from '$lib/stores/modelStore.js';
    import { fade } from 'svelte/transition';
    import { XMarkIcon } from 'heroicons-svelte/24/outline';
  
    export let showModal = false;
  
    // Get reactive values and actions
    const { settings, updateSetting, resetSettings, shouldRestrictTemperature } = settingsStore;
    const { selectedModel } = modelStore;
  
    // Reactive check if temperature should be restricted for the current model.
    // Remove the $ from shouldRestrictTemperature and safeguard against undefined selectedModel.
    $: isTempRestricted = $selectedModel ? shouldRestrictTemperature($selectedModel) : false;
  
    // Local state for intermediate slider values (optional, can bind directly)
    let tempValue = $settings.temperature;
    let topPValue = $settings.top_p;
    let maxTokensValue = $settings.max_tokens;
    let freqPenaltyValue = $settings.frequency_penalty;
    let presPenaltyValue = $settings.presence_penalty;
    let streamingValue = $settings.streaming;
  
    // Update store when local values change (debounced might be better for sliders)
    $: updateSetting('temperature', tempValue);
    $: updateSetting('top_p', topPValue);
    $: updateSetting('max_tokens', maxTokensValue);
    $: updateSetting('frequency_penalty', freqPenaltyValue);
    $: updateSetting('presence_penalty', presPenaltyValue);
    $: updateSetting('streaming', streamingValue);
  
    // Close modal function
    function closeModal() {
      showModal = false;
    }
  
    // Handle backdrop click to close
    function handleBackdropClick(event) {
      if (event.target === event.currentTarget) {
        closeModal();
      }
    }
  
    // Compute background class for the streaming toggle button
    $: streamingButtonBg = streamingValue ? 'bg-primary' : 'bg-foreground/20';
  </script>
  
  {#if showModal}
    <div 
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      on:click={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div class="bg-card-bg rounded-lg shadow-xl border border-border-primary w-full max-w-md p-6 relative">
        <button 
          on:click={closeModal}
          class="absolute top-3 right-3 text-foreground/50 hover:text-foreground p-1 rounded-full transition-colors"
          aria-label="Close settings"
        >
          <XMarkIcon class="w-6 h-6" />
        </button>
  
        <h2 id="settings-title" class="text-xl font-semibold mb-6">Chat Settings</h2>
  
        <div class="space-y-5">
          <!-- Temperature -->
          <div class="space-y-1">
            <label for="temperature" class="block text-sm font-medium text-foreground/80">
              Temperature <span class="text-foreground/50 text-xs">({tempValue.toFixed(2)})</span>
              {#if isTempRestricted}
                <span class="ml-2 text-warning-text text-xs">(Fixed for model)</span>
              {/if}
            </label>
            <input 
              type="range" id="temperature" min="0" max="2" step="0.01" 
              bind:value={tempValue}
              disabled={isTempRestricted}
              class="w-full h-2 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p class="text-xs text-foreground/50">Controls randomness: lower values make responses more deterministic.</p>
          </div>
  
          <!-- Top P -->
          <div class="space-y-1">
            <label for="top_p" class="block text-sm font-medium text-foreground/80">
              Top P <span class="text-foreground/50 text-xs">({topPValue.toFixed(2)})</span>
            </label>
            <input 
              type="range" id="top_p" min="0" max="1" step="0.01" 
              bind:value={topPValue}
              class="w-full h-2 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-primary"
            />
             <p class="text-xs text-foreground/50">Nucleus sampling: considers tokens with probability mass summing to P.</p>
          </div>
          
          <!-- Max Tokens -->
          <div class="space-y-1">
            <label for="max_tokens" class="block text-sm font-medium text-foreground/80">
               Max Tokens <span class="text-foreground/50 text-xs">({maxTokensValue})</span>
            </label>
            <input 
              type="range" id="max_tokens" min="100" max="8000" step="100" 
              bind:value={maxTokensValue}
              class="w-full h-2 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-primary"
            />
             <p class="text-xs text-foreground/50">Maximum length of the generated response.</p>
          </div>
          
          <!-- Frequency Penalty -->
          <div class="space-y-1">
             <label for="frequency_penalty" class="block text-sm font-medium text-foreground/80">
               Frequency Penalty <span class="text-foreground/50 text-xs">({freqPenaltyValue.toFixed(2)})</span>
             </label>
             <input 
               type="range" id="frequency_penalty" min="-2" max="2" step="0.01" 
               bind:value={freqPenaltyValue}
               class="w-full h-2 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-primary"
             />
              <p class="text-xs text-foreground/50">Penalizes new tokens based on their existing frequency.</p>
          </div>
          
          <!-- Presence Penalty -->
          <div class="space-y-1">
             <label for="presence_penalty" class="block text-sm font-medium text-foreground/80">
               Presence Penalty <span class="text-foreground/50 text-xs">({presPenaltyValue.toFixed(2)})</span>
             </label>
             <input 
               type="range" id="presence_penalty" min="-2" max="2" step="0.01" 
               bind:value={presPenaltyValue}
               class="w-full h-2 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-primary"
             />
              <p class="text-xs text-foreground/50">Penalizes new tokens based on whether they appear in the text so far.</p>
          </div>
  
          <!-- Streaming Toggle -->
          <div class="flex items-center justify-between pt-2">
            <label for="streaming" class="text-sm font-medium text-foreground/80">Enable Streaming</label>
            <button
              id="streaming"
              role="switch"
              aria-checked={streamingValue}
              on:click={() => streamingValue = !streamingValue}
              class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 {streamingButtonBg}"
            >
              <span
                aria-hidden="true"
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                class:translate-x-5={streamingValue}
                class:translate-x-0={!streamingValue}
              ></span>
            </button>
          </div>
        </div>
  
        <div class="mt-8 flex justify-end border-t border-border-secondary pt-4">
          <button 
            on:click={$resetSettings}
            class="px-4 py-2 text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
          >
            Reset to Defaults
          </button>
          <button 
            on:click={closeModal}
            class="ml-3 px-4 py-2 bg-primary text-primary-text rounded-md text-sm font-medium hover:bg-primary/80 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  {/if}
  