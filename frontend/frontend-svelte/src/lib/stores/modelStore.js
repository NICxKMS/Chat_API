import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import authStore from '$lib/stores/authStore.js'; // To get idToken

// --- Configuration ---
const CACHE_KEY = 'modelDataCache';
const CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes
// Get API base URL from environment variables (ensure it's set in .env)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// --- Internal Writable Stores ---
const allModels = writable([]);
const processedModels = writable({}); // Structure: { Category: { Provider: { Type: [Model] } } }
const experimentalModels = writable([]);
const selectedModel = writable(null);
const isLoading = writable(true);
const error = writable(null);
const cacheTimestamp = writable(0); // Store timestamp for expiry checks

// --- Helper Functions ---

// Normalize model display name
const normalizeModelName = (model) => {
    const name = model.id || '';
    return name.split('/').pop() || name;
};

// Process hierarchical model groups (adapted from context)
const processRawModels = (rawData) => {
    if (!rawData || !rawData.hierarchical_groups) {
      console.error('Invalid hierarchical model data format:', rawData);
      throw new Error('Invalid model data format');
    }

    const all = [];
    const experimental = [];
    const processed = {};

    rawData.hierarchical_groups.forEach(providerGroup => {
      const provider = providerGroup.group_value;
      if (!providerGroup.children?.length) return;

      providerGroup.children.forEach(typeGroup => {
        const type = typeGroup.group_value;
        if (!typeGroup.children?.length) return;

        typeGroup.children.forEach(versionGroup => {
          const version = versionGroup.group_value;
          if (!versionGroup.models?.length) return;

          versionGroup.models.forEach(model => {
            let category = 'Chat'; // Simplified category assignment
            if (model.type?.toLowerCase().includes('image')) category = 'Image';
            else if (model.type?.toLowerCase().includes('embedding')) category = 'Embedding';

            const processedM = {
              id: model.id,
              name: model.name || model.display_name || normalizeModelName(model),
              provider,
              type: model.type || type,
              version: model.version || version,
              category,
              is_experimental: model.is_experimental ?? false,
              is_multimodal: model.is_multimodal ?? false,
              capabilities: model.capabilities || [],
              family: model.family || type,
              series: model.series || version,
              // Add other relevant fields from original model if needed
              requiresFixedTemperature: model.requiresFixedTemperature,
              properties: model.properties,
            };

            all.push(processedM);
            if (processedM.is_experimental) {
              experimental.push(processedM);
            }

            if (!processed[category]) processed[category] = {};
            if (!processed[category][provider]) processed[category][provider] = {};
            if (!processed[category][provider][type]) processed[category][provider][type] = [];
            processed[category][provider][type].push(processedM);
          });
        });
      });
    });
    console.log(`[ModelStore] Processed ${all.length} models.`);
    return { all, processed, experimental };
};


// Check if cache is valid
const isCacheValid = (timestamp) => {
    return timestamp && (Date.now() - timestamp < CACHE_EXPIRY_TIME);
};

