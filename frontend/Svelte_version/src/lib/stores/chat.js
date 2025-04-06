import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { apiStore, effectiveApiSettings } from './api';
import { selectedModel } from './models';
import { settings } from './settings';
import { user, effectiveUser, isAuthenticated, isAnonymousMode } from './auth';

// Message type definitions
export const MessageRoles = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
  ERROR: 'error'
};

// Create a unique ID for messages
const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// Initial chat state
const initialState = {
  messages: [],
  conversations: [],
  currentConversationId: null,
  isStreaming: false,
  abortController: null,
  error: null
};

// Create the chat store
function createChatStore() {
  // Load chat state from localStorage if available
  let savedState = initialState;
  
  if (browser) {
    try {
      const savedChat = localStorage.getItem('chatState');
      if (savedChat) {
        const parsed = JSON.parse(savedChat);
        savedState = {
          ...initialState,
          messages: parsed.messages || [],
          conversations: parsed.conversations || [],
          currentConversationId: parsed.currentConversationId || null
        };
      }
    } catch (error) {
      console.error('Error loading chat state from localStorage:', error);
    }
  }
  
  const { subscribe, set, update } = writable(savedState);
  
  // Helper to save state to localStorage
  const saveState = (state) => {
    if (browser) {
      try {
        // Only save persistent data, not temporary state
        const stateToSave = {
          messages: state.messages,
          conversations: state.conversations,
          currentConversationId: state.currentConversationId
        };
        localStorage.setItem('chatState', JSON.stringify(stateToSave));
      } catch (error) {
        console.error('Error saving chat state to localStorage:', error);
      }
    }
  };
  
  // API call to get chat completion
  const getChatCompletion = async (messages, isStreaming = false) => {
    const apiSettings = get(effectiveApiSettings);
    const model = get(selectedModel);
    const userSettings = get(settings);
    const isAnon = get(isAnonymousMode);
    const currentUser = get(effectiveUser);
    
    // Create abort controller for request cancellation
    const abortController = new AbortController();
    
    update(state => ({
      ...state,
      isStreaming: isStreaming,
      abortController: abortController,
      error: null
    }));
    
    apiStore.setLoading(true);
    apiStore.clearError();
    
    try {
      // Prepare headers - always include auth token regardless of anonymous mode
      // This allows the backend to decide how to handle anonymous users
      const headers = {
        'Content-Type': 'application/json',
        ...apiSettings.customHeaders
      };
      
      // If we have a user (real or anonymous), add token/auth info
      if (currentUser) {
        // For real users, we'd have a real token
        // For anonymous users, we include a flag to inform the backend
        if (isAnon && currentUser.isAnonymous) {
          headers['X-Anonymous-Mode'] = 'true';
          headers['X-Anonymous-ID'] = currentUser.uid;
        }
        
        // Always include token if available (for authenticated sessions)
        // Backend can use this to determine if user is really authenticated
        if (apiSettings.authToken) {
          headers['Authorization'] = `Bearer ${apiSettings.authToken}`;
        }
      }
      
      const response = await fetch(apiSettings.endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages,
          model: model.id,
          temperature: apiSettings.temperature,
          max_tokens: apiSettings.maxTokens,
          stream: isStreaming,
          response_format: userSettings.apiResponseFormat === 'markdown' ? { type: 'text' } : undefined,
          // Include user info for the backend to identify the session
          user_id: currentUser?.uid || 'anonymous',
          is_anonymous: isAnon
        }),
        signal: abortController.signal
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }
      
      // Handle streaming response
      if (isStreaming) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        
        // Create a placeholder message for the streaming response
        const assistantMessageId = generateId();
        update(state => {
          const newMessages = [...state.messages, {
            id: assistantMessageId,
            role: MessageRoles.ASSISTANT,
            content: '',
            timestamp: Date.now(),
            isComplete: false
          }];
          
          const newState = {
            ...state, 
            messages: newMessages,
            isStreaming: true
          };
          
          saveState(newState);
          return newState;
        });
        
        // Process the stream
        let accumulatedContent = '';
        let done = false;
        
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          
          // Process chunk (in a real implementation, you'd parse the SSE format properly)
          // This is a simplified version
          try {
            // Split by lines and look for data: prefix
            const lines = chunk.split('\\n');
            let newContent = '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.substring(6);
                if (data === '[DONE]') break;
                
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content || '';
                  if (content) {
                    newContent += content;
                  }
                } catch (e) {
                  console.error('Error parsing chunk:', e);
                }
              }
            }
            
            if (newContent) {
              accumulatedContent += newContent;
              
              // Update the streaming message content
              update(state => {
                const newMessages = state.messages.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: accumulatedContent }
                    : msg
                );
                
                const newState = { ...state, messages: newMessages };
                saveState(newState);
                return newState;
              });
            }
          } catch (e) {
            console.error('Error processing chunk:', e);
          }
        }
        
        // Mark the message as complete
        update(state => {
          const newMessages = state.messages.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, isComplete: true }
              : msg
          );
          
          const newState = {
            ...state,
            messages: newMessages,
            isStreaming: false,
            abortController: null
          };
          
          saveState(newState);
          return newState;
        });
      }
      // Handle non-streaming response
      else {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        
        update(state => {
          const newMessages = [
            ...state.messages,
            {
              id: generateId(),
              role: MessageRoles.ASSISTANT,
              content,
              timestamp: Date.now(),
              isComplete: true
            }
          ];
          
          const newState = {
            ...state,
            messages: newMessages,
            isStreaming: false,
            abortController: null
          };
          
          saveState(newState);
          return newState;
        });
      }
    } catch (error) {
      // Handle errors, but ignore aborted requests
      if (error.name !== 'AbortError') {
        console.error('Chat API error:', error);
        
        update(state => {
          const errorMessage = {
            id: generateId(),
            role: MessageRoles.ERROR,
            content: error.message || 'An error occurred during the request.',
            timestamp: Date.now()
          };
          
          const newState = {
            ...state,
            messages: [...state.messages, errorMessage],
            error: error.message,
            isStreaming: false,
            abortController: null
          };
          
          saveState(newState);
          return newState;
        });
        
        apiStore.setError(error);
      }
    } finally {
      apiStore.setLoading(false);
    }
  };
  
  return {
    subscribe,
    
    // Send a user message
    sendMessage: async (content) => {
      if (!content.trim()) return;
      
      const userData = get(user);
      const useStreaming = get(settings).streamingEnabled && get(apiStore).useStreamingApi;
      
      // Add user message to the chat
      update(state => {
        const newUserMessage = {
          id: generateId(),
          role: MessageRoles.USER,
          content,
          timestamp: Date.now(),
          user: userData ? {
            uid: userData.uid,
            displayName: userData.displayName
          } : undefined
        };
        
        const newMessages = [...state.messages, newUserMessage];
        
        const newState = {
          ...state,
          messages: newMessages,
          error: null
        };
        
        saveState(newState);
        return newState;
      });
      
      // Get current messages to send to API
      const currentState = get({ subscribe });
      const messagesToSend = currentState.messages.map(({ role, content }) => ({
        role,
        content
      }));
      
      // Add system prompt if configured
      const systemPrompt = get(apiStore).systemPrompt;
      if (systemPrompt) {
        messagesToSend.unshift({
          role: MessageRoles.SYSTEM,
          content: systemPrompt
        });
      }
      
      // Call API with messages
      await getChatCompletion(messagesToSend, useStreaming);
    },
    
    // Stop the streaming response
    stopStreaming: () => {
      update(state => {
        if (state.abortController) {
          state.abortController.abort();
        }
        
        return {
          ...state,
          isStreaming: false,
          abortController: null
        };
      });
    },
    
    // Clear the chat history
    clearChat: () => {
      update(state => {
        const newState = {
          ...state,
          messages: [],
          error: null,
          isStreaming: false
        };
        
        if (state.abortController) {
          state.abortController.abort();
        }
        
        saveState(newState);
        return newState;
      });
    },
    
    // Create a new conversation
    createConversation: (title = 'New Conversation') => {
      const conversationId = `conv_${Date.now()}`;
      
      update(state => {
        // First save the current conversation if it exists
        let updatedConversations = [...state.conversations];
        
        if (state.currentConversationId && state.messages.length > 0) {
          const existingIndex = updatedConversations.findIndex(
            c => c.id === state.currentConversationId
          );
          
          if (existingIndex >= 0) {
            updatedConversations[existingIndex] = {
              ...updatedConversations[existingIndex],
              messages: state.messages,
              updatedAt: Date.now()
            };
          } else {
            updatedConversations.push({
              id: state.currentConversationId,
              title: 'Untitled Conversation',
              messages: state.messages,
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
          }
        }
        
        // Then create the new conversation
        updatedConversations.push({
          id: conversationId,
          title,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        
        const newState = {
          ...state,
          messages: [],
          conversations: updatedConversations,
          currentConversationId: conversationId,
          error: null,
          isStreaming: false
        };
        
        if (state.abortController) {
          state.abortController.abort();
        }
        
        saveState(newState);
        return newState;
      });
      
      return conversationId;
    },
    
    // Load a conversation
    loadConversation: (conversationId) => {
      update(state => {
        // First save the current conversation if it exists
        let updatedConversations = [...state.conversations];
        
        if (state.currentConversationId && state.messages.length > 0) {
          const existingIndex = updatedConversations.findIndex(
            c => c.id === state.currentConversationId
          );
          
          if (existingIndex >= 0) {
            updatedConversations[existingIndex] = {
              ...updatedConversations[existingIndex],
              messages: state.messages,
              updatedAt: Date.now()
            };
          }
        }
        
        // Find the conversation to load
        const conversation = updatedConversations.find(c => c.id === conversationId);
        
        if (!conversation) {
          return {
            ...state,
            error: `Conversation with ID ${conversationId} not found`
          };
        }
        
        const newState = {
          ...state,
          messages: conversation.messages,
          conversations: updatedConversations,
          currentConversationId: conversationId,
          error: null,
          isStreaming: false
        };
        
        if (state.abortController) {
          state.abortController.abort();
        }
        
        saveState(newState);
        return newState;
      });
    },
    
    // Delete a conversation
    deleteConversation: (conversationId) => {
      update(state => {
        const updatedConversations = state.conversations.filter(
          c => c.id !== conversationId
        );
        
        let newMessages = state.messages;
        let newCurrentId = state.currentConversationId;
        
        // If we're deleting the current conversation, clear the messages
        if (conversationId === state.currentConversationId) {
          newMessages = [];
          newCurrentId = null;
        }
        
        const newState = {
          ...state,
          messages: newMessages,
          conversations: updatedConversations,
          currentConversationId: newCurrentId
        };
        
        saveState(newState);
        return newState;
      });
    },
    
    // Add a system message
    addSystemMessage: (content) => {
      update(state => {
        const systemMessage = {
          id: generateId(),
          role: MessageRoles.SYSTEM,
          content,
          timestamp: Date.now()
        };
        
        const newState = {
          ...state,
          messages: [...state.messages, systemMessage]
        };
        
        saveState(newState);
        return newState;
      });
    },
    
    // Set error state
    setError: (error) => {
      update(state => ({
        ...state,
        error: typeof error === 'string' ? error : error.message
      }));
    },
    
    // Clear error state
    clearError: () => {
      update(state => ({ ...state, error: null }));
    },
    
    // Update title of current conversation
    updateConversationTitle: (conversationId, title) => {
      update(state => {
        const updatedConversations = state.conversations.map(conv => 
          conv.id === conversationId
            ? { ...conv, title, updatedAt: Date.now() }
            : conv
        );
        
        const newState = {
          ...state,
          conversations: updatedConversations
        };
        
        saveState(newState);
        return newState;
      });
    }
  };
}

// Create and export the chat store
export const chatStore = createChatStore();

// Derived store for current conversation
export const currentConversation = derived(
  chatStore,
  $chatStore => {
    if (!$chatStore.currentConversationId) return null;
    
    return $chatStore.conversations.find(
      conv => conv.id === $chatStore.currentConversationId
    );
  }
);

// Derived store for sorted conversations (newest first)
export const sortedConversations = derived(
  chatStore,
  $chatStore => {
    return [...$chatStore.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  }
);