// Example of using the model categorizer microservice from JavaScript

/**
 * Fetch categorized models from the microservice
 * @param {string} baseUrl - Base URL of the model categorizer microservice
 * @returns {Promise<Object>} - Categorized models object
 */
async function fetchCategorizedModels(baseUrl = 'http://localhost:4444') {
  try {
    console.log(`Fetching data from ${baseUrl}/models/categorized`);
    const response = await fetch(`${baseUrl}/models/categorized`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Received data:', data);
    return data;
  } catch (error) {
    console.error('Error fetching categorized models:', error);
    throw error;
  }
}

/**
 * Create dropdown UI based on categorized models
 * @param {Object} categorizedModels - The categorized models object
 * @param {HTMLElement} container - Container element for the UI
 */
function createModelDropdowns(categorizedModels, container) {
  // Clear container
  container.innerHTML = '';
  
  // Check if we have data
  if (!categorizedModels || Object.keys(categorizedModels).length === 0) {
    const noDataMsg = document.createElement('p');
    noDataMsg.textContent = 'No model data available.';
    container.appendChild(noDataMsg);
    return;
  }
  
  // For each provider
  Object.entries(categorizedModels).forEach(([provider, families]) => {
    // Create provider section
    const providerSection = document.createElement('div');
    providerSection.className = 'provider-section';
    
    const providerHeading = document.createElement('h2');
    providerHeading.textContent = provider;
    providerSection.appendChild(providerHeading);
    
    // Sort families for consistent display
    const sortedFamilies = Object.entries(families).sort(([familyA], [familyB]) => {
      // Custom sorting logic to ensure a specific order 
      // (newer models first, unknown/other last)
      if (familyA.includes('Unknown') || familyA.includes('Other')) return 1;
      if (familyB.includes('Unknown') || familyB.includes('Other')) return -1;
      
      // Extract version numbers if present
      const versionA = extractVersionNumber(familyA);
      const versionB = extractVersionNumber(familyB);
      
      if (versionA && versionB) {
        // Sort numerically in descending order (newer versions first)
        return versionB - versionA;
      }
      
      // Alphabetical sorting as fallback
      return familyA.localeCompare(familyB);
    });
    
    // For each family (sorted)
    sortedFamilies.forEach(([family, types]) => {
      const familySection = document.createElement('div');
      familySection.className = 'family-section';
      
      const familyHeading = document.createElement('h3');
      familyHeading.textContent = family;
      familySection.appendChild(familyHeading);
      
      // Sort types for consistent display 
      const sortedTypes = Object.entries(types).sort(([typeA], [typeB]) => {
        // Custom sorting for types
        if (typeA === 'Standard') return -1;
        if (typeB === 'Standard') return 1;
        return typeA.localeCompare(typeB);
      });
      
      // For each type (sorted)
      sortedTypes.forEach(([type, models]) => {
        const typeSection = document.createElement('div');
        typeSection.className = 'type-section';
        
        const typeHeading = document.createElement('h4');
        typeHeading.textContent = type;
        typeSection.appendChild(typeHeading);
        
        // Create dropdown
        const select = document.createElement('select');
        select.id = `${provider}-${family}-${type}`.replace(/\s+/g, '-').toLowerCase();
        select.setAttribute('data-provider', provider);
        select.setAttribute('data-family', family);
        select.setAttribute('data-type', type);
        
        // Add latest model
        if (models.latest) {
          const option = document.createElement('option');
          option.value = models.latest;
          option.textContent = `${models.latest} (Latest)`;
          select.appendChild(option);
        }
        
        // Add other versions (already sorted from backend)
        if (models.other_versions && Array.isArray(models.other_versions)) {
          models.other_versions.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            select.appendChild(option);
          });
        }
        
        typeSection.appendChild(select);
        familySection.appendChild(typeSection);
      });
      
      providerSection.appendChild(familySection);
    });
    
    container.appendChild(providerSection);
  });
  
  // Add CSS styles for better visualization
  addDropdownStyles();
}

/**
 * Helper function to extract version numbers from family names
 * @param {string} str - String to extract version from
 * @returns {number|null} - Extracted version number or null
 */
