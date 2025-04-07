// src/lib/stores/modelFilterStore.js
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// --- Helper for LocalStorage Persistence ---
// (Similar to useLocalStorage hook)
const createPersistentStore = (key, defaultValue) => {
  let initialValue = defaultValue;
  if (browser) {
    try {
      const storedValue = localStorage.getItem(key);
      if (storedValue !== null) {
        initialValue = JSON.parse(storedValue);
      }
    } catch (e) {
      console.error(`Error reading localStorage key "${key}":`, e);
      localStorage.removeItem(key); // Clear potentially corrupted item
      initialValue = defaultValue;
    }
  }

  const store = writable(initialValue);

  // Subscribe to changes and update localStorage
  if (browser) {
    store.subscribe(value => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error(`Error writing localStorage key "${key}":`, e);
      }
    });
  }

  return store;
};


// --- Filter Stores ---

// Search term
const searchTerm = writable('');

// Category toggles
const initialCategories = { 'Chat': true, 'Image': true, 'Embedding': true };
const categories = writable(initialCategories);

// Show experimental flag (persisted)
const showExperimental = createPersistentStore('showExperimentalModels', false);

// --- Actions ---

const updateSearch = (term) => {
  searchTerm.set(term?.toLowerCase() || ''); // Always store lowercase for case-insensitive search
};

const toggleCategory = (category) => {
  categories.update(current => ({
    ...current,
    [category]: !current[category]
  }));
};

const toggleShowExperimental = () => {
  showExperimental.update(current => !current);
};

// --- Derived Store for Public Interface (optional but convenient) ---
// Or just export individual stores and actions
/*
import { derived } from 'svelte/store';
const modelFilterStore = derived(
    [searchTerm, categories, showExperimental],
    ([$search, $cats, $exp]) => ({
        searchTerm: $search,
        categories: $cats,
        showExperimental: $exp,
        updateSearch,
        toggleCategory,
        toggleShowExperimental
    })
);
export default modelFilterStore;
*/

// Export individual stores and actions for direct use
export {
    searchTerm,
    categories,
    showExperimental,
    updateSearch,
    toggleCategory,
    toggleShowExperimental
};