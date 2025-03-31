/**
 * ProcessedDropdownNode - A unified interface for model dropdown items
 */
class ProcessedDropdownNode {
  constructor(options) {
    this.id = options.id;
    this.name = options.name;
    this.type = options.type;
    this.level = options.level || 0;
    this.parentId = options.parentId || null;
    this.isSelectable = options.isSelectable || false;
    this.isDisabled = options.isDisabled || false;
    this.isExpanded = options.isExpanded !== undefined ? options.isExpanded : true;
    this.originalData = options.originalData || {};
    this.category = options.category || null;
    this.provider = options.provider || null;
    this.isExperimental = options.isExperimental || false;
    this.groupingKey = options.groupingKey || null;
    this.displayName = options.displayName || options.name; // Added displayName
  }
}

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
    
    // List of recognized model types from API
    this.knownModelTypes = [
      'Vision', 'Standard', 'Turbo', 'Pro', 'Flash',
      'Gemma', 'Opus', 'Sonnet', 'Haiku', 'Embedding',
      'O Series', 'GPT 3.5', 'GPT 4', 'GPT 4.5',
      'Mini', 'Flash Lite', 'Thinking', 'Image Generation'
    ];
    
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
    this._sortModelTypes = this._sortModelTypes.bind(this);
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
      // Setup event listeners
      this._setupEventListeners();
      
      // Try to load from cache first
      const cachedData = this._loadFromCache();
      
      if (cachedData) {
        console.log('Using cached data');
        this.flatNodes = cachedData.flatNodes;
        this.nodeMap = new Map(cachedData.nodeMap);
        this.hierarchyMap = new Map(cachedData.hierarchyMap);
        this.allModels = cachedData.allModels;
        
        // Render the UI
        this.render();
        
        // Try to select first model if none selected
        if (!this.selectedModel && this.allModels.length > 0) {
          this.handleModelSelect(this.allModels[0]);
        }
        
        return true;
      }
      
      // Fetch fresh data if no cache
      console.log('Fetching fresh data');
      const success = await this._fetchModels();
        
        if (success) {
        // Save to cache
        this._saveToCache();
        
        // Render the UI
          this.render();
        
        // Try to select first model if none selected
        if (!this.selectedModel && this.allModels.length > 0) {
            this.handleModelSelect(this.allModels[0]);
        }
      
      return true;
      } else {
        this._showError('Failed to fetch models');
        return false;
      }
    } catch (error) {
      console.error('Error initializing dropdown:', error);
      this._showError(`Error: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Set up event listeners
   * @private
   */
  _setupEventListeners() {
    // Set up experimental toggle if enabled
    if (this.includeExperimentalToggle) {
      if (this.includeExperimentalToggle instanceof HTMLElement) {
        this.includeExperimentalToggle.addEventListener('change', this.toggleExperimentalModels);
      } else if (this.includeExperimentalToggle === true) {
        // Create toggle if it's just a boolean flag
        this._createExperimentalToggle();
      }
    }
    
    // Window resize listener for virtualization
    window.addEventListener('resize', this._handleResize.bind(this));
  }
  
  /**
   * Handle window resize
   * @private
   */
  _handleResize() {
    // Update virtualization parameters
    if (this.modelListElement && this.virtualization) {
      // Recalculate visible items based on container height
      const containerHeight = this.modelListElement.clientHeight;
      this.virtualization.visibleItems = Math.ceil(containerHeight / this.virtualization.itemHeight);
      this.virtualization.endIndex = this.virtualization.startIndex + this.virtualization.visibleItems + this.virtualization.buffer;
      
      // Rerender with new parameters
      this.debouncedRenderFilteredModels(this._getLastFilteredModels());
    }
  }
  
  /**
   * Create experimental toggle element
   * @private
   */
  _createExperimentalToggle() {
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'experimental-toggle-container';
    
    this.includeExperimentalToggle = document.createElement('input');
    this.includeExperimentalToggle.type = 'checkbox';
    this.includeExperimentalToggle.id = 'show-experimental-toggle';
    this.includeExperimentalToggle.checked = this.showExperimentalByDefault;
    
    const toggleLabel = document.createElement('label');
    toggleLabel.htmlFor = 'show-experimental-toggle';
    toggleLabel.textContent = 'Show Experimental Models';
    
    toggleContainer.appendChild(this.includeExperimentalToggle);
    toggleContainer.appendChild(toggleLabel);
    
    // Insert at beginning of container
    if (this.container.firstChild) {
      this.container.insertBefore(toggleContainer, this.container.firstChild);
    } else {
      this.container.appendChild(toggleContainer);
    }
    
    // Add event listener
    this.includeExperimentalToggle.addEventListener('change', this.toggleExperimentalModels);
  }
  
  /**
   * Toggle experimental models visibility
   */
  toggleExperimentalModels() {
    console.log('Toggling experimental models');
    this.applyFilters();
  }
  
  /**
   * Handle model selection
   * @param {ProcessedDropdownNode} model - The selected model node
   */
  handleModelSelect(model) {
    if (!model || !model.isSelectable) {
      console.warn('Attempted to select invalid or non-selectable model', model);
      return;
    }
    
    // Update selected model
    this.selectedModel = model;
    
    // Update UI to reflect selection
    if (this.modelListElement) {
      // Remove selected class from all options
      const options = this.modelListElement.querySelectorAll('.model-option');
      options.forEach(option => {
        option.classList.remove('selected');
        option.setAttribute('aria-selected', 'false');
      });
      
      // Add selected class to matching option
      const selector = `.model-option[data-model-key="${model.provider}:::${model.id}"]`;
      const selectedOption = this.modelListElement.querySelector(selector);
      if (selectedOption) {
        selectedOption.classList.add('selected');
        selectedOption.setAttribute('aria-selected', 'true');
        
        // Ensure selected option is visible
        this._scrollToSelectedOption(selectedOption);
      }
    }
    
    // Announce selection to screen readers
    this._announceStateChange(`Selected model: ${model.displayName}`);
    
    // Call onChange callback
    if (typeof this.onChange === 'function') {
      this.onChange(model);
    }
  }
  
  /**
   * Scroll to ensure selected option is visible
   * @private
   */
  _scrollToSelectedOption(selectedOption) {
    if (!selectedOption || !this.modelListElement) return;
    
    const containerRect = this.modelListElement.getBoundingClientRect();
    const optionRect = selectedOption.getBoundingClientRect();
    
    // Check if option is not fully visible
    if (optionRect.top < containerRect.top || optionRect.bottom > containerRect.bottom) {
      // Determine scroll position to center the option
      const scrollOffset = selectedOption.offsetTop - (this.modelListElement.clientHeight / 2) + (selectedOption.clientHeight / 2);
      this.modelListElement.scrollTop = Math.max(0, scrollOffset);
    }
  }
  
  /**
   * Get the currently selected model
   * @returns {ProcessedDropdownNode|null} The selected model or null
   */
  getSelectedModel() {
    return this.selectedModel || null;
  }
  
  /**
   * Fetch models from API
   * @private
   */
  async _fetchModels() {
    try {
      const response = await fetch(this.API_MODELS_URL);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.hierarchical_groups || !Array.isArray(data.hierarchical_groups)) {
        throw new Error('Invalid data format: missing hierarchical_groups');
      }
      
      // Process the hierarchical groups
      this.processHierarchicalGroups(data.hierarchical_groups);
      
      return true;
    } catch (error) {
      console.error('Error fetching models:', error);
      return false;
    }
  }
  
  /**
   * Save processed data to cache
   * @private
   */
  _saveToCache() {
    try {
      // Convert Map objects to array for serialization
      const cacheData = {
        timestamp: Date.now(),
        flatNodes: this.flatNodes,
        nodeMap: Array.from(this.nodeMap.entries()),
        hierarchyMap: Array.from(this.hierarchyMap.entries()),
        allModels: this.allModels
      };
      
      localStorage.setItem('modelDropdownCache', JSON.stringify(cacheData));
      console.log('Model data cached successfully');
    } catch (error) {
      console.warn('Failed to cache model data:', error);
    }
  }
  
  /**
   * Load data from cache
   * @private
   * @returns {Object|null} Cached data or null if invalid/expired
   */
  _loadFromCache() {
    try {
      const cache = localStorage.getItem('modelDropdownCache');
      if (!cache) return null;
      
      const data = JSON.parse(cache);
      
      // Validate cache
      if (!data.timestamp || !data.flatNodes || !data.nodeMap || !data.allModels) {
        console.warn('Invalid cache structure');
          localStorage.removeItem('modelDropdownCache');
          return null;
      }

      // Check expiry
      const now = Date.now();
      if (now - data.timestamp > this.cacheExpiryTime) {
        console.log('Cache expired');
        return null;
      }
      
      return data;
    } catch (error) {
      console.warn('Error loading cache:', error);
      localStorage.removeItem('modelDropdownCache');
      return null;
    }
  }
  
  /**
   * Show error message in container
   * @private
   */
  _showError(message) {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="error-message" role="alert">
        <p>${message}</p>
        <button class="retry-button">Retry</button>
      </div>
    `;
    
    const retryButton = this.container.querySelector('.retry-button');
    if (retryButton) {
      retryButton.addEventListener('click', () => {
        this.initialize();
      });
    }
  }
  
  /**
   * Render the dropdown UI with optimized DOM operations
   */
  render() {
    if (!this.container) {
      console.error('Container element is missing');
      return;
    }

    // Clear container
    this.container.innerHTML = '';
    
    // Create filter UI if needed
    this._createFilterUI();
    
    // Create main dropdown container
    this._createDropdownUI();
    
    // Apply filters to populate the dropdown
    this.applyFilters();
  }
  
  /**
   * Create the filter UI elements
   * @private
   */
  _createFilterUI() {
    // Create container once
      const filterContainer = document.createElement('div');
      filterContainer.className = 'model-filters';
    
    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();
      
      // Create category filters
      const categoryFilters = document.createElement('div');
      categoryFilters.className = 'category-filters';
      
    // Build filter options with a helper method
    this._appendFilterOption(categoryFilters, 'filter-text', 'Text Models', true);
    this._appendFilterOption(categoryFilters, 'filter-image', 'Image Models', true);
    
      if (this.includeEmbeddings) {
      this._appendFilterOption(categoryFilters, 'filter-embedding', 'Embedding Models', false);
    }
    
    fragment.appendChild(categoryFilters);
      
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
    this.nameFilterInput.setAttribute('aria-label', 'Search for models');
    
      searchFilter.appendChild(searchLabel);
      searchFilter.appendChild(this.nameFilterInput);
    fragment.appendChild(searchFilter);
      
    // Add the fragment to the container
    filterContainer.appendChild(fragment);
    this.container.appendChild(filterContainer);
      
      // Add event listeners
    this._attachFilterEventListeners();
  }
  
  /**
   * Helper to create a filter option
   * @private
   */
  _appendFilterOption(container, id, labelText, checked) {
    const filterOption = document.createElement('div');
    filterOption.className = 'filter-option';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = checked;
    
    // Store reference for later use
    this[`${id}Checkbox`] = checkbox;
    
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = labelText;
    
    filterOption.appendChild(checkbox);
    filterOption.appendChild(label);
    container.appendChild(filterOption);
  }
  
  /**
   * Attach event listeners to filters
   * @private
   */
  _attachFilterEventListeners() {
    // Use event delegation for category filters
    const categoryFilters = this.container.querySelector('.category-filters');
    if (categoryFilters) {
      categoryFilters.addEventListener('change', this.applyFilters);
    }
    
    // Debounce text input for performance
    if (this.nameFilterInput) {
      this.nameFilterInput.addEventListener('input', this.debouncedApplyFilters);
      
      // Add keyboard navigation for search results
      this.nameFilterInput.addEventListener('keydown', this._handleSearchKeyboardNavigation.bind(this));
    }
  }
  
  /**
   * Create the main dropdown UI container with proper ARIA attributes
   * @private
   */
  _createDropdownUI() {
    this.dropdownElement = document.createElement('div');
    this.dropdownElement.className = 'model-dropdown';
    this.dropdownElement.setAttribute('role', 'listbox');
    this.dropdownElement.setAttribute('aria-label', 'Available Models');
    
    // Create the model list container
    this.modelListElement = document.createElement('div');
    this.modelListElement.className = 'model-list';
    this.modelListElement.setAttribute('tabindex', '0'); // Make focusable for keyboard navigation
    
    // Set up event delegation for better performance
    this._setupEventDelegation();
    
    this.dropdownElement.appendChild(this.modelListElement);
    this.container.appendChild(this.dropdownElement);
    
    // Add scroll event listener for virtualization
    if (this.modelListElement) {
      this.modelListElement.addEventListener('scroll', this._handleScroll.bind(this));
    }
  }
  
  /**
   * Setup event delegation for the entire model list
   * @private
   */
  _setupEventDelegation() {
    if (!this.modelListElement) return;
    
    // Single event listener for all clicks using event delegation
    this.modelListElement.addEventListener('click', (e) => {
      // Handle clicks on model options
      const modelOption = e.target.closest('.model-option');
      if (modelOption) {
        const modelId = modelOption.getAttribute('data-model-key');
        const modelNode = this.nodeMap.get(modelId);
        if (modelNode && modelNode.isSelectable) {
          this.handleModelSelect(modelNode);
        }
        return;
    }
      
      // Handle clicks on group headers
      const groupHeader = e.target.closest('.provider-header, .type-group-header');
      if (groupHeader) {
        this._toggleGroupExpansion(groupHeader);
      }
    });
    
    // Keyboard navigation
    this.modelListElement.addEventListener('keydown', this._handleKeyboardNavigation.bind(this));
  }
  
  /**
   * Toggle group expansion state
   * @private
   */
  _toggleGroupExpansion(groupHeader) {
    if (!groupHeader) return;
    
    const container = groupHeader.nextElementSibling;
    const icon = groupHeader.querySelector('i');
    if (!container || !icon) return;
    
    const isExpanded = container.style.display !== 'none';
    
    // Toggle display with animation class instead of direct style changes
    if (isExpanded) {
      container.classList.add('collapsing');
      // Use transitionend to remove classes and set final state
      const onTransitionEnd = () => {
        container.style.display = 'none';
        container.classList.remove('collapsing');
        container.removeEventListener('transitionend', onTransitionEnd);
      };
      container.addEventListener('transitionend', onTransitionEnd);
    } else {
      container.style.display = 'block';
      container.classList.add('expanding');
      // Wait for next frame to apply transitions properly
      requestAnimationFrame(() => {
        const onTransitionEnd = () => {
          container.classList.remove('expanding');
          container.removeEventListener('transitionend', onTransitionEnd);
        };
        container.addEventListener('transitionend', onTransitionEnd);
      });
    }
    
    // Update icon
    icon.className = isExpanded ? 'ri-arrow-right-s-line' : 'ri-arrow-down-s-line';
    
    // Update node state
    const groupId = groupHeader.getAttribute('data-group-id');
    if (groupId) {
      const groupNode = this.nodeMap.get(groupId);
      if (groupNode) {
        groupNode.isExpanded = !isExpanded;
      }
    }
    
    // Announce to screen readers
    this._announceStateChange(
      `Group ${groupHeader.textContent.trim()} ${isExpanded ? 'collapsed' : 'expanded'}`
    );
  }
  
  /**
   * Render filtered models with virtualization
   */
  renderFilteredModels(filteredModels, showText, showImage, showEmbedding) {
    if (!this.modelListElement) return;
    
    // Clear existing content
    this.modelListElement.innerHTML = '';
    
    // Show message if no models match filters
    if (filteredModels.length === 0) {
      this.modelListElement.innerHTML = '<div class="no-results" role="alert">No models match the current filters.</div>';
      return;
    }
    
    // Group models by provider and type
    const groupedByProvider = this._groupModelsByProviderAndType(filteredModels, showText, showImage, showEmbedding);
    
    // Get sorted provider names
    const sortedProviderNames = Object.keys(groupedByProvider).sort((a, b) => a.localeCompare(b));
    
    // Create document fragment for batched DOM operations
    const fragment = document.createDocumentFragment();
    
    // Create virtualization state if needed
    if (!this.virtualization) {
      this.virtualization = {
        itemHeight: 30,  // Estimated average height of each item
        visibleItems: 20, // Number of items visible in viewport
        buffer: 10,      // Buffer items above and below viewport
        startIndex: 0,   // First visible item index
        endIndex: 30     // Last visible item index (visibleItems + buffer*2)
      };
    }
    
    // Track total items and visible range
    let totalItems = 0;
    let visibleStart = this.virtualization.startIndex;
    let visibleEnd = this.virtualization.endIndex;
    
    // Process each provider
    for (let providerIndex = 0; providerIndex < sortedProviderNames.length; providerIndex++) {
      const providerName = sortedProviderNames[providerIndex];
      const providerData = groupedByProvider[providerName];
      
      // Skip rendering if provider is outside visible range
      if (totalItems > visibleEnd) {
        // Just count items without rendering
        totalItems += this._countProviderItems(providerData);
        continue;
      }
      
      // Create provider element
      const providerElement = document.createElement('div');
      providerElement.className = 'model-provider';
      providerElement.dataset.providerIndex = providerIndex;
      
      // Create provider header
      const providerHeader = this._createProviderHeader(providerName);
      providerElement.appendChild(providerHeader);
      
      // Create types container
      const typesContainer = document.createElement('div');
      typesContainer.className = 'provider-types';
      typesContainer.style.display = 'block'; // Start expanded
      
      // Create local fragment for type groups
      const typeGroupsFragment = document.createDocumentFragment();
      let hasAddedTypeGroups = false;
      
      // Process each category (Chat, Image, Embedding)
      ['Chat', 'Image', 'Embedding'].forEach(categoryName => {
        if (!providerData[categoryName] || Object.keys(providerData[categoryName]).length === 0) {
          return; // Skip empty categories
        }
        
        // Get type groups for this category
        const typeGroups = providerData[categoryName];
        const sortedTypeGroupNames = Object.keys(typeGroups).sort((a, b) => {
          return this._sortModelTypes(a, b, providerName);
        });
        
        // Process each type group
        sortedTypeGroupNames.forEach(typeGroupName => {
          const groupModels = typeGroups[typeGroupName];
          if (!groupModels || groupModels.length === 0) return;
          
          // Skip if entire group is before visible range
          totalItems++; // Count the group header
          const groupStartIndex = totalItems;
          
          // Always render the group header if its models might be visible
          const typeGroupElement = document.createElement('div');
          typeGroupElement.className = 'model-type-group';
          
          const typeGroupHeader = this._createTypeGroupHeader(typeGroupName);
          typeGroupElement.appendChild(typeGroupHeader);
          
          const modelsContainer = document.createElement('div');
          modelsContainer.className = 'type-group-models';
          modelsContainer.style.display = 'block'; // Start expanded
          
          // Sort and process models in this group
          const sortedModels = groupModels.sort(this._sortModelsByVariantAndName);
          
          // Check if any models are in visible range
          const modelCount = sortedModels.length;
          if (groupStartIndex + modelCount < visibleStart) {
            // Skip rendering this group's models
            totalItems += modelCount;
          } else {
            // Create models with virtualization
            this._createModelElements(modelsContainer, sortedModels, totalItems, visibleStart, visibleEnd);
            totalItems += modelCount;
          }
          
          // Add models container to type group
          typeGroupElement.appendChild(modelsContainer);
          typeGroupsFragment.appendChild(typeGroupElement);
          hasAddedTypeGroups = true;
        });
      });
      
      // Add all type groups to provider
      typesContainer.appendChild(typeGroupsFragment);
      providerElement.appendChild(typesContainer);
      
      // Only add provider if it has type groups
      if (hasAddedTypeGroups) {
        fragment.appendChild(providerElement);
      }
    }
    
    // Add spacer elements for virtualization
    this._addVirtualizationSpacers(fragment, totalItems);
    
    // Add all elements to DOM in one operation
    this.modelListElement.appendChild(fragment);
    
    // Update virtualization state
    this.virtualization.totalItems = totalItems;
    
    // Apply ARIA attributes for accessibility
    this._applyAriaAttributes();
  }
  
  /**
   * Create model elements with virtualization
   * @private
   */
  _createModelElements(container, models, startIndex, visibleStart, visibleEnd) {
    // Use document fragment for batch insertion
    const fragment = document.createDocumentFragment();
    
    // Only create elements within the visible range
    models.forEach((model, index) => {
      const itemIndex = startIndex + index;
      
      // Skip if outside visible range
      if (itemIndex < visibleStart || itemIndex > visibleEnd) {
        return;
      }
      
      // Create model element
      const modelElement = document.createElement('div');
      modelElement.className = 'model-option';
      modelElement.setAttribute('role', 'option');
      modelElement.setAttribute('data-model-key', `${model.provider}:::${model.id}`);
      modelElement.setAttribute('tabindex', '0');
      modelElement.dataset.index = itemIndex;
      
      // Mark as selected if it matches current selection
      if (this.selectedModel && 
          this.selectedModel.id === model.id && 
          this.selectedModel.provider === model.provider) {
        modelElement.classList.add('selected');
        modelElement.setAttribute('aria-selected', 'true');
      } else {
        modelElement.setAttribute('aria-selected', 'false');
      }
      
      // Create content with optimized innerHTML assignment
      modelElement.innerHTML = `
        <span class="model-name">${model.displayName}</span>
        ${model.isExperimental ? '<span class="experimental-tag" aria-label="Experimental">Exp</span>' : ''}
      `;
      
      fragment.appendChild(modelElement);
    });
    
    // Add all models at once
    container.appendChild(fragment);
  }
  
  /**
   * Add spacers for virtualization
   * @private
   */
  _addVirtualizationSpacers(fragment, totalItems) {
    // Top spacer to push content down
    const topSpacer = document.createElement('div');
    topSpacer.className = 'virtualization-spacer top-spacer';
    const topSpacerHeight = Math.max(0, this.virtualization.startIndex * this.virtualization.itemHeight);
    topSpacer.style.height = `${topSpacerHeight}px`;
    fragment.insertBefore(topSpacer, fragment.firstChild);
    
    // Bottom spacer
    const bottomSpacer = document.createElement('div');
    bottomSpacer.className = 'virtualization-spacer bottom-spacer';
    const itemsAfterVisible = Math.max(0, totalItems - this.virtualization.endIndex);
    const bottomSpacerHeight = itemsAfterVisible * this.virtualization.itemHeight;
    bottomSpacer.style.height = `${bottomSpacerHeight}px`;
    fragment.appendChild(bottomSpacer);
  }
  
  /**
   * Handle scroll events for virtualization
   * @private
   */
  _handleScroll() {
    if (!this.modelListElement || !this.virtualization) return;
    
    // Request animation frame for better performance
    if (this._scrollRAF) {
      cancelAnimationFrame(this._scrollRAF);
    }
    
    this._scrollRAF = requestAnimationFrame(() => {
      const scrollTop = this.modelListElement.scrollTop;
      const estimatedStartIndex = Math.floor(scrollTop / this.virtualization.itemHeight);
      
      // Only update if scrolled enough to change the visible range
      if (Math.abs(estimatedStartIndex - this.virtualization.startIndex) >= this.virtualization.buffer / 2) {
        this.virtualization.startIndex = Math.max(0, estimatedStartIndex - this.virtualization.buffer);
        this.virtualization.endIndex = estimatedStartIndex + this.virtualization.visibleItems + this.virtualization.buffer;
        
        // Re-render with updated range
        this.debouncedRenderFilteredModels(this._getLastFilteredModels());
      }
    });
  }
  
  /**
   * Get last filtered models result (cache for re-rendering)
   * @private
   */
  _getLastFilteredModels() {
    if (!this._lastFilteredModels) {
      // Default to all models if no filter has been applied yet
      return this.allModels;
    }
    return this._lastFilteredModels;
  }
  
  /**
   * Apply ARIA attributes for accessibility
   * @private
   */
  _applyAriaAttributes() {
    if (!this.modelListElement) return;
    
    // Set roles on containers
    this.modelListElement.setAttribute('role', 'listbox');
    this.modelListElement.setAttribute('aria-multiselectable', 'false');
    
    // Set expanded state on group headers
    const groupHeaders = this.modelListElement.querySelectorAll('.provider-header, .type-group-header');
    groupHeaders.forEach(header => {
      const container = header.nextElementSibling;
      const isExpanded = container && container.style.display !== 'none';
      header.setAttribute('aria-expanded', isExpanded.toString());
      header.setAttribute('role', 'button');
    });
    
    // Set proper attributes on model options
    const modelOptions = this.modelListElement.querySelectorAll('.model-option');
    modelOptions.forEach((option, index) => {
      option.setAttribute('role', 'option');
      option.setAttribute('aria-posinset', (index + 1).toString());
      option.setAttribute('aria-setsize', modelOptions.length.toString());
    });
  }
  
  /**
   * Create a screen reader announcement element
   * @private
   */
  _announceStateChange(message) {
    if (!this._ariaLiveRegion) {
      this._ariaLiveRegion = document.createElement('div');
      this._ariaLiveRegion.setAttribute('aria-live', 'polite');
      this._ariaLiveRegion.setAttribute('class', 'sr-only');
      document.body.appendChild(this._ariaLiveRegion);
    }
    
    this._ariaLiveRegion.textContent = message;
    
    // Clear after announcement
    setTimeout(() => {
      this._ariaLiveRegion.textContent = '';
    }, 3000);
  }
  
  /**
   * Sort model types based on predefined order or alphabetically.
   * @param {string} typeA - First type name
   * @param {string} typeB - Second type name
   * @param {string} [providerName] - Optional provider context (unused here but matches call signature)
   * @returns {number} Sort order (-1, 0, 1)
   * @private
   */
  _sortModelTypes(typeA, typeB, providerName) {
    const indexA = this.knownModelTypes.indexOf(typeA);
    const indexB = this.knownModelTypes.indexOf(typeB);

    // If both types are known, sort by their index in knownModelTypes
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    // If only typeA is known, it comes first
    if (indexA !== -1) {
      return -1;
    }
    // If only typeB is known, it comes first
    if (indexB !== -1) {
      return 1;
    }
    // If neither type is known, sort alphabetically
    return typeA.localeCompare(typeB);
  }

  /**
   * Normalize model name for display (e.g., remove provider prefix)
   * @param {string} name - Original model name
   */
  normalizeModelName(name) {
    // Implementation of normalizeModelName method
  }
}

if (typeof module !== 'undefined') {
  module.exports = ModelDropdown;
} else {
  window.ModelDropdown = ModelDropdown;
} 