function extractVersionNumber(str) {
  const match = str.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

/**
 * Add CSS styles for prettier dropdown display
 */
function addDropdownStyles() {
  // Check if styles already exist
  if (document.getElementById('model-dropdown-styles')) {
    return;
  }
  
  const style = document.createElement('style');
  style.id = 'model-dropdown-styles';
  style.textContent = `
    .provider-section { 
      margin-bottom: 30px; 
      padding: 15px;
      border: 1px solid #eee;
      border-radius: 5px;
      background-color: #fcfcfc;
    }
    .provider-section h2 {
      margin-top: 0;
      color: #333;
      text-transform: capitalize;
    }
    .family-section {
      margin-bottom: 20px;
      padding: 10px;
      border-left: 3px solid #2196F3;
      background-color: #f8f9fa;
    }
    .type-section {
      margin-bottom: 15px;
    }
    .type-section select {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Register a new model with the service
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @param {Object} metadata - Model metadata
 * @param {string} baseUrl - Base URL of the model categorizer microservice
 * @returns {Promise<Object>} - Response from the service
 */
async function registerModel(provider, model, metadata, baseUrl = 'http://localhost:4444') {
  try {
    const response = await fetch(`${baseUrl}/models/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider,
        model,
        metadata
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error registering model:', error);
    throw error;
  }
}

// Example usage
document.addEventListener('DOMContentLoaded', async () => {
  // Ensure DOM elements exist
  const jsonContainer = document.getElementById('json-output');
  const uiContainer = document.getElementById('model-dropdowns');
  const errorMessage = document.getElementById('error-message');
  
  if (!jsonContainer) {
    console.error('Error: Element with ID "json-output" not found');
  }
  
  if (!uiContainer) {
    console.error('Error: Element with ID "model-dropdowns" not found');
  }
  
  if (!errorMessage) {
    console.error('Error: Element with ID "error-message" not found');
  }
  
  try {
    // Fetch categorized models
    const models = await fetchCategorizedModels();
    
    // Display as JSON
    if (jsonContainer) {
      jsonContainer.textContent = JSON.stringify(models, null, 2);
    }
    
    // Create UI dropdowns
    if (uiContainer) {
      createModelDropdowns(models, uiContainer);
    }
    
    // Handle registration form if it exists
    const registrationForm = document.getElementById('register-model-form');
    if (registrationForm) {
      registrationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const provider = document.getElementById('provider')?.value;
        const model = document.getElementById('model')?.value;
        const family = document.getElementById('family')?.value;
        const type = document.getElementById('type')?.value;
        const capabilities = document.getElementById('capabilities')?.value.split(',').map(c => c.trim());
        
        if (!provider || !model) {
          alert('Provider and model name are required!');
          return;
        }
        
        try {
          const result = await registerModel(provider, model, {
            family,
            type,
            capabilities,
            contextWindow: parseInt(document.getElementById('context-size')?.value) || undefined,
            releaseDate: document.getElementById('release-date')?.value || undefined
          });
          
          alert('Model registered successfully!');
          
          // Refresh the categorized models
          const updatedModels = await fetchCategorizedModels();
          if (jsonContainer) {
            jsonContainer.textContent = JSON.stringify(updatedModels, null, 2);
          }
          if (uiContainer) {
            createModelDropdowns(updatedModels, uiContainer);
          }
        } catch (error) {
          alert(`Error registering model: ${error.message}`);
        }
      });
    }
  } catch (error) {
    if (errorMessage) {
      errorMessage.textContent = 
        `Failed to load models: ${error.message}. Make sure the microservice is running.`;
    }
    
    // Add a retry button
    const retryButton = document.createElement('button');
    retryButton.textContent = 'Retry Connection';
    retryButton.style.marginTop = '10px';
    retryButton.addEventListener('click', () => {
      window.location.reload();
    });
    
    if (errorMessage) {
      errorMessage.appendChild(document.createElement('br'));
      errorMessage.appendChild(retryButton);
    }
    
    // Show health check status
    try {
      const healthResponse = await fetch('http://localhost:4444/health');
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        const healthStatus = document.createElement('p');
        healthStatus.textContent = `Server health status: ${healthData.status}`;
        if (errorMessage) {
          errorMessage.appendChild(healthStatus);
        }
      }
    } catch (healthError) {
      const serverStatus = document.createElement('p');
      serverStatus.textContent = 'The server appears to be offline.';
      serverStatus.style.color = 'red';
      if (errorMessage) {
        errorMessage.appendChild(serverStatus);
      }
    }
  }
}); 