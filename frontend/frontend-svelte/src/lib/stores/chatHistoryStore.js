import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// --- Internal Writable Store ---
const chatHistory = writable([]);
const isLoading = writable(false);
const error = writable(null);

// --- IndexedDB Setup ---
let db;

const initDB = async () => {
  if (!browser) return;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ChatApp', 1);

    request.onerror = () => {
      error.set('Failed to open database');
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('chats')) {
        const store = db.createObjectStore('chats', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('title', 'title', { unique: false });
      }
    };
  });
};

// --- Actions ---

/**
 * Saves the current chat to IndexedDB
 * @param {Object} chat - The chat object to save
 * @param {string} chat.title - The chat title
 * @param {Array} chat.messages - Array of chat messages
 * @param {Object} chat.model - The model used for this chat
 * @param {Object} chat.settings - The settings used for this chat
 */
const saveChat = async (chat) => {
  if (!browser || !db) return;

  try {
    const transaction = db.transaction(['chats'], 'readwrite');
    const store = transaction.objectStore('chats');
    
    const chatData = {
      ...chat,
      timestamp: Date.now(),
      lastModified: Date.now()
    };

    await new Promise((resolve, reject) => {
      const request = store.add(chatData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Refresh the chat list
    await loadChats();
  } catch (err) {
    console.error('Error saving chat:', err);
    error.set('Failed to save chat');
  }
};

/**
 * Loads all saved chats from IndexedDB
 */
const loadChats = async () => {
  if (!browser || !db) return;

  try {
    isLoading.set(true);
    const transaction = db.transaction(['chats'], 'readonly');
    const store = transaction.objectStore('chats');
    const index = store.index('timestamp');

    const chats = await new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Sort by timestamp descending (newest first)
    chatHistory.set(chats.sort((a, b) => b.timestamp - a.timestamp));
  } catch (err) {
    console.error('Error loading chats:', err);
    error.set('Failed to load chats');
  } finally {
    isLoading.set(false);
  }
};

/**
 * Loads a specific chat by ID
 * @param {number} id - The ID of the chat to load
 * @returns {Promise<Object>} The chat data
 */
const loadChatById = async (id) => {
  if (!browser || !db) return null;

  try {
    const transaction = db.transaction(['chats'], 'readonly');
    const store = transaction.objectStore('chats');

    return await new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error loading chat:', err);
    error.set('Failed to load chat');
    return null;
  }
};

/**
 * Deletes a chat by ID
 * @param {number} id - The ID of the chat to delete
 */
const deleteChat = async (id) => {
  if (!browser || !db) return;

  try {
    const transaction = db.transaction(['chats'], 'readwrite');
    const store = transaction.objectStore('chats');

    await new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Refresh the chat list
    await loadChats();
  } catch (err) {
    console.error('Error deleting chat:', err);
    error.set('Failed to delete chat');
  }
};

/**
 * Updates an existing chat
 * @param {number} id - The ID of the chat to update
 * @param {Object} updates - The updates to apply
 */
const updateChat = async (id, updates) => {
  if (!browser || !db) return;

  try {
    const transaction = db.transaction(['chats'], 'readwrite');
    const store = transaction.objectStore('chats');

    // Get the existing chat
    const existingChat = await new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!existingChat) {
      throw new Error('Chat not found');
    }

    // Update the chat
    const updatedChat = {
      ...existingChat,
      ...updates,
      lastModified: Date.now()
    };

    await new Promise((resolve, reject) => {
      const request = store.put(updatedChat);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Refresh the chat list
    await loadChats();
  } catch (err) {
    console.error('Error updating chat:', err);
    error.set('Failed to update chat');
  }
};

/**
 * Searches for chats containing the query in title or messages
 * @param {string} query - The search query
 * @returns {Promise<Array>} - Array of matching chats
 */
const searchChats = async (query) => {
  if (!browser || !db) return [];
  
  try {
    isLoading.set(true);
    const transaction = db.transaction(['chats'], 'readonly');
    const store = transaction.objectStore('chats');
    
    const chats = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // Filter chats by title or message content
    const lowerQuery = query.toLowerCase();
    const matchingChats = chats.filter(chat => {
      // Check title
      if (chat.title.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      
      // Check messages
      return chat.messages.some(msg => 
        msg.content.toLowerCase().includes(lowerQuery)
      );
    });
    
    // Sort by timestamp descending (newest first)
    return matchingChats.sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.error('Error searching chats:', err);
    error.set('Failed to search chats');
    return [];
  } finally {
    isLoading.set(false);
  }
};

/**
 * Exports all chats to a JSON file
 * @returns {Promise<string>} - The JSON string of all chats
 */
const exportChats = async () => {
  if (!browser || !db) return null;
  
  try {
    isLoading.set(true);
    const transaction = db.transaction(['chats'], 'readonly');
    const store = transaction.objectStore('chats');
    
    const chats = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // Create a JSON string with all chats
    const exportData = {
      version: '1.0',
      timestamp: Date.now(),
      chats: chats
    };
    
    return JSON.stringify(exportData, null, 2);
  } catch (err) {
    console.error('Error exporting chats:', err);
    error.set('Failed to export chats');
    return null;
  } finally {
    isLoading.set(false);
  }
};

/**
 * Imports chats from a JSON string
 * @param {string} jsonString - The JSON string containing chats to import
 * @returns {Promise<boolean>} - Whether the import was successful
 */
const importChats = async (jsonString) => {
  if (!browser || !db) return false;
  
  try {
    isLoading.set(true);
    
    // Parse the JSON string
    const importData = JSON.parse(jsonString);
    
    // Validate the import data
    if (!importData.version || !importData.chats || !Array.isArray(importData.chats)) {
      throw new Error('Invalid import data format');
    }
    
    // Start a transaction
    const transaction = db.transaction(['chats'], 'readwrite');
    const store = transaction.objectStore('chats');
    
    // Clear existing chats
    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    // Add imported chats
    for (const chat of importData.chats) {
      // Ensure each chat has required fields
      if (!chat.id || !chat.title || !chat.messages) {
        console.warn('Skipping invalid chat:', chat);
        continue;
      }
      
      // Add the chat to the store
      await new Promise((resolve, reject) => {
        const request = store.add(chat);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
    
    // Refresh the chat list
    await loadChats();
    
    return true;
  } catch (err) {
    console.error('Error importing chats:', err);
    error.set('Failed to import chats: ' + err.message);
    return false;
  } finally {
    isLoading.set(false);
  }
};

// Initialize the database when the store is imported
if (browser) {
  initDB().then(() => {
    loadChats();
  });
}

// --- Derived Store for Public Interface ---
const chatHistoryStore = {
  subscribe: chatHistory.subscribe,
  isLoading: isLoading.subscribe,
  error: error.subscribe,
  saveChat,
  loadChats,
  loadChatById,
  deleteChat,
  updateChat,
  searchChats,
  exportChats,
  importChats
};

export default chatHistoryStore; 