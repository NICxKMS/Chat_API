<!-- src/lib/components/models/ModelDropdown.svelte -->
<script>
    import  modelStore  from '$lib/stores/modelStore';
    import { CheckCircleIcon } from 'heroicons-svelte/24/solid'; // Icon for selected
  
    // Function to compute the button classes for a given model
    function getModelButtonClasses(model, selectedModel) {
      const baseClasses =
        "w-full flex items-center justify-between text-left px-2 py-1.5 rounded hover:bg-foreground/5 transition-colors duration-150 text-sm";
      if (selectedModel?.id === model.id) {
        return baseClasses + " bg-primary/10 text-primary-text font-medium";
      }
      return baseClasses;
    }
  </script>
  
  {#if $modelStore.processedModels}
    <div class="bg-card-bg rounded-lg shadow-xl border border-border-primary max-h-[70vh] overflow-y-auto p-1">
      <h2 class="text-lg font-semibold p-3 sticky top-0 bg-card-bg/90 backdrop-blur-sm border-b border-border-secondary z-10">Select a Model</h2>
      <div class="p-2">
        {#each Object.entries($modelStore.processedModels) as [category, providers] (category)}
          <h3 class="text-sm font-medium text-foreground/60 uppercase tracking-wider px-2 pt-3 pb-1">{category}</h3>
          {#each Object.entries(providers) as [provider, types] (provider)}
            <div class="pl-2">
              <h4 class="text-xs font-semibold text-foreground/80 py-1.5 px-1">{provider}</h4>
               {#each Object.entries(types) as [type, models] (type)}
                 <div class="pl-2 border-l border-border-secondary/50 ml-1">
                   <!-- Optional: Type heading if needed, might be verbose -->
                   <!-- <h5 class="text-xs font-normal text-foreground/50 py-1">{type}</h5> -->
                   {#each models as model (model.id)}
                     <button
                       on:click={() => $modelStore.selectModel(model)}
                       class={getModelButtonClasses(model, $modelStore.selectedModel)}
                     >
                       <span>
                         {model.name}
                         {#if model.is_experimental}
                           <span class="ml-1.5 px-1.5 py-0.5 rounded text-xs bg-warning/20 text-warning-text">EXP</span>
                         {/if}
                         {#if model.is_multimodal}
                           <span class="ml-1.5 px-1.5 py-0.5 rounded text-xs bg-info/20 text-info-text">IMG</span>
                         {/if}
                       </span>
                       {#if $modelStore.selectedModel?.id === model.id}
                         <CheckCircleIcon class="w-4 h-4 text-primary flex-shrink-0" />
                       {/if}
                     </button>
                   {/each}
                 </div>
               {/each}
            </div>
          {/each}
        {/each}
      </div>
    </div>
  {/if}
  