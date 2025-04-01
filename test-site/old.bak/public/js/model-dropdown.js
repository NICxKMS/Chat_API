/**
 * ModelDropdown - A class that manages a hierarchical model dropdown UI
 */
class ModelDropdown {
  constructor(options) {
    this.container = options.container;
    this.includeExperimentalToggle = options.includeExperimentalToggle || document.getElementById('show-experimental');
    this.onChange = options.onChange || function() {};
    
    this.API_BASE_URL = new URLSearchParams(window.location.search).get('api_url') || '/api';
    this.API_MODELS_URL = `${this.API_BASE_URL}/models/classified`;
    
    this.processedModels = { Chat: [], Image: [], Embedding: [] };
    this.allModels = [];
    this.experimentalModels = [];
    this.selectedModel = null;
    
    // Optional configuration
    this.includeEmbeddings = options.includeEmbeddings || false;
    this.showExperimentalByDefault = options.showExperimentalByDefault || false;
    this.cacheExpiryTime = options.cacheExpiryTime || 5 * 60 * 1000; // 5 minutes in milliseconds
    
    // DOM elements created during render
    this.dropdownElement = null;
    this.searchInput = null;
    this.modelListElement = null;
    
    // Filter elements
    this.textFilterCheckbox = document.getElementById('filter-text');
    this.imageFilterCheckbox = document.getElementById('filter-image');
    this.embeddingFilterCheckbox = document.getElementById('filter-embedding');
    this.nameFilterInput = document.getElementById('model-name-filter');
    
    // If includeExperimentalToggle is a DOM element, initialize it
    if (this.includeExperimentalToggle && this.includeExperimentalToggle instanceof HTMLElement) {
      this.includeExperimentalToggle.checked = this.showExperimentalByDefault;
    }
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.render = this.render.bind(this);
    this.createDropdownUI = this.createDropdownUI.bind(this);
    this.handleModelSelect = this.handleModelSelect.bind(this);
    this.toggleExperimentalModels = this.toggleExperimentalModels.bind(this);
    this.getSelectedModel = this.getSelectedModel.bind(this);
    this.applyFilters = this.applyFilters.bind(this);
    this.fetchModels = this.fetchModels.bind(this);
    this.processModels = this.processModels.bind(this);
    this.renderFilteredModels = this.renderFilteredModels.bind(this);
    this.matchesNameFilter = this.matchesNameFilter.bind(this);
    this.sortModelsByProvider = this.sortModelsByProvider.bind(this);
    this.sortModelTypes = this.sortModelTypes.bind(this);
    this.normalizeModelName = this.normalizeModelName.bind(this);
    
    // Create debounced versions of expensive functions
    this.debouncedApplyFilters = this.debounce(this.applyFilters, 300);
  }
  
