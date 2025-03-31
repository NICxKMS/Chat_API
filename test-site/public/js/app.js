/**
 * Chat API Demo - Client Application
 * Provides a user interface for testing the Chat API
 */

// API Configuration
const API_CONFIG = {
  BASE_URL: new URLSearchParams(window.location.search).get('api_url') || '/api',
  STATUS_ENDPOINT: '/status',
  MODELS_ENDPOINT: '/models',
  MODELS_CATEGORIES_ENDPOINT: '/models/categories',
  MODELS_CLASSIFIED_ENDPOINT: '/models/classified',
  CHAT_COMPLETIONS_ENDPOINT: '/chat/completions',
  PROVIDERS_ENDPOINT: '/models/providers'
};

// DOM Elements
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const resetButton = document.getElementById('reset-button');
const messagesContainer = document.getElementById('chat-messages');
const modelContainer = document.getElementById('model-dropdown-container');
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const sidebar = document.getElementById('sidebar');
const apiStatus = document.getElementById('api-status');
const apiUrl = document.getElementById('api-url');
const sidebarToggle = document.getElementById('sidebar-toggle');
const performanceInfo = document.getElementById('performance-info');
const downloadButton = document.getElementById('download-chat');
const temperatureSlider = document.getElementById('temperature');
const temperatureValue = document.getElementById('temperature-value');
const maxTokensInput = document.getElementById('max_tokens');

// Global state
let chatHistory = [];
let selectedModel = null;
let modelDropdown = null;
let apiStatusInterval = null;
let modelLoadedSuccessfully = false;
let startTime = 0;
let tokenCount = 0;
let typingTimeout = null;

// Various settings
const DEFAULT_SETTINGS = {
  temperature: 0.7,
  top_p: 1,
  max_tokens: 800,
  frequency_penalty: 0,
  presence_penalty: 0,
  stream: true
};

let settings = { ...DEFAULT_SETTINGS };

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);

/**
 * Initialize the application
 */
async function initialize() {
  console.log('Initializing app...');
  
  // Set API URL display
  apiUrl.innerText = API_CONFIG.BASE_URL;
  
  // Set up event listeners
  attachEventListeners();
  
  // Check API status immediately and then every 30 seconds
  await checkApiStatus();
  apiStatusInterval = setInterval(checkApiStatus, 30000);
  
  // Initialize model dropdown
  await initializeModelDropdown();
  
  // Initialize sidebar state based on screen size
  checkWindowSizeForSidebar();
  window.addEventListener('resize', checkWindowSizeForSidebar);
  
  // Focus on chat input
  chatInput.focus();
}

/**
 * Initialize the model dropdown component
 */
async function initializeModelDropdown() {
  console.log('Initializing model dropdown...');
  
  try {
    // Get the experimental toggle element if it exists
    const experimentalToggleElement = document.getElementById('show-experimental');
    
    // Initialize the ModelDropdown component
    modelDropdown = new ModelDropdown({
      container: modelContainer,
      includeExperimentalToggle: experimentalToggleElement || true,
      showExperimentalByDefault: false,
      includeEmbeddings: false,
      onChange: handleModelSelect
    });
    
    const success = await modelDropdown.initialize();
    
    if (success) {
      console.log('Model dropdown initialized successfully');
      
      // Get the default model, if any
      const selectedModelData = modelDropdown.getSelectedModel();
      
      if (selectedModelData) {
        console.log('Default model selected:', selectedModelData);
        selectedModel = selectedModelData;
        document.getElementById('selected-model-display').innerText = selectedModelData.displayName || selectedModelData.name;
        modelLoadedSuccessfully = true;
        
        // Enable send button if there's text in the chat input
        if (sendButton && chatInput && chatInput.value.trim()) {
          sendButton.disabled = false;
        }
      } else {
        console.warn('No model automatically selected');
      }
    } else {
      console.error('Failed to initialize model dropdown');
      modelContainer.innerHTML = `
        <div class="error-message">
          <p>Failed to load models</p>
          <p>Could not connect to API. Please check your connection and try again.</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Failed to initialize model dropdown:', error);
    modelContainer.innerHTML = `
      <div class="error-message">
        <p>Failed to load models</p>
        <p>${error.message}</p>
      </div>
    `;
  }
}

/**
 * Attach event listeners to various UI elements
 */
function attachEventListeners() {
  // Chat input submission
  chatInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUserMessage();
    }
  });
  
  sendButton.addEventListener('click', handleUserMessage);
  resetButton.addEventListener('click', resetChat);
  
  // Settings panel toggle
  settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });
  
  // Sidebar toggle for mobile
  sidebarToggle.addEventListener('click', () => {
    if (window.innerWidth < 1024) {
      sidebar.classList.toggle('active');
      document.getElementById('overlay').classList.toggle('active');
    }
  });
  
  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  // Download chat history
  downloadButton.addEventListener('click', downloadChatHistory);
  
  // Setting input changes
  document.querySelectorAll('.settings-input').forEach(input => {
    input.addEventListener('change', updateSettings);
  });
  
  // Initialize settings inputs from defaults
  Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => {
    const input = document.getElementById(key);
    if (input) {
      input.value = value;
    }
  });
  
  // Initialize temperature value display
  if (temperatureSlider && temperatureValue) {
    temperatureValue.textContent = temperatureSlider.value;
    temperatureSlider.addEventListener('input', function() {
      temperatureValue.textContent = this.value;
    });
  }
}

// Check API Status
async function checkApiStatus() {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.STATUS_ENDPOINT}`);
    const data = await response.json();
    
    if (data.status === 'ok') {
      apiStatus.textContent = 'Connected';
      apiStatus.classList.add('online');
      apiStatus.classList.remove('offline');
      return true;
    } else {
      throw new Error('API not ready');
    }
  } catch (error) {
    apiStatus.textContent = 'Disconnected';
    apiStatus.classList.remove('online');
    apiStatus.classList.add('offline');
    console.error('API Status Error:', error);
    throw new Error('Unable to connect to API');
  }
}

