import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { useApi } from './ApiContext';
import { useModel } from './ModelContext';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';

// Create chat context
export const ChatContext = createContext();

// Custom hook for using chat context
export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

// Chat provider component
export const ChatProvider = ({ children }) => {
  const { apiUrl } = useApi();
  const { selectedModel } = useModel();
  const { settings, getModelAdjustedSettings } = useSettings();
  const { idToken } = useAuth();

  // State for chat - Initialize as empty
  const [chatHistory, setChatHistory] = useState([]);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [error, setError] = useState(null);

  // Performance metrics state - now stored per message
  const [currentMessageMetrics, setCurrentMessageMetrics] = useState({
    startTime: null,
    endTime: null,
    elapsedTime: null,
    tokenCount: null,
    tokensPerSecond: null,
    isComplete: false,
    timeToFirstToken: null
  });

  // Reference for streaming text content - used for direct DOM updates
  const streamingTextRef = useRef('');
  const streamBufferRef = useRef('');
  const updateTimeoutRef = useRef(null);
  const isStreamingRef = useRef(false);
  const currentRequestIdRef = useRef(null); // Track the current request ID for stopping
  const abortControllerRef = useRef(null); // Store abort controller for client-side aborting

  // Format model identifier for API
  const formatModelIdentifier = useCallback((model) => {
    if (!model || !model.provider || !model.id) {
      return null;
    }
    return `${model.provider}/${model.id}`;
  }, []);

  // Reset performance metrics
  const resetPerformanceMetrics = useCallback(() => {
    // console.log('Resetting performance metrics');
    setCurrentMessageMetrics({
      startTime: null,
      endTime: null,
      elapsedTime: null,
      tokenCount: null,
      tokensPerSecond: null,
      isComplete: false,
      timeToFirstToken: null
    });
  }, []);

  // Start performance timer
  const startPerformanceTimer = useCallback(() => {
    // console.log('Starting performance timer');
    setCurrentMessageMetrics(prev => ({
      ...prev,
      startTime: Date.now(),
      isComplete: false
    }));
  }, []);

  // Update performance metrics
  const updatePerformanceMetrics = useCallback((tokenCount, isComplete = false) => {
    // console.log('Updating performance metrics:', { tokenCount, isComplete });
    setCurrentMessageMetrics(prev => {
      const endTime = Date.now();
      const elapsedTime = endTime - (prev.startTime || endTime);

      // Calculate tokens per second if enough time has elapsed
      let tokensPerSecond = null;
      if (elapsedTime > 500 && tokenCount) {
        tokensPerSecond = Math.round((tokenCount / elapsedTime) * 1000);
      }

      // Only update token count if it's higher than the previous count
      const newTokenCount = tokenCount > (prev.tokenCount || 0) ? tokenCount : prev.tokenCount;

      // Calculate time to first token if we have tokens but haven't set it yet
      const timeToFirstToken = prev.timeToFirstToken ||
        (newTokenCount > 0 ? elapsedTime : null);

      const newMetrics = {
        startTime: prev.startTime,
        endTime,
        elapsedTime,
        tokenCount: newTokenCount,
        tokensPerSecond,
        isComplete,
        timeToFirstToken
      };

      // console.log('New metrics state:', newMetrics);

      // Update the last assistant message's metrics
      setChatHistory(prev => {
        const newHistory = [...prev];
        const lastMessage = newHistory[newHistory.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          lastMessage.metrics = { ...newMetrics };
        }
        return newHistory;
      });

      return newMetrics;
    });
  }, []);

  // Extract token count from response data
  const extractTokenCount = useCallback((data, content) => {
    // Try to get token count from response data
    if (data?.tokenUsage?.output) return data.tokenUsage.output;
    if (data?.tokenUsage?.total) return data.tokenUsage.total;
    if (data?.usage?.completion_tokens) return data.usage.completion_tokens;
    if (data?.usage?.total_tokens) return data.usage.total_tokens;

    // Fallback: estimate based on content length
    return Math.ceil((content.split(/\s+/).length) * 1.3);
  }, []);

  // Add message to chat history with metrics
  const addMessageToHistory = useCallback((role, content, metrics = null) => {
    setChatHistory(prev => {
      // Create message object with basic properties
      const newMessage = { 
        role, 
        content,
        timestamp: Date.now()
      };

      // Preserve uniqueId if it exists in the content object
      if (typeof content === 'object' && content !== null) {
        if (content.uniqueId) {
          newMessage.uniqueId = content.uniqueId;
        }
        // For array content with uniqueId
        if (Array.isArray(content) && content.length > 0 && content[0].uniqueId) {
          newMessage.uniqueId = content[0].uniqueId;
        }
      }
      
      // If no uniqueId was found, generate one
      if (!newMessage.uniqueId) {
        newMessage.uniqueId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }

      // If metrics are provided, add them to the message
      if (metrics) {
        newMessage.metrics = metrics;
      }
      // If this is an assistant message, always ensure metrics are attached
      else if (role === 'assistant') {
        // Use current metrics if available, otherwise create a new metrics object
        newMessage.metrics = currentMessageMetrics.tokenCount !== null
          ? { ...currentMessageMetrics }
          : {
            startTime: Date.now(),
            endTime: null,
            elapsedTime: null,
            tokenCount: null,
            tokensPerSecond: null,
            isComplete: false,
            timeToFirstToken: null
          };
      }

      // console.log('Adding message to history:', { role, content, metrics: newMessage.metrics });
      return [...prev, newMessage];
    });
    return { role, content, metrics };
  }, [currentMessageMetrics]);

  // Update chat history with new content and metrics
  const updateChatWithContent = useCallback((content) => {
    setChatHistory(prev => {
      const newHistory = [...prev];
      const lastMessage = newHistory[newHistory.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        // Ensure we always use the content parameter directly, never replacing already shown text
        lastMessage.content = content;
        // Always update metrics for assistant messages
        if (currentMessageMetrics.tokenCount !== null) {
          lastMessage.metrics = { ...currentMessageMetrics };
        }
      }
      return newHistory;
    });
  }, [currentMessageMetrics]);

  // Helper function to update placeholder on error
  const _updatePlaceholderOnError = useCallback(() => {
    setChatHistory(prev => {
      const newHistory = [...prev];
      const lastMessage = newHistory[newHistory.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        const existingContent = lastMessage.content;
        const errorSuffix = ' [Error occurred during generation]';
        
        // Only update if it doesn't already have error text
        if (!existingContent.includes(errorSuffix)) {
          const newContent = existingContent || 'Error occurred';
          lastMessage.content = existingContent ? `${newContent}${errorSuffix}` : 'Error occurred during generation';
          
          // Mark metrics complete
          if (lastMessage.metrics) {
            lastMessage.metrics.isComplete = true;
            lastMessage.metrics.error = true;
          }
        }
      }
      return newHistory;
    });
  }, []);

  // Stream a message using fetch streaming
  const streamMessageWithFetch = useCallback(async (message, editIndex = null) => {
    // Check if this is an edit request
    const isEditing = editIndex !== null && Number.isInteger(editIndex) && editIndex >= 0;

    if (!message || !selectedModel) {
      setError('Please enter a message and select a model');
      return null;
    }

    const modelId = formatModelIdentifier(selectedModel);
    if (!modelId) {
      setError('Invalid model selection');
      return null;
    }

    // Initialize vars
    let currentChatHistory;
    let userMessage;
    let timeoutId;
    
    // Abort controller for timeouts and manual stopping
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    currentRequestIdRef.current = null; // Reset request ID
    
    // Add user message to history (either normally or after truncation)
    if (isEditing) {
      // Truncate history up to the edit index and then add the new user message
      setChatHistory(prev => {
        // Slice history up to the edit point (inclusive)
        const truncatedHistory = prev.slice(0, editIndex);
        
        // Create the new user message
        userMessage = {
          role: 'user',
          content: message,
          timestamp: Date.now()
        };
        
        // Set for later use
        currentChatHistory = [...truncatedHistory];
        
        // Return the truncated history with the new message
        return [...truncatedHistory, userMessage];
      });
    } else {
      // Regular flow: just add the message to existing history
      userMessage = addMessageToHistory('user', message);
      currentChatHistory = [...chatHistory]; // Make a copy for the API payload
    }

    // Reset metrics and start timer
    resetPerformanceMetrics();
    startPerformanceTimer();

    // Set loading state
    setIsWaitingForResponse(true);
    setError(null);

    // Reset streaming text reference
    streamingTextRef.current = '';
    streamBufferRef.current = '';
    isStreamingRef.current = true;

    // Add a placeholder assistant message for UI immediately
    addMessageToHistory('assistant', '');

    // Create timeout to watch for stuck streams
    timeoutId = setTimeout(() => {
      console.log('No data received for 60 seconds, timing out');
      abortController.abort('timeout');
      setError('Connection timed out');
      setIsWaitingForResponse(false);
    }, 60000);

    // Initialize tracking variables for optimized updates
    let accumulatedContent = '';
    let accumulatedTokenCount = 0;
    let lastRenderTime = performance.now();

    try {
      // Get adjusted settings based on model
      const adjustedSettings = getModelAdjustedSettings(selectedModel);

      // Extract valid messages, removing metrics which aren't needed for the API
      const validMessages = currentChatHistory.map(msg => {
        const { metrics, ...messageWithoutMetrics } = msg;
        return messageWithoutMetrics;
      });

      // Then add the new user message (unstripped, if it has no metrics field it's fine)
      validMessages.push(userMessage);

      // Create the final payload
      const payload = {
        model: modelId,
        messages: validMessages,
        temperature: adjustedSettings.temperature,
        max_tokens: adjustedSettings.max_tokens,
        top_p: adjustedSettings.top_p,
        frequency_penalty: adjustedSettings.frequency_penalty,
        presence_penalty: adjustedSettings.presence_penalty
      };

      // Log payload before streaming request
      console.log(`[DEBUG] ${isEditing ? 'Editing' : 'Streaming'} request payload:`, payload);

      // Prepare optimized headers for streaming
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Requested-With': 'XMLHttpRequest'
      };

      // Add authorization header if idToken exists
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      // Construct URL for fetch API
      const streamUrl = new URL('/api/chat/stream', apiUrl).toString();

      console.log(`Starting optimized fetch streaming request to ${streamUrl}`);

      // Make the fetch request with appropriate settings for streaming
      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        signal: abortController.signal,
        cache: 'no-store',
        credentials: 'same-origin'
      });

      // Store the request ID from response headers if available
      if (response.headers.has('X-Request-ID')) {
        currentRequestIdRef.current = response.headers.get('X-Request-ID');
        console.log(`Received request ID: ${currentRequestIdRef.current}`);
      }

      if (!response.ok) {
        let errorMessage = `API error: ${response.status}`;
        let errorData = null; // Variable to hold the parsed error data
        try {
          errorData = await response.json();
          // Log the full error object received from the server
          console.error('Server Error Response:', errorData);
          // Extract message, fallback to status code if no structured error message
          errorMessage = errorData?.error?.message || errorData?.message || `API error: ${response.status}`;
        } catch (e) {
          console.warn('Could not parse error response as JSON:', e);
          // Use default error message if parsing fails
        }
        throw new Error(errorMessage);
      }

      // Get the response body as a stream with optimized settings
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      // Variables for optimized chunk processing
      let buffer = '';
      let processingChunk = false;
      let lastRawChunkReceived = null; // Variable to store the last raw chunk

      // Begin reading the stream
      while (true) {
        const { done, value } = await reader.read();

        // Reset timeout on each chunk
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          console.log('No data received for 60 seconds, timing out');
          abortController.abort();
          setError('Connection timed out');
          setIsWaitingForResponse(false);
        }, 60000);

        if (done) {
          // Stream is complete
          console.log('Stream complete');
          if (lastRawChunkReceived) {
             console.log('[CLIENT LAST RAW CHUNK RECV]', lastRawChunkReceived);
          }
          // Process any remaining data in the buffer before breaking
          if (buffer.trim()) { // Check if buffer has content
              console.log('[DEBUG] Processing remaining buffer content after stream done:', buffer);
              console.log(`[FRONTEND RECV RAW - FINAL] Char count: ${buffer.length}`);
              // Reuse the message processing logic
              const messages = buffer.split('\n\n');
              // Don't need to save the last part now, process everything
              for (const message of messages) {
                  if (!message.trim()) continue;

                  if (message.startsWith(':heartbeat')) {
                      // Ignore heartbeats in final processing
                      continue;
                  }

                  if (message.startsWith('data:')) {
                      const data = message.slice(5).trim();

                      if (data === '[DONE]') {
                          console.log('Received [DONE] message from final buffer processing');
                          // Ensure metrics are marked as complete if DONE is found here
                          updatePerformanceMetrics(accumulatedTokenCount, true);
                          continue; // Skip further processing for [DONE]
                      }

                      try {
                          const parsedData = JSON.parse(data);
                          const content = parsedData.content || '';
                          if (content) {
                              accumulatedContent += content;
                              const chunkTokenCount = content.split(/\s+/).length || 0; // Basic token estimate
                              accumulatedTokenCount += chunkTokenCount;
                              streamingTextRef.current = accumulatedContent;
                              // Update metrics immediately for final content, but don't mark as complete yet
                              updatePerformanceMetrics(accumulatedTokenCount, false);
                          }
                      } catch (parseError) {
                          console.warn('Error parsing final message data:', parseError, data);
                      }
                  }
              }
          }
          break; // Now break the loop
        }

        // Decode the chunk
        const chunk = decoder.decode(value, { stream: true });
        lastRawChunkReceived = chunk; // Store the latest raw chunk received
        console.log(`[FRONTEND RECV RAW] Char count: ${chunk.length}`);
        buffer += chunk;

        // Process all complete SSE messages in the buffer
        if (!processingChunk) {
          processingChunk = true;

          const messages = buffer.split('\n\n');
          buffer = messages.pop() || ''; // Keep incomplete message for next chunk

          for (const message of messages) {
            if (!message.trim()) continue;

            if (message.startsWith(':heartbeat')) {
              console.log('Received heartbeat');
              continue;
            }

            if (message.startsWith('event: abort')) {
              console.log('Received abort event');
              // Mark the generation as stopped by the user
              updateChatWithContent(accumulatedContent + ' [Stopped]');
              updatePerformanceMetrics(accumulatedTokenCount, true);
              break;
            }

            if (message.startsWith('event: error')) {
              console.log('Received error event');
              try {
                const data = message.split('\n')[1]?.slice(5); // Extract data part after event line
                if (data) {
                  const errorData = JSON.parse(data);
                  setError(errorData.message || 'Server error');
                  _updatePlaceholderOnError();
                }
              } catch (e) {
                console.warn('Error parsing error event:', e);
                setError('Server error');
                _updatePlaceholderOnError();
              }
              break;
            }

            if (message.startsWith('data:')) {
              const data = message.slice(5).trim();

              if (data === '[DONE]') {
                console.log('Received [DONE] message from stream');
                // Mark as complete when DONE is received normally
                updatePerformanceMetrics(accumulatedTokenCount, true);
                continue; // Skip further processing for [DONE]
              }

              try {
                const parsedData = JSON.parse(data);
                const content = parsedData.content || '';
                console.log(`[FRONTEND PROC] Content char count: ${content.length}`);
                if (content) {
                  // Add to accumulated content
                  accumulatedContent += content;

                  // Update token count for this chunk and accumulate
                  const chunkTokenCount = content.split(/\s+/).length || 0; // Basic token estimate
                  accumulatedTokenCount += chunkTokenCount;

                  // Update the streaming text ref
                  streamingTextRef.current = accumulatedContent;

                  // Optimize UI updates - always render immediately for each chunk when received
                  // instead of throttling based on timing to ensure all text is visible
                  const currentContent = accumulatedContent;
                  const currentTokenCount = accumulatedTokenCount;
                  window.requestAnimationFrame(() => {
                    updateChatWithContent(currentContent);
                    // Update metrics but don't mark as complete here
                    updatePerformanceMetrics(currentTokenCount, false);
                  });
                  lastRenderTime = performance.now();
                }
              } catch (parseError) {
                console.warn('Error parsing message data:', parseError, data);
              }
            }
          }

          processingChunk = false;
        }
      } // End of while loop

      // Ensure final update after loop completes
      if (updateTimeoutRef.current) { // Clear any pending throttled update
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
      
      // Always update with the final accumulated content from the ref
      // This ensures we render all content received, even if it wasn't rendered during streaming
      const finalContent = streamingTextRef.current;
      updateChatWithContent(finalContent);


      // Finalize metrics
      updatePerformanceMetrics(accumulatedTokenCount, true);
      console.log('Stream completed, finalizing metrics');

      // Handle empty response after streaming finishes
      // This check should run *after* the unconditional final update
      if (!streamingTextRef.current.trim()) { // Check the ref directly now
        const emptyMessageContent = 'No Response returned';
        updateChatWithContent(emptyMessageContent); // Update history with the placeholder
      }

      // Return the final content from the ref
      return streamingTextRef.current;

    } catch (error) {
      console.error('Error in fetch streaming:', error);
      // Check if this was an abort initiated by stopGeneration
      if (error.name === 'AbortError' && error.message !== 'timeout') {
        // If aborted by the user (not by timeout), add a stopped indicator
        updateChatWithContent(streamingTextRef.current + ' [Stopped]');
        updatePerformanceMetrics(accumulatedTokenCount, true);
      } else {
        // Other errors
        setError(error.message || 'An error occurred during streaming');
        // Update the placeholder message to indicate error
        _updatePlaceholderOnError(); // Use the helper function
      }
      return null;
    } finally {
      // Ensure loading state is always reset
      clearTimeout(timeoutId); // Also clear timeout here
      isStreamingRef.current = false;
      setIsWaitingForResponse(false);
      // Clear request ID and abort controller
      if (currentRequestIdRef.current === null) {
        abortControllerRef.current = null;
      }
    }
  }, [
    apiUrl, selectedModel, chatHistory, getModelAdjustedSettings,
    addMessageToHistory, formatModelIdentifier, resetPerformanceMetrics,
    startPerformanceTimer, updatePerformanceMetrics,
    setError, setIsWaitingForResponse, updateChatWithContent,
    idToken, _updatePlaceholderOnError, currentMessageMetrics
  ]);

  // Send message to API - decide between streaming and non-streaming
  const sendMessage = useCallback(async (message, editIndex = null) => {
    // Check if this is an edit request
    const isEditing = editIndex !== null && Number.isInteger(editIndex) && editIndex >= 0;
    
    // Use streaming if enabled in settings
    if (settings.streaming) {
      return streamMessageWithFetch(message, isEditing ? editIndex : null);
    }

    if (!message || !selectedModel) {
      setError('Please enter a message and select a model');
      return null;
    }

    const modelId = formatModelIdentifier(selectedModel);
    if (!modelId) {
      setError('Invalid model selection');
      return null;
    }

    // Add user message to history (either normally or after truncation)
    let userMessage;
    
    if (isEditing) {
      // Truncate history up to the edit index and then add the new user message
      setChatHistory(prev => {
        // Slice history up to the edit point (inclusive)
        const truncatedHistory = prev.slice(0, editIndex);
        
        // Create the new user message
        userMessage = {
          role: 'user',
          content: message,
          timestamp: Date.now()
        };
        
        // Return the truncated history with the new message
        return [...truncatedHistory, userMessage];
      });
    } else {
      // Regular flow: just add the message to existing history
      userMessage = addMessageToHistory('user', message);
    }

    // Capture the exact request start time
    const requestStartTime = Date.now();

    // Set loading state
    setIsWaitingForResponse(true);
    setError(null);

    // Remove the placeholder message creation for non-streaming
    // We'll create only one message after we get the response

    try {
      // Get adjusted settings based on model
      const adjustedSettings = getModelAdjustedSettings(selectedModel);

      // Prepare request headers conditionally
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Add authorization header if idToken exists
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      // Get the current chat history (after possible truncation)
      const currentHistory = chatHistory.map(msg => {
        const { metrics, ...messageWithoutMetrics } = msg;
        return messageWithoutMetrics;
      });

      // Add the user message at the end if we're in an edit case
      if (isEditing) {
        // Use the userMessage created during truncation
        const { metrics, ...userMessageWithoutMetrics } = userMessage;
        currentHistory.push(userMessageWithoutMetrics);
      }

      // Prepare request payload with potentially truncated history
      const payload = {
        model: modelId,
        messages: isEditing 
          ? currentHistory // Use the potentially truncated history from above
          : [...chatHistory, userMessage].map(msg => { // Use standard approach for non-edit
              const { metrics, ...messageWithoutMetrics } = msg;
              return messageWithoutMetrics;
            }),
        temperature: adjustedSettings.temperature,
        max_tokens: adjustedSettings.max_tokens,
        top_p: adjustedSettings.top_p,
        frequency_penalty: adjustedSettings.frequency_penalty,
        presence_penalty: adjustedSettings.presence_penalty
      };

      // Log payload before non-streaming request
      console.log(`[DEBUG] ${isEditing ? 'Editing' : 'Non-streaming'} request payload:`, payload);

      // Construct URL safely
      const completionsUrl = new URL('/api/chat/completions', apiUrl).toString();
      const response = await fetch(completionsUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = `API error: ${response.status}`;
        let errorData = null; // Variable to hold the parsed error data
        try {
          errorData = await response.json();
          // Log the full error object received from the server
          console.error('Server Error Response:', errorData);
          // Extract message, fallback to status code if no structured error message
          errorMessage = errorData?.error?.message || errorData?.message || `API error: ${response.status}`;
        } catch (e) {
          console.warn('Could not parse error response as JSON:', e);
          // Use default error message if parsing fails
        }
        throw new Error(errorMessage);
      }

      // Parse response
      const data = await response.json();
      // console.log('[DEBUG] Received non-streamed message:', data);
      // Handle empty response and set placeholder if necessary
      const content = data.content || 'No Response returned';

      // Calculate token count for metrics
      const tokenCount = extractTokenCount(data, content);
      
      // Calculate the response time (request end time - request start time)
      const requestEndTime = Date.now();
      const responseTime = requestEndTime - requestStartTime;
      
      // Create simple metrics based on actual request timing
      const finalMetrics = {
        startTime: requestStartTime,
        endTime: requestEndTime,
        elapsedTime: responseTime,
        tokenCount: tokenCount,
        tokensPerSecond: tokenCount / (responseTime / 1000),
        isComplete: true,
        timeToFirstToken: null // Not applicable for non-streaming
      };

      // Add AI response directly with complete metrics (without placeholder)
      addMessageToHistory('assistant', content, finalMetrics);

      return content;
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error.message);
      // Create an error message directly instead of updating a placeholder
      addMessageToHistory('error', error.message || 'An error occurred during processing');
      return null;
    } finally {
      setIsWaitingForResponse(false);
    }
  }, [
    apiUrl, selectedModel, chatHistory, settings, getModelAdjustedSettings,
    addMessageToHistory, formatModelIdentifier, resetPerformanceMetrics,
    startPerformanceTimer, updatePerformanceMetrics, extractTokenCount,
    setError, setIsWaitingForResponse, streamMessageWithFetch,
    idToken, currentMessageMetrics
  ]);

  // Stop the current generation
  const stopGeneration = useCallback(async () => {
    console.log('Attempting to stop generation');
    
    // First try client-side abortion if we have an active abort controller
    if (abortControllerRef.current) {
      console.log('Using client-side abort');
      abortControllerRef.current.abort('user_stopped');
      // Don't clear the abort controller here, let the API request complete first
    }
    
    // If we have a request ID, also notify the server
    if (currentRequestIdRef.current) {
      try {
        console.log(`Sending stop request to server for requestId: ${currentRequestIdRef.current}`);
        
        const headers = {
          'Content-Type': 'application/json'
        };
        
        // Add authorization header if idToken exists
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
        }
        
        const stopUrl = new URL('/api/chat/stop', apiUrl).toString();
        const response = await fetch(stopUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ requestId: currentRequestIdRef.current }),
        });
        
        if (!response.ok) {
          // Log error but don't throw - we already did client-side abort
          const errorData = await response.json().catch(() => ({}));
          console.warn('Error stopping generation on server:', errorData);
        } else {
          const result = await response.json();
          console.log('Stop response from server:', result);
        }
      } catch (error) {
        console.error('Error sending stop request to server:', error);
        // Don't throw since we already did client-side abort
      } finally {
        // Clear the request ID after attempting to stop
        currentRequestIdRef.current = null;
        abortControllerRef.current = null;
      }
    } else {
      console.log('No active request ID to stop on server');
      // Clear abort controller if no request ID
      abortControllerRef.current = null;
    }
    
    // Return true to indicate we attempted to stop
    return true;
  }, [apiUrl, idToken]);

  // Get or create conversation: simple function that gets an existing conversation by ID
  // or creates a new one if the ID doesn't exist
  const getOrCreateConversation = useCallback((conversationId) => {
    // Implementation...
  }, [/* dependencies */]);

  // Clear chat history
  const clearChat = useCallback(() => {
    setChatHistory([]);
    resetPerformanceMetrics();
  }, [resetPerformanceMetrics]);

  // Download chat history as text
  const downloadChatHistory = useCallback(() => {
    if (chatHistory.length === 0) return;
    
    // Format the chat history into a readable text format
    const formattedChat = chatHistory.map(msg => {
      const role = msg.role === 'user' ? 'You' : 
                 msg.role === 'assistant' ? (selectedModel?.name || 'Assistant') : 
                 msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
      
      const content = typeof msg.content === 'string' ? msg.content :
                      Array.isArray(msg.content) ? 
                        msg.content.map(part => part.type === 'text' ? part.text : '[Image]').join(' ') :
                        'Content unavailable';
                        
      return `${role}: ${content}\n`;
    }).join('\n');
    
    // Create a blob with the chat text
    const blob = new Blob([formattedChat], { type: 'text/plain' });
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Create a link element to trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${new Date().toISOString().replace(/:/g, '-')}.txt`;
    
    // Append link to body, click it, then remove it
    document.body.appendChild(a);
    a.click();
    
    // Clean up by removing the link and revoking the URL
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }, [chatHistory, selectedModel?.name]);

  // Export context value - memoized to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    chatHistory,
    isWaitingForResponse,
    error,
    currentMessageMetrics,
    sendMessage,
    submitMessage: sendMessage, // Add alias for backward compatibility
    stopGeneration,
    addMessageToHistory,
    clearChat,
    resetChat: clearChat, // Add resetChat as an alias for clearChat
    getOrCreateConversation,
    streamingTextRef,
    isStreaming: isStreamingRef.current,
    downloadChatHistory,
  }), [
    chatHistory,
    isWaitingForResponse,
    error,
    currentMessageMetrics,
    sendMessage,
    stopGeneration,
    addMessageToHistory,
    clearChat,
    getOrCreateConversation, 
    // No need to include streamingTextRef itself, it's just a ref object
    isStreamingRef.current,
    downloadChatHistory,
  ]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}; 