  /**
   * Utility function to debounce frequent events
   * @param {Function} func - The function to debounce
   * @param {number} wait - The debounce delay in milliseconds
   * @returns {Function} - Debounced function
   */
  debounce(func, wait) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }
  
  /**
   * Initialize the dropdown by fetching models and rendering UI
   */
  async initialize() {
    try {
      const cachedModels = this.getCachedModels();
      
      if (cachedModels) {
        console.log('Using cached processed models');
        this.processedModels = cachedModels.processed;
        this.allModels = cachedModels.all;
        this.experimentalModels = cachedModels.experimental;
        this.render();
        if (this.allModels.length > 0 && !this.selectedModel) {
          this.handleModelSelect(this.allModels[0]);
        }
      } else {
        console.log('No valid cache, fetching fresh models...');
        const success = await this.fetchModels();
        
        if (success) {
          console.log('Models fetched and processed successfully.');
          this.cacheModels();
          this.render();
          if (this.allModels.length > 0 && !this.selectedModel) {
            this.handleModelSelect(this.allModels[0]);
          }
        } else {
          console.error('Failed to fetch models from API');
          this.container.innerHTML = `
            <div class="error-message">
              Failed to load models from API. Please try refreshing the page or contact support.
            </div>
          `;
        }
      }
      
      // Set up filter event listeners using debounced version for text input
      this.setupEventListeners();
      
      // Setup experimental toggle if enabled
      this.setupExperimentalToggle();
      
      return true;
    } catch (error) {
      console.error('Error initializing model dropdown:', error);
      this.container.innerHTML = `
        <div class="error-message">
          Failed to load models: ${error.message}
        </div>
      `;
      return false;
    }
  }
  
  /**
   * Set up all event listeners for filters and toggles
   */
  setupEventListeners() {
    if (this.textFilterCheckbox) {
      this.textFilterCheckbox.addEventListener('change', this.applyFilters);
    }
    
    if (this.imageFilterCheckbox) {
      this.imageFilterCheckbox.addEventListener('change', this.applyFilters);
    }
    
    if (this.embeddingFilterCheckbox) {
      this.embeddingFilterCheckbox.addEventListener('change', this.applyFilters);
    }
    
    if (this.nameFilterInput) {
      // Use debounced version for text input to avoid excessive filtering
      this.nameFilterInput.addEventListener('input', this.debouncedApplyFilters);
    }
  }
  
  /**
   * Set up the experimental toggle checkbox if needed
   */
  setupExperimentalToggle() {
    // Check if toggle is already a DOM element, add event listener if it is
    if (this.includeExperimentalToggle && this.includeExperimentalToggle instanceof HTMLElement) {
      this.includeExperimentalToggle.addEventListener('change', this.toggleExperimentalModels);
      return;
    }
    
    // Skip if there are no experimental models or if toggle is explicitly disabled
    if (this.includeExperimentalToggle !== true || 
        !this.experimentalModels || 
        this.experimentalModels.length === 0) {
      return;
    }
    
    // Create a container for the toggle only once
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'experimental-toggle-container';
    
    this.includeExperimentalToggle = document.createElement('input');
    this.includeExperimentalToggle.type = 'checkbox';
    this.includeExperimentalToggle.id = 'show-experimental-toggle';
    this.includeExperimentalToggle.checked = this.showExperimentalByDefault;
    
    const toggleLabel = document.createElement('label');
    toggleLabel.htmlFor = 'show-experimental-toggle';
    toggleLabel.textContent = 'Show Experimental Models';
    
    // Build the DOM structure
    toggleContainer.appendChild(this.includeExperimentalToggle);
    toggleContainer.appendChild(toggleLabel);
    
    // Find where to insert the toggle only once
    const insertBefore = this.container.querySelector('.model-dropdown');
    if (insertBefore) {
      this.container.insertBefore(toggleContainer, insertBefore);
    } else {
      this.container.appendChild(toggleContainer);
    }
    
    this.includeExperimentalToggle.addEventListener('change', this.toggleExperimentalModels);
    
    console.log(`Added experimental toggle for ${this.experimentalModels.length} experimental models`);
  }
  
  /**
   * Apply all filters and redraw model list
   */
  applyFilters() {
    const showText = this.textFilterCheckbox ? this.textFilterCheckbox.checked : true;
    const showImage = this.imageFilterCheckbox ? this.imageFilterCheckbox.checked : true;
    const showEmbedding = this.embeddingFilterCheckbox ? this.embeddingFilterCheckbox.checked : false;
    const nameFilter = this.nameFilterInput ? this.nameFilterInput.value.toLowerCase().trim() : '';
    
    // Determine if we should show experimental models
    const showExperimental = this.includeExperimentalToggle instanceof HTMLElement 
      ? this.includeExperimentalToggle.checked 
      : (typeof this.includeExperimentalToggle === 'boolean' ? this.includeExperimentalToggle : true);
    
    console.log('Filters applied:', { 
      showText, 
      showImage,
      showEmbedding: showEmbedding || '(disabled)', 
      nameFilter: nameFilter || '(none)', 
      showExperimental 
    });
    
    // Create filter function for better performance than filtering multiple times
    const filterFn = model => {
      if (!showText && model.category === 'Chat') return false;
      if (!showImage && model.category === 'Image') return false;
      if (!showEmbedding && model.category === 'Embedding') return false;
      if (!showExperimental && model.isExperimental) return false;
      if (nameFilter && !this.matchesNameFilter(model, nameFilter)) return false;
      return true;
    };
    
    // Use filter function in a single pass
    const filteredModels = this.allModels.filter(filterFn);
    
    console.log(`Filtered models: ${filteredModels.length} of ${this.allModels.length}`);
    
    if (nameFilter) {
      this.renderSearchResultsList(filteredModels, nameFilter);
    } else {
      this.renderFilteredModels(filteredModels, showText, showImage, showEmbedding);
    }
  }
  
  /**
   * Check if model matches the name filter
   * Optimized to exit early on matches
   */
  matchesNameFilter(model, filter) {
    if (!filter) return true;
    
    // Check name first as it's most likely to match
    if (model.displayName && model.displayName.toLowerCase().includes(filter)) return true;
    if (model.name && model.name.toLowerCase().includes(filter)) return true;
    
    // Then check other fields
    if (model.provider && model.provider.toLowerCase().includes(filter)) return true;
    if (model.family && model.family.toLowerCase().includes(filter)) return true;
    if (model.series && model.series.toLowerCase().includes(filter)) return true;
    if (model.groupingKey && model.groupingKey.toLowerCase().includes(filter)) return true;
    
    // No match found
    return false;
  }
  
  /**
   * Render models filtered by type, potentially rebuilding the hierarchy.
   * This version handles the Provider -> Type Group -> Model structure.
   */
  renderFilteredModels(filteredModels, showText, showImage, showEmbedding) {
    if (!this.modelListElement) return;
    this.modelListElement.innerHTML = '';
    
    if (filteredModels.length === 0) {
      this.modelListElement.innerHTML = '<div class="no-results">No models match the current filters.</div>';
      return;
    }
    
    // Create a document fragment to batch DOM operations
    const fragment = document.createDocumentFragment();
    
    // Group models first by Provider, then by Type Group (which is the `groupingKey`)
    const groupedByProvider = {};
    filteredModels.forEach(model => {
      const cat = model.category;
      // Skip if category is filtered out
      if ((cat === 'Chat' && !showText) || 
          (cat === 'Image' && !showImage) || 
          (cat === 'Embedding' && !showEmbedding)) {
        return;
      }

      const prov = model.provider;
      const typeGroupKey = model.groupingKey || 'General Models'; // Use groupingKey which corresponds to the type group

      if (!groupedByProvider[prov]) {
        groupedByProvider[prov] = { Chat: {}, Image: {}, Embedding: {} };
      }
      if (!groupedByProvider[prov][cat]) {
        groupedByProvider[prov][cat] = {};
      }
      if (!groupedByProvider[prov][cat][typeGroupKey]) {
        groupedByProvider[prov][cat][typeGroupKey] = [];
      }
      groupedByProvider[prov][cat][typeGroupKey].push(model);
    });
    
    const sortedProviderNames = Object.keys(groupedByProvider).sort((a, b) => a.localeCompare(b));

    sortedProviderNames.forEach(providerName => {
      const providerData = groupedByProvider[providerName];

      const providerElement = document.createElement('div');
      providerElement.className = 'model-provider';
    
      const providerHeader = document.createElement('div');
      providerHeader.className = 'provider-header';
      providerHeader.innerHTML = `
        <span class="provider-name">${providerName}</span>
        <i class="ri-arrow-down-s-line"></i>
      `;
      providerElement.appendChild(providerHeader);
    
      const typesContainer = document.createElement('div');
      typesContainer.className = 'provider-types'; // Renamed class for clarity
      typesContainer.style.display = 'block'; // Start expanded
      providerElement.appendChild(typesContainer);

      // Create a local fragment for each provider's type groups
      const typeGroupsFragment = document.createDocumentFragment();
      let hasAddedTypeGroups = false;

      ['Chat', 'Image', 'Embedding'].forEach(categoryName => {
        if (!providerData[categoryName] || Object.keys(providerData[categoryName]).length === 0) {
          return; // Skip empty categories for this provider
        }
        
        const typeGroups = providerData[categoryName];
        const sortedTypeGroupNames = Object.keys(typeGroups).sort((a, b) => {
           // Add custom sorting logic for type groups if needed, similar to previous family logic
           // Example: Prioritize 'Pro' > 'Flash' > 'Standard' etc.
          return this.sortModelTypes(a, b, providerName);
        });

        sortedTypeGroupNames.forEach(typeGroupName => {
          const groupModels = typeGroups[typeGroupName];
          if (!groupModels || groupModels.length === 0) return;
        
          const typeGroupElement = document.createElement('div');
          typeGroupElement.className = 'model-type-group'; // Renamed class
        
          const typeGroupHeader = document.createElement('div');
          typeGroupHeader.className = 'type-group-header'; // Renamed class
          typeGroupHeader.innerHTML = `
            <span class="type-group-name">${typeGroupName}</span>
            <i class="ri-arrow-down-s-line"></i>
          `;
          typeGroupElement.appendChild(typeGroupHeader);
        
          const modelsContainer = document.createElement('div');
          modelsContainer.className = 'type-group-models'; // Renamed class
          modelsContainer.style.display = 'block'; // Start expanded
          
          // Create a local fragment for the models within this group
          const modelsFragment = document.createDocumentFragment();

          // Sort models within the type group (e.g., by variant or display name)
          const sortedModels = groupModels.sort((a, b) => {
              // Special handling for Gemini provider - sort by version within each type group
              if (a.provider.toLowerCase() === 'gemini' && b.provider.toLowerCase() === 'gemini') {
                  // First parse versions as floats, defaulting to 0 if not present
                  const aVersion = parseFloat(a.version || '0');
                  const bVersion = parseFloat(b.version || '0');
                  
                  // If versions are different, sort by higher version first
                  if (aVersion !== bVersion) {
                      return bVersion - aVersion; // Higher versions first (2.5 before 2.0)
                  }
                  
                  // If versions are the same, fall back to variant/display name sorting
              }
              
              // Original sorting logic for non-Gemini or same-version Gemini models
              const variantA = a.variant || 'z'; // 'z' to push Default/Unknown last
              const variantB = b.variant || 'z';
              if (variantA !== variantB) {
                  if (variantA === 'Default') return 1;
                  if (variantB === 'Default') return -1;
                  return variantA.localeCompare(variantB);
              }
              return a.displayName.localeCompare(b.displayName);
          });

          sortedModels.forEach(model => {
            const modelElement = document.createElement('div');
            modelElement.className = 'model-option';
            // Use a unique key combining provider and model id
            modelElement.setAttribute('data-model-key', `${model.provider}:::${model.id}`); 
          
            if (this.selectedModel && this.selectedModel.id === model.id && this.selectedModel.provider === model.provider) {
              modelElement.classList.add('selected');
            }
            
            modelElement.innerHTML = `
                <span class="model-name">${model.displayName}</span>
                ${model.isExperimental ? '<span class="experimental-tag">Exp</span>' : ''}
            `;
            
            modelElement.addEventListener('click', () => this.handleModelSelect(model));
            modelsFragment.appendChild(modelElement);
          });
        
          // Add all models at once to the container
          modelsContainer.appendChild(modelsFragment);
          typeGroupElement.appendChild(modelsContainer);
        
          // Click listener for type group header to toggle visibility
          typeGroupHeader.addEventListener('click', function() {
            const container = this.nextElementSibling;
            const icon = this.querySelector('i');
            const isExpanded = container.style.display !== 'none';
            container.style.display = isExpanded ? 'none' : 'block';
            icon.className = isExpanded ? 'ri-arrow-right-s-line' : 'ri-arrow-down-s-line';
          });

          typeGroupsFragment.appendChild(typeGroupElement);
          hasAddedTypeGroups = true;
        });
      }); 
      
      // Add all type groups at once to the provider's types container
      typesContainer.appendChild(typeGroupsFragment);
      
      // Click listener for provider header to toggle visibility
      providerHeader.addEventListener('click', function() {
          const container = this.nextElementSibling;
          const icon = this.querySelector('i');
          const isExpanded = container.style.display !== 'none';
          container.style.display = isExpanded ? 'none' : 'block';
          icon.className = isExpanded ? 'ri-arrow-right-s-line' : 'ri-arrow-down-s-line';
      });

      // Only add the provider element if it contains any type groups
      if (hasAddedTypeGroups) {
          fragment.appendChild(providerElement);
      }
    });
    
    // Add all provider elements to the model list at once
    this.modelListElement.appendChild(fragment);
      
    // Apply syntax highlighting if hljs is available
    if (typeof hljs !== 'undefined') {
      this.modelListElement.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightBlock(block);
      });
    }
  }
  
  /**
   * Fetch models from the API endpoint
   * Returns true on success, false on failure.
   */
  async fetchModels() {
    this.allModels = [];
    this.experimentalModels = [];
    this.processedModels = { Chat: [], Image: [], Embedding: [] };

    try {
      console.log('Fetching models...');
      const response = await fetch(this.API_MODELS_URL);
      
      if (!response.ok) {
        console.error('Failed to fetch models from API');
        return false;
      }
      
      const data = await response.json();
      
      // Log the full received object
      console.log('Full object received from API:', data);
      
      if (!data.hierarchical_groups || data.hierarchical_groups.length === 0) {
        console.error('Invalid or empty model data received (expected hierarchical_groups)');
        return false;
      }
      
      this.processedModels = this.processModels(data.hierarchical_groups);
      return true;
    } catch (error) {
      console.error('Error fetching models:', error);
      return false;
    }
  }
  
  /**
   * Process models data into the hierarchical structure.
   * Populates this.allModels and this.experimentalModels as a side effect.
   */
  processModels(hierarchicalGroups) {
    if (!hierarchicalGroups || !Array.isArray(hierarchicalGroups)) {
      console.error('Invalid hierarchical model data received');
      return { Chat: [], Image: [], Embedding: [] };
    }
    
    console.log('Processing pre-classified hierarchical models...');
    
    // Pre-allocate all arrays and objects
    const structured = { Chat: {}, Image: {}, Embedding: {} };
    this.allModels = [];
    this.experimentalModels = [];

    const processGroup = (group, currentProvider, currentType) => {
      const groupName = group.group_name;
      const groupValue = group.group_value;

      // Update context information
      if (groupName === 'provider') {
        currentProvider = groupValue;
      }
      if (groupName === 'type') {
        currentType = groupValue;
      }

      // Process models directly attached to this group (expected at version level)
      if (group.models && group.models.length > 0) {
        for (let i = 0; i < group.models.length; i++) {
          const model = group.models[i];
          if (!model || !model.id) continue; // Skip invalid models

          // Use the category directly from the model or determine from capabilities
          let categoryName;
          if (model.type === 'Image Generation' || 
              (model.capabilities && model.capabilities.includes('Image Generation'))) {
            categoryName = 'Image'; 
          } else if (model.type === 'Embedding' || 
              (model.capabilities && model.capabilities.includes('embedding'))) {
            categoryName = 'Embedding';
          } else {
            categoryName = 'Chat'; // Default to Chat
          }
          
          // Skip embedding models unless specifically configured to show them
          if (categoryName === 'Embedding' && !this.includeEmbeddings) {
            continue;
          }
          
          // Use the pre-classified experimental flag directly
          const isExperimental = model.is_experimental === true;
          
          // Get display name or normalize it if not provided
          const displayName = model.display_name || this.normalizeModelName(model);
          
          // Use the pre-classified model type directly
          const type = model.type || currentType || 'Standard';
          
          // Use group value as groupingKey (already classified in hierarchy)
          const groupingKey = currentType || 'General Models';

          const processedModel = {
            id: model.id,
            name: model.name || model.id,
            provider: currentProvider || model.provider || 'UnknownProvider',
            category: categoryName,
            type: type,
            family: model.family || 'Unknown Family',
            series: model.series || 'Unknown Series',
            variant: model.variant || 'Default',
            groupingKey: groupingKey,
            displayName: displayName,
            isExperimental: isExperimental,
            isMultimodal: model.is_multimodal || (model.capabilities || []).includes('vision') || false,
            capabilities: model.capabilities || [],
            contextSize: model.context_size || 0,
            version: model.version || ''
          };

          // Add to structured data
          if (!structured[categoryName][processedModel.provider]) {
            structured[categoryName][processedModel.provider] = {};
          }
          if (!structured[categoryName][processedModel.provider][processedModel.groupingKey]) {
            structured[categoryName][processedModel.provider][processedModel.groupingKey] = [];
          }
          structured[categoryName][processedModel.provider][processedModel.groupingKey].push(processedModel);

          // Add to flat lists
          this.allModels.push(processedModel);
          if (processedModel.isExperimental) {
            this.experimentalModels.push(processedModel);
          }
        }
      }

      // Recursively process children
      if (group.children && group.children.length > 0) {
        for (let i = 0; i < group.children.length; i++) {
          processGroup(group.children[i], currentProvider, currentType);
        }
      }
    };

    // Start processing from the root (provider) groups
    hierarchicalGroups.forEach(rootGroup => processGroup(rootGroup, null, null));

    // Convert the structured map into the final array format expected by rendering
    const finalStructure = { Chat: [], Image: [], Embedding: [] };
    
    // Pre-calculate provider comparisons
    const sortProviderFn = (a, b) => a.localeCompare(b);
    
    Object.keys(structured).forEach(catName => {
      const providers = structured[catName];
      const sortedProviderNames = Object.keys(providers).sort(sortProviderFn);

      sortedProviderNames.forEach(provName => {
        const groups = providers[provName];

        const sortedGroupNames = Object.keys(groups).sort((a, b) => {
          // Use custom sorting function for model types
          return this.sortModelTypes(a, b, provName);
        });

        const groupsList = [];
        for (let i = 0; i < sortedGroupNames.length; i++) {
          const groupName = sortedGroupNames[i];
          const models = groups[groupName];
          if (models.length > 0) {
            // Sort models only once per group
            const sortedModels = models.sort(this.sortModelsByProvider);
            groupsList.push({ name: groupName, models: sortedModels });
          }
        }

        if (groupsList.length > 0) {
          finalStructure[catName].push({ name: provName, families: groupsList });
        }
      });
    });

    return finalStructure;
  }
  
  /**
   * Cache the processed model structure and flat lists
   */
  cacheModels() {
    try {
      localStorage.setItem('modelDropdownCache', JSON.stringify({
        timestamp: Date.now(),
        processed: this.processedModels,
        all: this.allModels,
        experimental: this.experimentalModels
      }));
    } catch (e) {
      console.warn('Failed to cache models:', e);
    }
  }
  
  /**
   * Get cached models if available and not expired
   */
  getCachedModels() {
    try {
      const cache = localStorage.getItem('modelDropdownCache');
      if (!cache) return null;
      
      const parsedCache = JSON.parse(cache);
      if (!parsedCache.timestamp || !parsedCache.processed || !parsedCache.all) {
          console.warn('Invalid cache structure found.');
          localStorage.removeItem('modelDropdownCache');
          return null;
      }

      const { timestamp, processed, all, experimental } = parsedCache;
      const cacheAge = Date.now() - timestamp;
      
      return cacheAge < this.cacheExpiryTime ? { 
        processed, 
        all, 
        experimental: experimental || []
      } : null;
    } catch (e) {
      console.warn('Failed to retrieve or parse cached models:', e);
      localStorage.removeItem('modelDropdownCache');
      return null;
    }
  }
  
  /**
   * Render the dropdown UI
   */
  render() {
    this.container.innerHTML = '';
    
    // Create filter UI if needed
    this.createFilterUI();
    
    // Create main dropdown
    this.createDropdownUI();
    
    // Apply filters to populate the dropdown
    this.applyFilters();
  }
  
  /**
   * Create the filter UI elements if needed
   */
  createFilterUI() {
    if (!this.textFilterCheckbox && !this.imageFilterCheckbox && !this.nameFilterInput) {
      const filterContainer = document.createElement('div');
      filterContainer.className = 'model-filters';
      
      // Create category filters
      const categoryFilters = document.createElement('div');
      categoryFilters.className = 'category-filters';
      
      // Text models filter
      const textFilter = document.createElement('div');
      textFilter.className = 'filter-option';
      this.textFilterCheckbox = document.createElement('input');
      this.textFilterCheckbox.type = 'checkbox';
      this.textFilterCheckbox.id = 'filter-text';
      this.textFilterCheckbox.checked = true;
      const textLabel = document.createElement('label');
      textLabel.htmlFor = 'filter-text';
      textLabel.textContent = 'Text Models';
      textFilter.appendChild(this.textFilterCheckbox);
      textFilter.appendChild(textLabel);
      
      // Image models filter
      const imageFilter = document.createElement('div');
      imageFilter.className = 'filter-option';
      this.imageFilterCheckbox = document.createElement('input');
      this.imageFilterCheckbox.type = 'checkbox';
      this.imageFilterCheckbox.id = 'filter-image';
      this.imageFilterCheckbox.checked = true;
      const imageLabel = document.createElement('label');
      imageLabel.htmlFor = 'filter-image';
      imageLabel.textContent = 'Image Models';
      imageFilter.appendChild(this.imageFilterCheckbox);
      imageFilter.appendChild(imageLabel);
      
      categoryFilters.appendChild(textFilter);
      categoryFilters.appendChild(imageFilter);
      
      // Only add embedding filter if we support embeddings
      if (this.includeEmbeddings) {
        const embeddingFilter = document.createElement('div');
        embeddingFilter.className = 'filter-option';
        this.embeddingFilterCheckbox = document.createElement('input');
        this.embeddingFilterCheckbox.type = 'checkbox';
        this.embeddingFilterCheckbox.id = 'filter-embedding';
        this.embeddingFilterCheckbox.checked = false;
        const embeddingLabel = document.createElement('label');
        embeddingLabel.htmlFor = 'filter-embedding';
        embeddingLabel.textContent = 'Embedding Models';
        embeddingFilter.appendChild(this.embeddingFilterCheckbox);
        embeddingFilter.appendChild(embeddingLabel);
        categoryFilters.appendChild(embeddingFilter);
      }
      
      // Create search filter
      const searchFilter = document.createElement('div');
      searchFilter.className = 'search-filter';
      const searchLabel = document.createElement('label');
      searchLabel.htmlFor = 'model-name-filter';
      searchLabel.textContent = 'Search Models: ';
      this.nameFilterInput = document.createElement('input');
      this.nameFilterInput.type = 'text';
      this.nameFilterInput.id = 'model-name-filter';
      this.nameFilterInput.placeholder = 'Type to search...';
      searchFilter.appendChild(searchLabel);
      searchFilter.appendChild(this.nameFilterInput);
      
      filterContainer.appendChild(categoryFilters);
      filterContainer.appendChild(searchFilter);
      
      // Add event listeners
      this.textFilterCheckbox.addEventListener('change', this.applyFilters);
      this.imageFilterCheckbox.addEventListener('change', this.applyFilters);
      if (this.embeddingFilterCheckbox) {
        this.embeddingFilterCheckbox.addEventListener('change', this.applyFilters);
      }
      this.nameFilterInput.addEventListener('input', this.applyFilters);
      
      this.container.appendChild(filterContainer);
    }
  }
  
  /**
   * Create the dropdown UI elements
   */
  createDropdownUI() {
    this.dropdownElement = document.createElement('div');
    this.dropdownElement.className = 'model-dropdown';
    this.container.appendChild(this.dropdownElement);
    
    this.modelListElement = document.createElement('div');
    this.modelListElement.className = 'model-list';
    this.dropdownElement.appendChild(this.modelListElement);
  }
  
  /**
   * Handle model selection
   */
  handleModelSelect(model) {
    if (!model || !model.provider || !model.id) {
        console.warn("Invalid model object passed to handleModelSelect:", model);
        return;
    }
    console.log("Model selected:", model);

    const allOptions = this.modelListElement.querySelectorAll('.model-option');
    allOptions.forEach(el => el.classList.remove('selected'));
    
    // Use the unique key format for the selector
    const modelKey = `${model.provider}:::${model.id}`;
    const selector = `.model-option[data-model-key="${modelKey}"]`;
    const selectedElement = this.modelListElement.querySelector(selector);
    if (selectedElement) {
      selectedElement.classList.add('selected');
    } else {
        console.warn(`Could not find model element for key ${modelKey} to mark as selected.`);
    }
    
    this.selectedModel = model;
    
    const displayElement = document.getElementById('selected-model-display');
    if (displayElement) {
      displayElement.innerText = model.displayName || model.name;
    }
    
    this.onChange(model);
  }
  
  /**
   * Toggle showing/hiding experimental models by re-applying filters
   */
  toggleExperimentalModels() {
    if (this.includeExperimentalToggle && this.includeExperimentalToggle instanceof HTMLElement) {
      console.log('Toggling experimental models visibility. New state:', this.includeExperimentalToggle.checked);
    }
    this.applyFilters();
  }
  
  /**
   * Get the currently selected model
   */
  getSelectedModel() {
    return this.selectedModel;
  }
  
  /**
   * Render a flat list of models that match the search filter
   */
  renderSearchResultsList(filteredModels, nameFilter) {
    if (!this.modelListElement) return;
    this.modelListElement.innerHTML = '';
    
    if (filteredModels.length === 0) {
      this.modelListElement.innerHTML = `<div class="no-results">No models match the search term "${nameFilter}".</div>`;
      return;
    }
    
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Group by category
    const groupedByCategory = { Chat: [], Image: [], Embedding: [] };
    filteredModels.forEach(model => {
      if (model.category in groupedByCategory) {
        groupedByCategory[model.category].push(model);
      }
    });
    
    // Create search results container
    const searchResultsContainer = document.createElement('div');
    searchResultsContainer.className = 'search-results';
    
    const searchHeader = document.createElement('div');
    searchHeader.className = 'search-header';
    searchHeader.innerHTML = `<h3>Search results for "${nameFilter}"</h3>`;
    searchResultsContainer.appendChild(searchHeader);
    
    ['Chat', 'Image', 'Embedding'].forEach(category => {
      const models = groupedByCategory[category];
      if (models.length === 0) return;
      
      const categoryElement = document.createElement('div');
      categoryElement.className = 'search-category';
      
      const categoryHeader = document.createElement('div');
      categoryHeader.className = 'search-category-header';
      categoryHeader.innerHTML = `<h4>${category} Models (${models.length})</h4>`;
      categoryElement.appendChild(categoryHeader);
      
      const modelsList = document.createElement('div');
      modelsList.className = 'search-models-list';
      
      // Use a local fragment for the models in this category
      const modelsFragment = document.createDocumentFragment();
      
      // Sort models by provider and name
      const sortedModels = models.sort((a, b) => {
        const providerCompare = a.provider.localeCompare(b.provider);
        if (providerCompare !== 0) return providerCompare;
        return a.displayName.localeCompare(b.displayName);
      });
      
      sortedModels.forEach(model => {
        const modelElement = document.createElement('div');
        modelElement.className = 'model-option search-result-model';
        modelElement.setAttribute('data-model-key', `${model.provider}:::${model.id}`);
        
        if (this.selectedModel && this.selectedModel.id === model.id && this.selectedModel.provider === model.provider) {
          modelElement.classList.add('selected');
        }
        
        modelElement.innerHTML = `
          <span class="model-name">${model.displayName}</span>
          <span class="model-provider">${model.provider}</span>
          ${model.isExperimental ? '<span class="experimental-tag">Exp</span>' : ''}
        `;
        
        modelElement.addEventListener('click', () => this.handleModelSelect(model));
        modelsFragment.appendChild(modelElement);
      });
      
      // Add all models to the category list at once
      modelsList.appendChild(modelsFragment);
      categoryElement.appendChild(modelsList);
      searchResultsContainer.appendChild(categoryElement);
    });
    
    // Add the entire search results to the main fragment
    fragment.appendChild(searchResultsContainer);
    
    // Add everything to the DOM in one operation
    this.modelListElement.appendChild(fragment);
  }
  
  /**
   * Normalize model name for display purposes with regex caching
   */
  normalizeModelName(model) {
    let displayName = model.display_name || model.name || model.id || 'Unknown Model';
    
    // Return early if already has a display_name
    if (model.display_name) {
      return displayName;
    }
    
    // Basic cleanup - replace underscores with spaces and capitalize first letter of each word
    displayName = displayName.replace(/_/g, ' ')
                            .replace(/\b\w/g, l => l.toUpperCase());
    
    // Format specific model patterns
    const idLower = displayName.toLowerCase();
    
    // Format GPT models 
    if (idLower.includes('gpt-')) {
      // Use simple if-statements to avoid expensive regex operations if possible
      
      // Handle versioned GPT models - use cached RegExp object for repeated operations
      if (idLower.match(/gpt-\d/)) {
        displayName = displayName.replace(/gpt-(\d+)(?:-(\d+))?(?:-(\d+))?/i, (match, major, minor, date) => {
          if (date) {
            return `GPT-${major}${minor ? `.${minor}` : ''} (${date})`;
          } else if (minor) {
            return `GPT-${major}.${minor}`;
          }
          return `GPT-${major}`;
        });
      }
      
      // Handle common suffixes - avoid regex when possible
      if (displayName.includes('-preview')) {
        displayName = displayName.replace(/-preview/i, ' Preview');
      }
      if (displayName.includes('-vision')) {
        displayName = displayName.replace(/-vision/i, ' Vision');
      }
      if (displayName.includes('-turbo')) {
        displayName = displayName.replace(/-turbo/i, ' Turbo');
      }
    }
    
    // Format Gemini models - also use direct string checks when possible
    if (idLower.includes('gemini-')) {
      displayName = displayName.replace(/gemini-(\d+\.\d+)-([a-z]+)/i, 'Gemini $1 $2');
    }
    
    return displayName.trim();
  }
  
  /**
   * Sort model types in a provider-specific manner
   * Optimized with Maps for faster lookups
   */
  sortModelTypes(typeA, typeB, provider) {
    // Fast path for simple string comparison
    if (typeA === typeB) return 0;
    
    // Use a static Map for type priorities (initialized once)
    if (!this._typePriorityMap) {
      this._typePriorityMap = new Map([
        ['Mini', 1],
        ['O Series', 2],
        ['GPT 4.5', 3],
        ['GPT 4', 4],
        ['GPT 3.5', 5],
        ['Flash Lite', 1],
        ['Flash', 2],
        ['Pro', 3], 
        ['Thinking', 4],
        ['Gemma', 5],
        ['Standard', 6],
        ['Sonnet', 1],
        ['Opus', 2],
        ['Haiku', 3],
        ['Image Generation', 90],
        ['Embedding', 100]
      ]);
      
      // Provider-specific priority maps
      this._openaiPriorityMap = new Map([
        ['Mini', 1],
        ['O Series', 2],
        ['GPT 4.5', 3],
        ['GPT 4', 4],
        ['GPT 3.5', 5],
        ['Image Generation', 90]
      ]);
      
      this._geminiPriorityMap = new Map([
        ['Flash Lite', 1],
        ['Flash', 2],
        ['Pro', 3],
        ['Thinking', 4],
        ['Gemma', 5],
        ['Standard', 6],
        ['Image Generation', 90]
      ]);
      
      this._anthropicPriorityMap = new Map([
        ['Sonnet', 1],
        ['Opus', 2],
        ['Haiku', 3]
      ]);
    }
    
    // Account for provider-specific ordering
    if (provider) {
      const providerLower = provider.toLowerCase();
      
      if (providerLower === 'openai') {
        const priorityA = this._openaiPriorityMap.get(typeA) || 50;
        const priorityB = this._openaiPriorityMap.get(typeB) || 50;
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
      } 
      else if (providerLower === 'gemini') {
        const priorityA = this._geminiPriorityMap.get(typeA) || 50;
        const priorityB = this._geminiPriorityMap.get(typeB) || 50;
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
      }
      else if (providerLower === 'anthropic') {
        const priorityA = this._anthropicPriorityMap.get(typeA) || 50;
        const priorityB = this._anthropicPriorityMap.get(typeB) || 50;
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
      }
    }
    
    // Use general priorities if no provider-specific order was applied
    const priorityA = this._typePriorityMap.get(typeA) || 50;
    const priorityB = this._typePriorityMap.get(typeB) || 50;
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Alphabetical if same priority
    return typeA.localeCompare(typeB);
  }
  
  /**
   * Helper method to sort models based on their provider and model family/type
   * Optimized with early returns and caching for repeated patterns
   */
  sortModelsByProvider(a, b) {
    // Cache common properties to avoid repeated property access
    const aProvider = a.provider && a.provider.toLowerCase();
    const bProvider = b.provider && b.provider.toLowerCase();
    const aDisplayName = a.displayName && a.displayName.toLowerCase();
    const bDisplayName = b.displayName && b.displayName.toLowerCase();
    const aId = a.id && a.id.toLowerCase();
    const bId = b.id && b.id.toLowerCase();
    
    // If providers are different, we don't need special sorting
    if (aProvider !== bProvider) {
      return aDisplayName.localeCompare(bDisplayName);
    }
    
    // For OpenAI models, prioritize Mini models first 
    if (aProvider === 'openai') {      
      // Mini models come before everything else
      const isAMini = a.groupingKey === 'Mini' || aDisplayName.includes('mini');
      const isBMini = b.groupingKey === 'Mini' || bDisplayName.includes('mini');
      
      if (isAMini !== isBMini) return isAMini ? -1 : 1; // Mini first
      
      // Special ordering for Mini models
      if (isAMini && isBMini) {
        // Define mini model priorities - higher number = higher priority
        const getMiniPriority = (modelId) => {
          if (modelId === 'gpt-4o-mini') return 3;   // Exact gpt-4o-mini first
          if (modelId.includes('o1-mini')) return 2; // o1-mini second
          if (modelId.includes('4o-mini')) return 1; // Other 4o-mini variants third
          return 0;                                  // All other minis last
        };
        
        const aPriority = getMiniPriority(aId);
        const bPriority = getMiniPriority(bId);
        
        // Sort by priority (higher numbers first)
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        // If same priority, sort alphabetically
        return aId.localeCompare(bId);
      }
      
      // O Series comes second
      const isAOSeries = a.groupingKey === 'O Series' || /^o\d/.test(aDisplayName);
      const isBOSeries = b.groupingKey === 'O Series' || /^o\d/.test(bDisplayName);
      
      if (isAOSeries !== isBOSeries) return isAOSeries ? -1 : 1; // O Series second
      
      // GPT models internal sorting
      if (a.groupingKey === b.groupingKey) {
        if (a.groupingKey === 'GPT 4') {
          // Order: GPT-4o, GPT-4 Turbo, GPT-4 Vision, GPT-4
          const aName = aDisplayName;
          const bName = bDisplayName;
          
          const isA4o = aName.includes('gpt-4o');
          const isB4o = bName.includes('gpt-4o');
          if (isA4o !== isB4o) return isA4o ? -1 : 1;
          
          const isATurbo = aName.includes('turbo');
          const isBTurbo = bName.includes('turbo');
          if (isATurbo !== isBTurbo) return isATurbo ? -1 : 1;
          
          const isAVision = aName.includes('vision');
          const isBVision = bName.includes('vision');
          if (isAVision !== isBVision) return isAVision ? -1 : 1;
        }
        
        // O Series internal sorting
        if (a.groupingKey === 'O Series') {
          const getOVersion = (modelName) => {
            const match = modelName.match(/O(\d+)/i);
            return match ? parseInt(match[1]) : 0;
          };
          
          const oVersionA = getOVersion(aDisplayName);
          const oVersionB = getOVersion(bDisplayName);
          
          if (oVersionA !== oVersionB) {
            return oVersionA - oVersionB; // Lower O numbers first
          }
        }
        
        // DALL-E sorting
        if (a.groupingKey === 'Image Generation') {
          const getDalleVersion = (modelName) => {
            const match = modelName.match(/DALL-E\s*(\d+)/i);
            return match ? parseInt(match[1]) : 0;
          };
          
          const versionA = getDalleVersion(aDisplayName);
          const versionB = getDalleVersion(bDisplayName);
          
          if (versionA !== versionB) {
            return versionB - versionA; // Higher versions first
          }
        }
        
        // For all OpenAI model groups, sort by name length (shortest first)
        const aNameLength = aId.length;
        const bNameLength = bId.length;
        
        if (aNameLength !== bNameLength) {
          return aNameLength - bNameLength; // Shorter names first
        }
      }
      
      // GPT 4.5 should come before GPT 4
      if (a.groupingKey === 'GPT 4.5' && b.groupingKey === 'GPT 4') {
        return -1;
      }
      if (a.groupingKey === 'GPT 4' && b.groupingKey === 'GPT 4.5') {
        return 1;
      }
      
      // If everything else is equal for OpenAI models, prioritize shorter names
      return aId.length - bId.length;
    }
    
    // For Gemini models, prioritize sorting by type first, then by version within each type
    if (aProvider === 'gemini') {
      // Create type order map if not already created
      if (!this._geminiTypeOrderMap) {
        this._geminiTypeOrderMap = new Map([
          ['Flash Lite', 1], 
          ['Flash', 2], 
          ['Pro', 3], 
          ['Thinking', 4], 
          ['Gemma', 5], 
          ['Standard', 6]
        ]);
      }
      
      const typeA = this._geminiTypeOrderMap.get(a.type) || 10;
      const typeB = this._geminiTypeOrderMap.get(b.type) || 10;
      
      // If types are different, sort by type
      if (typeA !== typeB) {
        return typeA - typeB;
      }
      
      // If types are the same, sort by version (higher versions first)
      const aVersion = parseFloat(a.version || 0);
      const bVersion = parseFloat(b.version || 0);
      
      if (aVersion !== bVersion) {
        return bVersion - aVersion; // Higher versions first (2.5 before 2.0 before 1.5)
      }
      
      // For same version and type, prioritize models with 'latest' in the name
      const isALatest = aId.includes('latest');
      const isBLatest = bId.includes('latest');
      if (isALatest !== isBLatest) {
        return isALatest ? -1 : 1; // Latest versions first
      }
    }
    
    // For Anthropic models, use Sonnet > Opus > Haiku ordering
    if (aProvider === 'anthropic') {
      if (!this._anthropicTypeMap) {
        this._anthropicTypeMap = new Map([
          ['Sonnet', 1], 
          ['Opus', 2], 
          ['Haiku', 3]
        ]);
      }
      
      const getClaudeType = (model) => {
        const name = model.displayName.toLowerCase();
        if (name.includes('sonnet')) return 'Sonnet';
        if (name.includes('opus')) return 'Opus';
        if (name.includes('haiku')) return 'Haiku';
        return model.type || 'Other';
      };
      
      const typeA = this._anthropicTypeMap.get(getClaudeType(a)) || 10;
      const typeB = this._anthropicTypeMap.get(getClaudeType(b)) || 10;
      
      if (typeA !== typeB) {
        return typeA - typeB;
      }
    }
    
    // Sort by timestamp (newer first)
    const timestampA = a.displayName.match(/\d{4}-\d{2}-\d{2}/);
    const timestampB = b.displayName.match(/\d{4}-\d{2}-\d{2}/);
    
    if (timestampA && timestampB && timestampA[0] !== timestampB[0]) {
      return timestampB[0].localeCompare(timestampA[0]);
    }
    
    // Finally, default to display name
    return aDisplayName.localeCompare(bDisplayName);
  }
}

if (typeof module !== 'undefined') {
  module.exports = ModelDropdown;
} else {
  window.ModelDropdown = ModelDropdown;
} 