// Append a message to the chat
function appendMessage(role, content, isTyping = false) {
  if (!messagesContainer) {
    console.error('Cannot append message: chat messages container is null');
    return null;
  }
  
  // Log what we're appending
  console.debug(`Appending message as ${role}${isTyping ? ' (typing indicator)' : ''}`);
  
  // Create message wrapper
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', role);
  
  if (isTyping) {
    // Create typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.classList.add('typing-indicator');
    
    // Add dots for animation
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.classList.add('dot');
      typingIndicator.appendChild(dot);
    }
    
    messageElement.appendChild(typingIndicator);
  } else {
    // Create content element for normal messages
    const contentElement = document.createElement('div');
    contentElement.classList.add('message-content');
    contentElement.innerHTML = formatMessageContent(content);
    messageElement.appendChild(contentElement);
  }
  
  // Add to chat
  messagesContainer.appendChild(messageElement);
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  return messageElement;
}

// Format message content with syntax highlighting and clickable links
function formatMessageContent(content) {
  if (!content) {
    console.warn('Empty content passed to formatMessageContent');
    return '<p><em>Empty response</em></p>';
  }
  
  try {
    // Replace URLs with clickable links
    const withLinks = content.replace(
      /(https?:\/\/[^\s]+)/g, 
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    // Escape any HTML in the content (except our links)
    let escaped = withLinks
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Restore our links
      .replace(/&lt;a href="(.*?)" target="_blank" rel="noopener noreferrer"&gt;(.*?)&lt;\/a&gt;/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>');
    
    // Preserve newlines
    escaped = escaped.replace(/\n/g, '<br>');
    
    // Process markdown for code blocks
    const withCodeBlocks = processCodeBlocks(escaped);
    
    console.debug('Formatted message content successfully');
    return withCodeBlocks;
  } catch (error) {
    console.error('Error formatting message content:', error);
    // Return raw content if there's an error
    return `<p>${content}</p>`;
  }
}

// Process code blocks for syntax highlighting
function processCodeBlocks(content) {
  try {
    // Split by code block markers
    const parts = content.split(/```(\w*)/);
    
    if (parts.length <= 1) {
      // No code blocks found
      return `<p>${content}</p>`;
    }
    
    let result = '';
    let inCodeBlock = false;
    let language = '';
    
    parts.forEach((part, index) => {
      if (index % 2 === 0) {
        // This is text outside a code block
        if (part) {
          if (inCodeBlock) {
            // This means we have a closing code block marker
            inCodeBlock = false;
            result += '</code></pre>';
          }
          
          if (part.trim()) {
            const paragraphs = part.split('<br><br>');
            paragraphs.forEach((paragraph, pIndex) => {
              if (paragraph.trim()) {
                result += `<p>${paragraph}</p>`;
              }
              
              // Add spacing between paragraphs
              if (pIndex < paragraphs.length - 1) {
                result += '<br>';
              }
            });
          }
        }
      } else {
        // This is a language marker after a triple backtick
        language = part || 'text';
        inCodeBlock = true;
        result += `<pre><code class="language-${language}">`;
      }
    });
    
    // If we're still in a code block, close it
    if (inCodeBlock) {
      result += '</code></pre>';
    }
    
    return result;
  } catch (error) {
    console.error('Error processing code blocks:', error);
    return `<p>${content}</p>`;
  }
}

// Show typing indicator
function showTypingIndicator() {
  if (!messagesContainer) {
    console.error('Cannot show typing indicator: chat messages container is null');
    return null;
  }

  // Create wrapper for the typing indicator
  const typingWrapper = document.createElement('div');
  typingWrapper.classList.add('message', 'assistant');
  
  // Create the typing indicator element
  const typingElement = document.createElement('div');
  typingElement.classList.add('typing-indicator');
  
  // Add dots for the animation
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('span');
    dot.classList.add('dot');
    typingElement.appendChild(dot);
  }
  
  // Add typing indicator to wrapper
  typingWrapper.appendChild(typingElement);
  
  // Add to chat container
  messagesContainer.appendChild(typingWrapper);
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  console.log('Showing typing indicator');
  
  // Return the wrapper element for later updating
  return typingWrapper;
}

// Remove typing indicators from the chat
function clearTypingIndicator() {
  if (!messagesContainer) {
    console.warn('Cannot clear typing indicator: chat messages container is null');
    return;
  }
  
  // Look for elements with typing-indicator class
  const typingElements = messagesContainer.querySelectorAll('.typing-indicator');
  console.log(`Clearing ${typingElements.length} typing indicators`);
  
  typingElements.forEach(typingElement => {
    // Find the parent message element
    const messageElement = typingElement.closest('.message');
    if (messageElement) {
      // Remove the entire message element containing the typing indicator
      messageElement.remove();
    } else {
      // Just remove the typing indicator if it's not in a message element
      typingElement.remove();
    }
  });
  
  // Also look for message elements that might be empty (from previous cleared typing indicators)
  const emptyMessages = messagesContainer.querySelectorAll('.message:empty');
  emptyMessages.forEach(emptyMessage => {
    emptyMessage.remove();
  });
}

function updateTypingAnimation(typingElement, newContent) {
  if (!typingElement) {
    console.error('updateTypingAnimation called with null typingElement');
    return;
  }
  
  if (typingTimeout) {
    clearTimeout(typingTimeout);
  }
  
  // Log the content length we're about to display
  console.debug(`Updating typing animation with ${newContent?.length || 0} characters of content`);
  
  // Remove typing indicator styling
  typingElement.classList.remove('typing-indicator');
  
  // Create a new content element
  const contentElement = document.createElement('div');
  contentElement.classList.add('message-content');
  contentElement.innerHTML = formatMessageContent(newContent);
  
  // Clear and update the typing element
  typingElement.innerHTML = '';
  typingElement.appendChild(contentElement);
  
  // Ensure element is visible
  typingElement.style.display = 'block';
  
  // Scroll to bottom
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    console.debug('Scrolled chat container to bottom');
  }
}

// Get response 
async function getCompletionResponse(selectedModel, typingElement) {
  const temperature = parseFloat(temperatureSlider?.value || "0.7");
  const maxTokens = parseInt(maxTokensInput?.value || "1000");
  
  try {
    // Normalize the provider name and model to ensure consistent format
    const providerName = selectedModel.provider.toLowerCase().trim();
    const modelName = selectedModel.originalData.name || selectedModel.name.trim();
    const fullModelName = `${providerName}/${modelName}`;
    
    console.log(`Sending request for ${fullModelName}`);
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.CHAT_COMPLETIONS_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: fullModelName,
        messages: chatHistory,
        temperature: temperature,
        max_tokens: maxTokens,
        stream: false
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.error || errorData.message || `Server error: ${response.status}`);
      } catch (parseError) {
        throw new Error(`Server error: ${response.status}. ${errorText.substring(0, 100)}...`);
      }
    }
    
    console.log('Received response');
    
    // Parse the response
    const data = await response.json();
    console.log('Response data:', data);
    
    // Extract content from the response
    const content = data.content || '';
    
    if (!content) {
      console.warn('Response contained no content:', data);
    }
    
    // Update typing animation with full response
    if (typingElement) {
      updateTypingAnimation(typingElement, content);
    } else {
      console.warn('No typing element available to update');
      // Create a new message as fallback
      appendMessage('assistant', content);
    }
    
    // Add to chat history
    chatHistory.push({ role: 'assistant', content: content });
    
    // Update cache status
    if (cacheStatus) {
      cacheStatus.textContent = data.cached ? 'Hit' : 'Miss';
    }
    
    // Update metrics - prioritize server token count information
    if (data.tokenUsage && typeof data.tokenUsage.output === 'number') {
      console.log(`Using output token count: ${data.tokenUsage.output}`);
      tokenCount = data.tokenUsage.output;
    } else if (data.tokenUsage && typeof data.tokenUsage.total === 'number') {
      console.log(`Using total token count: ${data.tokenUsage.total}`);
      tokenCount = data.tokenUsage.total;
    } else if (data.usage && typeof data.usage.completion_tokens === 'number') {
      // For OpenAI-style responses
      console.log(`Using completion token count: ${data.usage.completion_tokens}`);
      tokenCount = data.usage.completion_tokens;
    } else if (data.usage && typeof data.usage.total_tokens === 'number') {
      // Fallback to total tokens
      console.log(`Using total token count (usage): ${data.usage.total_tokens}`);
      tokenCount = data.usage.total_tokens;
    } else {
      // Last resort rough estimation
      console.log(`No token usage data provided, estimating based on content length`);
      tokenCount = Math.ceil((content.split(/\s+/).length) * 1.3);
    }
    
    updatePerformanceMetrics(true);
    
  } catch (error) {
    console.error('Error:', error);
    clearTypingIndicator();
    appendMessage('error', `Error: ${error.message}. Please try again or select a different model.`);
  }
}

// Send a message
async function handleUserMessage() {
  if (!chatInput || !modelDropdown || !chatInput.value.trim()) return;
    
  const selectedModel = modelDropdown.getSelectedModel();
  if (!selectedModel) {
    appendMessage('error', 'Please select a model before sending a message.');
    return;
  }
    
  // Ensure provider and model names are set
  if (!selectedModel.provider || !selectedModel.name) {
    appendMessage('error', 'The selected model is missing required information. Please select a different model.');
    return;
  }
  
  // Normalize provider name (lowercase, remove spaces)
  const provider = selectedModel.provider.toLowerCase().replace(/\s+/g, '');
  // Ensure model name is trimmed
  const modelName = selectedModel.name.trim();
  
  const userMessage = chatInput.value.trim();
    
  // Add user message to chat
  appendMessage('user', userMessage);
    
  // Clear input
  chatInput.value = '';
  chatInput.style.height = 'auto';
  if (sendButton) sendButton.disabled = true;
    
  // Add to chat history
  chatHistory.push({ role: 'user', content: userMessage });
  
  // Show typing indicator
  const typingElement = showTypingIndicator();
  
  // Verify that we have a valid typing element before proceeding
  if (!typingElement) {
    console.error('Failed to create typing indicator element');
    appendMessage('error', 'There was a problem displaying the response. Please try again.');
    return;
  }
  
  // Reset performance metrics
  resetPerformanceMetrics();
  startTime = Date.now();
  
  try {
    // Process model for request
    const modelForRequest = selectedModel;
    
    // Send non-streaming request
    await getCompletionResponse(modelForRequest, typingElement);
  } catch (error) {
    console.error('Error in sendMessage:', error);
    clearTypingIndicator();
    appendMessage('error', `Error: ${error.message}. Please try again or select a different model.`);
  } finally {
    chatInput.focus();
  }
}

// Reset chat
function resetChat() {
  chatHistory = [];
  if (messagesContainer) messagesContainer.innerHTML = '';
  appendMessage('system', 'Chat history has been reset. Select a model and start a new conversation.');
  resetPerformanceMetrics();
}

// Performance metrics
function resetPerformanceMetrics() {
  startTime = 0;
  tokenCount = 0;
  
  const responseTimeElement = document.getElementById('response-time');
  const tokenUsageElement = document.getElementById('token-usage');
  
  if (responseTimeElement) responseTimeElement.textContent = 'Response time: -';
  if (tokenUsageElement) tokenUsageElement.textContent = 'Tokens: -';
}

function updatePerformanceMetrics(isFinal = false) {
  if (!startTime) return;
  
  const timeTaken = Date.now() - startTime;
  const responseTimeElement = document.getElementById('response-time');
  const tokenUsageElement = document.getElementById('token-usage');
  
  // Update response time
  if (responseTimeElement) {
    responseTimeElement.textContent = `Response time: ${timeTaken} ms`;
  }
  
  // Update token usage with enhanced information
  if (tokenUsageElement) {
    let tokenInfo = `Tokens: ${tokenCount}`;
    
    // Add tokens per second calculation for responses that took more than 500ms
    if (timeTaken > 500 && tokenCount > 0) {
      const tokensPerSecond = Math.round((tokenCount / timeTaken) * 1000);
      tokenInfo += ` (${tokensPerSecond} TPS)`;
    }
    
    // Highlight when final
    if (isFinal) {
      tokenInfo += ` - Complete`;
    }
    
    tokenUsageElement.textContent = tokenInfo;
  }
}

// Load saved theme preference
function loadSavedTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  const themeToggle = document.getElementById('theme-toggle');
  
  if (savedTheme === 'light') {
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
    if (themeToggle) {
      const icon = themeToggle.querySelector('i');
      if (icon) {
        icon.className = 'ri-moon-line';
      }
    }
  } else {
    document.body.classList.add('dark-mode');
    document.body.classList.remove('light-mode');
    if (themeToggle) {
      const icon = themeToggle.querySelector('i');
      if (icon) {
        icon.className = 'ri-sun-line';
      }
    }
  }
}

/**
 * Toggle between dark and light themes
 */
function toggleTheme() {
  const body = document.body;
  const icon = document.querySelector('.theme-toggle i');
  
  if (body.classList.contains('dark-mode')) {
    body.classList.remove('dark-mode');
    if (icon) {
      icon.classList.remove('ri-moon-line');
      icon.classList.add('ri-sun-line');
    }
  } else {
    body.classList.add('dark-mode');
    if (icon) {
      icon.classList.remove('ri-sun-line');
      icon.classList.add('ri-moon-line');
    }
  }
}

/**
 * Check window size and adjust sidebar visibility
 */
function checkWindowSizeForSidebar() {
  const statusContainer = document.querySelector('.api-status-container');
  
  if (window.innerWidth < 1024) {
    // Mobile view - hide sidebar by default
    sidebar.classList.add('hidden-mobile');
    
    // Move API status outside sidebar for better visibility on mobile
    if (statusContainer) {
      statusContainer.style.position = 'fixed';
      statusContainer.style.top = '10px';
      statusContainer.style.right = '10px';
      statusContainer.style.zIndex = '150';
      statusContainer.style.background = 'var(--bg-secondary)';
      statusContainer.style.padding = '5px 10px';
      statusContainer.style.borderRadius = 'var(--radius-md)';
      statusContainer.style.boxShadow = 'var(--shadow-md)';
    }
  } else {
    // Desktop view - show sidebar always
    sidebar.classList.remove('hidden-mobile');
    
    // Reset API status position in desktop view
    if (statusContainer) {
      statusContainer.style.position = '';
      statusContainer.style.top = '';
      statusContainer.style.right = '';
      statusContainer.style.zIndex = '';
      statusContainer.style.background = '';
      statusContainer.style.padding = '';
      statusContainer.style.borderRadius = '';
      statusContainer.style.boxShadow = '';
    }
  }
}

/**
 * Handle model selection
 */
function handleModelSelect(model) {
  if (!model || !model.isSelectable) {
    console.warn('Attempted to select invalid or non-selectable model');
    return;
  }
  
  selectedModel = model;
  document.getElementById('selected-model-display').innerText = model.displayName || model.name;
  console.log('Model selected:', model);
  
  // Enable send button if there's text in the input
  if (sendButton && chatInput && chatInput.value.trim()) {
    sendButton.disabled = false;
  }
}

/**
 * Update settings when inputs change
 */
function updateSettings(e) {
  const settingId = e.target.id;
  let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  
  // Convert number inputs to actual numbers
  if (e.target.type === 'number' || e.target.type === 'range') {
    value = parseFloat(value);
  }
  
  // Update the settings object
  settings[settingId] = value;
  
  // Update temperature display if that's what changed
  if (settingId === 'temperature') {
    const temperatureValue = document.getElementById('temperature-value');
    if (temperatureValue) {
      temperatureValue.textContent = value;
    }
  }
  
  console.log('Settings updated:', settings);
}

/**
 * Download chat history as JSON file
 */
function downloadChatHistory() {
  if (!chatHistory || chatHistory.length === 0) {
    console.warn('No chat history to download');
    appendMessage('system', 'No chat history to download yet.');
    return;
  }
  
  try {
    // Create a blob with the chat history
    const data = JSON.stringify(chatHistory, null, 2);
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    // Create a download link and trigger it
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    console.log('Downloaded chat history');
  } catch (error) {
    console.error('Error downloading chat history:', error);
    appendMessage('error', `Error downloading chat history: ${error.message}`);
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  loadSavedTheme();
  
  // Set up theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  // Initialize app
  initialize();
});