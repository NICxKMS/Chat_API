<script>
  import { modelsStore, selectedModel } from '$lib/stores/models';
  
  // Properties
  export let compact = false;
  
  // Group models by provider
  $: groupedModels = $modelsStore.availableModels.reduce((groups, model) => {
    const provider = model.provider || 'unknown';
    if (!groups[provider]) {
      groups[provider] = [];
    }
    groups[provider].push(model);
    return groups;
  }, {});
  
  // Get provider names
  $: providers = Object.keys(groupedModels);
  
  // Handle model selection
  function selectModel(modelId) {
    modelsStore.selectModel(modelId);
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
  <h3 class="text-lg font-medium mb-3">Select Model</h3>
  
  {#if $modelsStore.isLoading}
    <div class="flex justify-center p-4">
      <div class="animate-spin h-5 w-5 border-2 border-primary-500 rounded-full border-t-transparent"></div>
    </div>
  {:else if $modelsStore.error}
    <div class="text-red-500 text-sm p-2">
      {$modelsStore.error}
    </div>
  {:else}
    {#if compact}
      <!-- Compact dropdown for mobile/header view -->
      <div class="relative">
        <select 
          on:change={(e) => selectModel(e.target.value)}
          value={$modelsStore.selectedModelId}
          class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          {#each $modelsStore.availableModels as model (model.id)}
            <option value={model.id}>
              {model.name}
            </option>
          {/each}
        </select>
      </div>
    {:else}
      <!-- Full card view for settings -->
      <div class="space-y-4">
        {#each providers as provider}
          <div>
            <h4 class="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
              {provider}
            </h4>
            
            <div class="grid grid-cols-1 gap-2">
              {#each groupedModels[provider] as model (model.id)}
                <button
                  class="text-left p-3 border rounded-lg transition-colors
                         {$modelsStore.selectedModelId === model.id 
                           ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' 
                           : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}"
                  on:click={() => selectModel(model.id)}
                >
                  <div class="font-medium">{model.name}</div>
                  {#if !compact}
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {model.description || 'No description available'}
                    </div>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>