// Load models from cache or fetch from API
const loadModels = async (token) => {
    if (!browser) return; // Only run in browser

    isLoading.set(true);
    error.set(null);

    // Try loading from cache
    try {
        const cacheStr = localStorage.getItem(CACHE_KEY);
        if (cacheStr) {
            const cache = JSON.parse(cacheStr);
            if (isCacheValid(cache.timestamp)) {
                console.log("[ModelStore] Loading models from valid cache.");
                allModels.set(cache.all);
                processedModels.set(cache.processed);
                experimentalModels.set(cache.experimental);
                cacheTimestamp.set(cache.timestamp);
                // Select first model if none selected (restoring original logic)
                selectedModel.update(current => current || cache.all[0] || null);
                isLoading.set(false);
                return; // Exit if cache is valid
            } else {
                 console.log("[ModelStore] Cache expired or invalid.");
                 localStorage.removeItem(CACHE_KEY); // Clear expired cache
            }
        }
    } catch (e) {
        console.error("[ModelStore] Error reading cache:", e);
        localStorage.removeItem(CACHE_KEY); // Clear corrupted cache
    }

    // Fetch from API if cache is invalid/missing or fetch is forced
    console.log("[ModelStore] Fetching models from API...");
    try {
        if (!API_BASE_URL) throw new Error("API base URL is not configured (VITE_API_BASE_URL).");

        const headers = { 'Accept': 'application/json' };
        if (token) { // Use token passed from authStore subscription
            headers['Authorization'] = `Bearer ${token}`;
            console.log("[ModelStore] Using auth token for fetch.");
        } else {
             console.log("[ModelStore] No auth token available for fetch.");
        }

        const modelsUrl = new URL('/api/models/classified', API_BASE_URL).toString();
        const response = await fetch(modelsUrl, { headers });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const rawData = await response.json();
        const { all, processed, experimental } = processRawModels(rawData);

        // Update stores
        allModels.set(all);
        processedModels.set(processed);
        experimentalModels.set(experimental);
        const now = Date.now();
        cacheTimestamp.set(now);
         // Select first model if none selected
        selectedModel.update(current => current || all[0] || null);

        // Cache the new data
        try {
             const cacheData = { all, processed, experimental, timestamp: now };
             localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
             console.log("[ModelStore] Models cached successfully.");
        } catch (e) {
             console.error("[ModelStore] Error caching models:", e);
        }

    } catch (err) {
        console.error("[ModelStore] Failed to fetch models:", err);
        error.set(err.message || "Failed to fetch models");
        // Clear potentially outdated models on error?
        allModels.set([]);
        processedModels.set({});
        experimentalModels.set([]);
        cacheTimestamp.set(0);

    } finally {
        isLoading.set(false);
    }
};

// --- Actions ---

/** Selects a model */
const selectModelAction = (modelToSelect) => {
    if (modelToSelect) {
         // Ensure we're setting a valid model object, potentially refetching from allModels if only ID is passed
        // For now, assume modelToSelect is a valid model object from the list
        selectedModel.set(modelToSelect);
        console.log(`[ModelStore] Selected model: ${modelToSelect.id}`);
    }
};

/** Force re-fetch models, bypassing cache */
const refreshModels = async (token) => {
    console.log("[ModelStore] Forcing model refresh...");
     localStorage.removeItem(CACHE_KEY); // Clear cache before fetch
     cacheTimestamp.set(0);
     await loadModels(token);
};


// --- Reactive Logic ---

// Subscribe to authStore's idToken to trigger initial load/reload
let currentToken = null;
authStore.subscribe($auth => {
    // Trigger fetch only when token changes (initially or on login/logout)
    // or if models haven't been loaded yet (isLoading is true)
    // Avoid fetching repeatedly if token *value* doesn't change but store emits
    if (browser && $auth.idToken !== currentToken) {
        currentToken = $auth.idToken;
        console.log("[ModelStore] Auth token changed, reloading models.");
        loadModels(currentToken); // Pass the current token
    } else if (browser && $auth.loading === false && currentToken === null && isCacheValid(get(cacheTimestamp)) === false){
        // Handle case where auth loads (unauthenticated) but cache is invalid/missing
        console.log("[ModelStore] Auth loaded (unauthenticated), cache invalid, loading models.");
        loadModels(null);
    }
});

// Helper function to get store value non-reactively (use sparingly)
import { get } from 'svelte/store';


// --- Derived Store for Public Interface ---
const modelStore = derived(
    [allModels, processedModels, experimentalModels, selectedModel, isLoading, error],
    ([$all, $processed, $experimental, $selected, $loading, $error]) => ({
        allModels: $all,
        processedModels: $processed,
        experimentalModels: $experimental,
        selectedModel: $selected,
        isLoadingModels: $loading, // Renamed for clarity vs auth loading
        error: $error,

        // Actions
        selectModel: selectModelAction,
        refreshModels: () => {
             // Get latest token from authStore when refresh is called
             const latestAuth = get(authStore);
             // Call the top-level refreshModels function, not this one
             // This avoids the circular reference
             if (latestAuth && latestAuth.idToken) {
                 console.log("[ModelStore] Refreshing models with auth token");
                 loadModels(latestAuth.idToken);
             } else {
                 console.log("[ModelStore] Refreshing models without auth token");
                 loadModels(null);
             }
        }
    })
);


export default modelStore; 