<script>
  import { settings } from '$lib/stores/settings';
  import { theme, THEMES, resolvedTheme } from '$lib/stores/theme';
  import { apiStore } from '$lib/stores/api';
  import { modelsStore, selectedModel } from '$lib/stores/models';
  import Button from '$lib/components/common/Button.svelte';
  import AuthGuard from '$lib/components/auth/AuthGuard.svelte';
  import { goto } from '$app/navigation';
  
  // Handle settings changes
  function updateSetting(key, value) {
    settings.updateSetting(key, value);
  }
  
  // Handle API settings changes
  function updateApiSetting(key, value) {
    apiStore.updateSetting(key, value);
  }
  
  // Handle theme change
  function setTheme(newTheme) {
    theme.setTheme(newTheme);
  }
  
  // Handle model selection
  function selectModel(modelId) {
    modelsStore.selectModel(modelId);
  }
  
  // Reset settings to defaults
  function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      settings.resetSettings();
      apiStore.resetSettings();
      theme.setTheme(THEMES.SYSTEM);
    }
  }
  
  // Go back to chat
  function goBack() {
    goto('/');
  }
</script>

<AuthGuard>
  <div class="max-w-4xl mx-auto p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Settings</h1>
      
      <Button variant="outline" on:click={goBack}>
        Back to Chat
      </Button>
    </div>
    
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">Appearance</h2>
      
      <div class="mb-4">
        <label class="block text-sm font-medium mb-2">Theme</label>
        <div class="flex space-x-2">
          <button
            class="px-4 py-2 rounded-md border {$theme === THEMES.LIGHT ? 'bg-primary-100 border-primary-500 dark:bg-primary-900' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}"
            on:click={() => setTheme(THEMES.LIGHT)}
          >
            Light
          </button>
          <button
            class="px-4 py-2 rounded-md border {$theme === THEMES.DARK ? 'bg-primary-100 border-primary-500 dark:bg-primary-900' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}"
            on:click={() => setTheme(THEMES.DARK)}
          >
            Dark
          </button>
          <button
            class="px-4 py-2 rounded-md border {$theme === THEMES.SYSTEM ? 'bg-primary-100 border-primary-500 dark:bg-primary-900' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}"
            on:click={() => setTheme(THEMES.SYSTEM)}
          >
            System
          </button>
        </div>
      </div>
      
      <div class="mb-4">
        <label class="block text-sm font-medium mb-2">Font Size</label>
        <div class="flex space-x-2">
          <button
            class="px-4 py-2 rounded-md border {$settings.fontSize === 'small' ? 'bg-primary-100 border-primary-500 dark:bg-primary-900' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}"
            on:click={() => updateSetting('fontSize', 'small')}
          >
            Small
          </button>
          <button
            class="px-4 py-2 rounded-md border {$settings.fontSize === 'medium' ? 'bg-primary-100 border-primary-500 dark:bg-primary-900' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}"
            on:click={() => updateSetting('fontSize', 'medium')}
          >
            Medium
          </button>
          <button
            class="px-4 py-2 rounded-md border {$settings.fontSize === 'large' ? 'bg-primary-100 border-primary-500 dark:bg-primary-900' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}"
            on:click={() => updateSetting('fontSize', 'large')}
          >
            Large
          </button>
        </div>
      </div>
      
      <div class="mb-4">
        <label class="flex items-center">
          <input 
            type="checkbox" 
            checked={$settings.showTimestamps} 
            on:change={(e) => updateSetting('showTimestamps', e.target.checked)}
            class="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
          />
          <span class="ml-2">Show message timestamps</span>
        </label>
      </div>
    </div>
    
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">Chat Settings</h2>
      
      <div class="mb-4">
        <label class="flex items-center">
          <input 
            type="checkbox" 
            checked={$settings.streamingEnabled} 
            on:change={(e) => updateSetting('streamingEnabled', e.target.checked)}
            class="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
          />
          <span class="ml-2">Enable streaming responses</span>
        </label>
      </div>
      
      <div class="mb-4">
        <label class="flex items-center">
          <input 
            type="checkbox" 
            checked={$settings.metricsEnabled} 
            on:change={(e) => updateSetting('metricsEnabled', e.target.checked)}
            class="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
          />
          <span class="ml-2">Enable performance metrics</span>
        </label>
      </div>
      
      <div class="mb-4">
        <label class="block text-sm font-medium mb-2">Response Format</label>
        <div class="flex space-x-2">
          <button
            class="px-4 py-2 rounded-md border {$settings.apiResponseFormat === 'markdown' ? 'bg-primary-100 border-primary-500 dark:bg-primary-900' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}"
            on:click={() => updateSetting('apiResponseFormat', 'markdown')}
          >
            Markdown
          </button>
          <button
            class="px-4 py-2 rounded-md border {$settings.apiResponseFormat === 'text' ? 'bg-primary-100 border-primary-500 dark:bg-primary-900' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}"
            on:click={() => updateSetting('apiResponseFormat', 'text')}
          >
            Plain Text
          </button>
          <button
            class="px-4 py-2 rounded-md border {$settings.apiResponseFormat === 'code' ? 'bg-primary-100 border-primary-500 dark:bg-primary-900' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}"
            on:click={() => updateSetting('apiResponseFormat', 'code')}
          >
            Code
          </button>
        </div>
      </div>
    </div>
    
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">Model Settings</h2>
      
      <div class="mb-4">
        <label class="block text-sm font-medium mb-2">Selected Model</label>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          {#each $modelsStore.availableModels as model (model.id)}
            <button
              class="px-4 py-2 rounded-md border text-left {$modelsStore.selectedModelId === model.id ? 'bg-primary-100 border-primary-500 dark:bg-primary-900' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}"
              on:click={() => selectModel(model.id)}
            >
              <div class="font-medium">{model.name}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">{model.description}</div>
            </button>
          {/each}
        </div>
      </div>
      
      <div class="mb-4">
        <label class="block text-sm font-medium mb-2" for="temperature">
          Temperature: {$apiStore.temperature.toFixed(1)}
        </label>
        <input 
          type="range" 
          id="temperature" 
          min="0" 
          max="1" 
          step="0.1" 
          value={$apiStore.temperature}
          on:input={(e) => updateApiSetting('temperature', parseFloat(e.target.value))}
          class="w-full"
        />
        <div class="flex justify-between text-xs text-gray-500">
          <span>Precise (0.0)</span>
          <span>Balanced (0.5)</span>
          <span>Creative (1.0)</span>
        </div>
      </div>
      
      <div class="mb-4">
        <label class="block text-sm font-medium mb-2" for="systemPrompt">System Prompt</label>
        <textarea 
          id="systemPrompt" 
          value={$apiStore.systemPrompt}
          on:input={(e) => updateApiSetting('systemPrompt', e.target.value)}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          rows="3"
        ></textarea>
      </div>
    </div>
    
    <div class="flex justify-between mt-6">
      <Button variant="outline" on:click={goBack}>
        Back to Chat
      </Button>
      
      <Button variant="danger" on:click={resetSettings}>
        Reset All Settings
      </Button>
    </div>
  </div>
</AuthGuard>