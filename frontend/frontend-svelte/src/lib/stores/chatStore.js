import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import authStore from '$lib/stores/authStore.js';
import modelStore from '$lib/stores/modelStore.js';
import settingsStore from '$lib/stores/settingsStore.js';

// --- Configuration ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// --- Internal Writable Stores ---
const chatHistory = writable([]);
const isWaitingForResponse = writable(false);
const error = writable(null);
const metrics = writable({ /* Initial metrics structure */ });
const currentAbortController = writable(null); // To handle cancellations

// --- Helper Functions ---
const formatModelIdentifier = (model) => {
    if (!model || !model.provider || !model.id) return null;
    return `${model.provider}/${model.id}`;
};

const resetPerformanceMetrics = () => {
    metrics.set({
        startTime: Date.now(),
        tokenCount: 0,
        isComplete: false
    });
};

const startPerformanceTimer = () => {
    metrics.update(m => ({ ...m, startTime: Date.now() }));
};

const updatePerformanceMetrics = (tokenCount, isComplete = false) => {
    metrics.update(m => ({
        ...m,
        tokenCount,
        isComplete,
        endTime: isComplete ? Date.now() : m.endTime
    }));
};

const extractTokenCount = (data, content) => {
    // Simplified extraction logic
    return data?.usage?.completion_tokens || data?.usage?.total_tokens || Math.ceil((content?.split(/\s+/).length || 0) * 1.3);
};

// --- Error Handling ---
const handleError = (err, context = '') => {
    console.error(`[ChatStore] ${context} error:`, err);
    
    let errorMessage = 'An unexpected error occurred';
    let recoveryAction = null;

    if (err.name === 'AbortError') {
        errorMessage = 'Request was cancelled';
        recoveryAction = 'retry';
    } else if (err.message.includes('401') || err.message.includes('403')) {
        errorMessage = 'Authentication failed. Please log in again.';
        recoveryAction = 'reauthenticate';
    } else if (err.message.includes('429')) {
        errorMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
        recoveryAction = 'retry';
    } else if (err.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
        recoveryAction = 'retry';
    } else if (err.message.includes('network')) {
        errorMessage = 'Network error. Please check your connection.';
        recoveryAction = 'retry';
    }

    error.set({
        message: errorMessage,
        context,
        recoveryAction,
        timestamp: Date.now()
    });

    // Reset waiting state
    isWaitingForResponse.set(false);
    currentAbortController.set(null);
};

// --- Core Logic ---

// Add message function
const addMessage = (role, content, files = []) => {
    const message = { 
        role, 
        content, 
        timestamp: Date.now(), 
        id: crypto.randomUUID(),
        files 
    };
    chatHistory.update(history => [...history, message]);
    return message;
};

// Retry last message
const retryLastMessage = async () => {
    const history = get(chatHistory);
    if (history.length === 0) return;

    // Find the last user message
    const lastUserMessage = [...history].reverse().find(msg => msg.role === 'user');
    if (!lastUserMessage) return;

    // Remove all messages after the last user message
    chatHistory.update(h => h.slice(0, h.indexOf(lastUserMessage) + 1));

    // Clear any existing error
    error.set(null);

    // Retry sending the message
    if (lastUserMessage.files && lastUserMessage.files.length > 0) {
        await sendMessage({ text: lastUserMessage.content, files: lastUserMessage.files });
    } else {
        await sendMessage(lastUserMessage.content);
    }
};

// Cancel current request
const cancelRequest = () => {
    const controller = get(currentAbortController);
    if (controller) {
        controller.abort();
        currentAbortController.set(null);
        isWaitingForResponse.set(false);
        error.set(null);
    }
};

// Send message implementation (combines streaming/non-streaming)
const sendMessage = async (messageInput) => {
    // Handle both string and object inputs (for backward compatibility)
    let messageContent = '';
    let messageFiles = [];
    
    if (typeof messageInput === 'string') {
        messageContent = messageInput;
    } else if (typeof messageInput === 'object') {
        messageContent = messageInput.text || '';
        messageFiles = messageInput.files || [];
    }
    
    if (!browser || (!messageContent?.trim() && messageFiles.length === 0)) return;

    // Get current values from dependent stores
    const $auth = get(authStore);
    const $model = get(modelStore);
    const $settings = get(settingsStore);

    if (!$model.selectedModel) {
        handleError(new Error('No model selected'), 'model selection');
        return;
    }

    if (get(isWaitingForResponse)) {
        console.warn("[ChatStore] Attempted to send message while waiting for response.");
        return;
    }

    const modelId = formatModelIdentifier($model.selectedModel);
    if (!modelId) {
        handleError(new Error('Invalid model selection'), 'model format');
        return;
    }

    // Add user message with files if any
    const userMessage = addMessage('user', messageContent, messageFiles);

    // Reset state for new request
    isWaitingForResponse.set(true);
    error.set(null);
    resetPerformanceMetrics();
    startPerformanceTimer();

    // Handle file uploads if needed
    let fileDescriptions = [];
    if (messageFiles.length > 0) {
        try {
            // Process each file to create descriptions
            for (const file of messageFiles) {
                // For images, we'll actually handle them client-side
                if (file.type.startsWith('image/')) {
                    fileDescriptions.push(`[Attached image: ${file.name}]`);
                } else if (file.type === 'application/pdf') {
                    fileDescriptions.push(`[Attached PDF: ${file.name}]`);
                } else {
                    // For text files, we can extract content
                    if (file.type.startsWith('text/') || 
                        file.name.endsWith('.js') || 
                        file.name.endsWith('.ts') || 
                        file.name.endsWith('.json') ||
                        file.name.endsWith('.md') ||
                        file.name.endsWith('.css') ||
                        file.name.endsWith('.html')) {
                        
                        const text = await file.text();
                        const truncatedText = text.length > 1000 
                            ? text.substring(0, 1000) + '... [content truncated]' 
                            : text;
                            
                        fileDescriptions.push(`[File: ${file.name}]\n\`\`\`\n${truncatedText}\n\`\`\``);
                    } else {
                        fileDescriptions.push(`[Attached file: ${file.name}]`);
                    }
                }
            }
        } catch (err) {
            handleError(err, 'file processing');
            return;
        }
    }

    // Construct message content with file descriptions
    let fullMessageContent = messageContent;
    if (fileDescriptions.length > 0) {
        if (fullMessageContent) {
            fullMessageContent += '\n\n';
        }
        fullMessageContent += fileDescriptions.join('\n\n');
    }

    // Prepare payload
    const adjustedSettings = $settings.getModelAdjustedSettings($model.selectedModel);
    const historyForAPI = get(chatHistory)
        .filter(msg => !(msg.role === 'assistant' && !msg.content?.trim()))
        .map(msg => {
            // Don't send file data to API
            const { files, ...rest } = msg;
            return rest;
        });
        
    // Update the current message content
    historyForAPI[historyForAPI.length - 1].content = fullMessageContent;
    
    const payload = {
        model: modelId,
        messages: historyForAPI,
        temperature: adjustedSettings.temperature,
        max_tokens: adjustedSettings.max_tokens,
        top_p: adjustedSettings.top_p,
        frequency_penalty: adjustedSettings.frequency_penalty,
        presence_penalty: adjustedSettings.presence_penalty,
        stream: adjustedSettings.streaming
    };

    // Prepare headers
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if ($auth.idToken) {
        headers['Authorization'] = `Bearer ${$auth.idToken}`;
    }

    try {
        // Create abort controller for cancellation
        const controller = new AbortController();
        currentAbortController.set(controller);

        // Set up timeout
        const timeoutId = setTimeout(() => {
            controller.abort();
            error.set('Request timed out. Please try again.');
            isWaitingForResponse.set(false);
        }, 60000);

        // Add assistant message placeholder for streaming
        const assistantMessage = addMessage('assistant', '');
        let accumulatedContent = '';
        let tokenCount = 0;

        if (adjustedSettings.streaming) {
            // Streaming implementation
            headers['Accept'] = 'text/event-stream';
            const streamUrl = new URL('/api/chat/stream', API_BASE_URL).toString();
            
            const response = await fetch(streamUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));
                        if (data.content) {
                            accumulatedContent += data.content;
                            chatHistory.update(history => 
                                history.map(msg => 
                                    msg.id === assistantMessage.id 
                                        ? { ...msg, content: accumulatedContent }
                                        : msg
                                )
                            );
                        }
                        if (data.token_count) {
                            tokenCount = data.token_count;
                            updatePerformanceMetrics(tokenCount);
                        }
                    }
                }
            }
        } else {
            // Non-streaming implementation
            const completionsUrl = new URL('/api/chat/completions', API_BASE_URL).toString();
            const response = await fetch(completionsUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const content = data.content || '';
            
            chatHistory.update(history => 
                history.map(msg => 
                    msg.id === assistantMessage.id 
                        ? { ...msg, content }
                        : msg
                )
            );

            tokenCount = data.token_count || 0;
        }

        // Update final metrics
        updatePerformanceMetrics(tokenCount, true);
        clearTimeout(timeoutId);

    } catch (err) {
        handleError(err, 'message sending');
        
        // Remove the assistant message if it was empty
        chatHistory.update(history => 
            history.filter(msg => 
                msg.id !== assistantMessage.id || msg.content.trim() !== ''
            )
        );
    }
};

// --- Actions ---
const resetChat = () => {
    chatHistory.set([]);
    error.set(null);
    resetPerformanceMetrics();
     const controller = get(currentAbortController);
     if (controller) {
         controller.abort(); // Cancel ongoing request
         currentAbortController.set(null);
         isWaitingForResponse.set(false);
     }
};

const cancelStream = () => {
     const controller = get(currentAbortController);
     if (controller) {
         console.log("[ChatStore] Cancelling stream...");
         controller.abort();
         currentAbortController.set(null);
         isWaitingForResponse.set(false);
         // Reset metrics? Or leave them as they were at cancellation?
         // metrics.update(m => ({ ...m, isComplete: true })); // Mark as complete (cancelled)
     }
};

const downloadChatHistory = () => {
    if (!browser) return;
    const history = get(chatHistory);
    if (history.length === 0) {
        error.set('No chat history to download');
        return;
    }
    try {
        const historyJson = JSON.stringify(history, null, 2);
        const blob = new Blob([historyJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `chat-history-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    } catch (err) {
        console.error('Error downloading chat history:', err);
        error.set('Failed to download chat history');
    }
};

// --- Derived Store for Public Interface ---
const chatStore = derived(
    [chatHistory, isWaitingForResponse, error, metrics],
    ([$history, $waiting, $error, $metrics]) => ({
        chatHistory: $history,
        isWaitingForResponse: $waiting,
        error: $error,
        metrics: $metrics,

        // Actions
        sendMessage,
        retryLastMessage,
        cancelRequest,
        resetChat,
        cancelStream,
        downloadChatHistory
    })
);

export default chatStore; 