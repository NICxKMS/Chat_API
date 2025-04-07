# Codebase Workflow and Detailed Description

This document outlines the structure, execution flow, and functionality of the test-site codebase.

## Overview

The project consists of two main parts:

1.  A **Node.js backend proxy server** (`start.js`) responsible for serving the frontend and relaying API requests.
2.  A **frontend single-page application (SPA)** (`public/` directory) providing the user interface for interacting with an AI chat model.

## Execution Flow

### 1. Server Startup

1.  The application is typically started using `npm start`.
2.  This command uses `nodemon` to execute `node start.js`, allowing for automatic restarts during development when files change.
3.  **`start.js` Execution:**
    *   **Environment Variables:** Loads environment variables from a `.env` file (if present) using `dotenv`. Key variables include `API_URL` (the URL of the actual backend AI service, defaulting to `http://localhost:3000`) and `PORT` (the desired port for this proxy server, defaulting to 3001).
    *   **API Connection Check:** Attempts to connect to the backend API defined by `API_URL` by making a GET request to its `/api/health` endpoint. It retries `MAX_RETRIES` (3) times with a 2-second delay if the connection fails (timeout or non-200 status code). If it cannot connect after retries, it logs a warning but proceeds to start the server anyway (allowing the frontend to potentially use fallback data).
    *   **Port Availability Check:** Uses the `net` module to check if the `DEFAULT_PORT` (3001 or from `PORT` env var) is available (`EADDRINUSE` error). If it's in use, it increments the port number and checks again recursively until an available port is found.
    *   **Express Server Initialization:** Creates an Express application instance.
    *   **Middleware Setup:**
        *   `cors()`: Enables Cross-Origin Resource Sharing for requests.
        *   `express.static('public')`: Configures Express to serve static files (HTML, CSS, JS, images) directly from the `public` directory.
        *   `createProxyMiddleware('/api', ...)`: Sets up a proxy using `http-proxy-middleware`. Any request received by this server starting with `/api` will be forwarded to the `API_URL`. The `pathRewrite` option ensures `/api` is included in the proxied path. `changeOrigin: true` is set for compatibility with virtual hosted backends. `logLevel: 'warn'` reduces proxy logging.
    *   **SPA Fallback Route:** A catch-all route (`app.get('*', ...)` ) is defined to serve `public/index.html`. This ensures that if the user navigates directly to a frontend route (e.g., `http://localhost:3001/some/path`) or refreshes the page, the `index.html` is served, allowing the frontend JavaScript router (if any) to handle the path.
    *   **Server Listening:** Starts the Express server using `app.listen` on the determined available port. Logs messages indicating the server is running and the URL to access the UI.

### 2. Frontend Application Loading

1.  The user navigates to `http://localhost:<port>` (e.g., `http://localhost:3001`) in their web browser.
2.  The `start.js` server receives the request for the root path (`/`).
3.  Because of `express.static('public')`, the server finds and returns `public/index.html`.
4.  The browser parses `index.html`:
    *   It sets up the basic HTML structure (sidebar, main content, chat area, input area, settings panel).
    *   It requests linked CSS files (e.g., `css/styles.css`, external icon fonts from Remixicon CDN).
    *   It requests linked JavaScript files:
        *   External libraries from CDNs (Marked for Markdown rendering, Highlight.js for syntax highlighting).
        *   Application scripts (`js/model-dropdown.js`, `js/app.js`).
5.  **`app.js` Execution (`DOMContentLoaded` event):**
    *   **Theme Loading (`loadSavedTheme`):** Checks `localStorage` for a 'theme' key ('light' or 'dark'). Applies the corresponding class (`light-mode` or `dark-mode`) to the `<body>` element. Defaults to 'dark'.
    *   **Initialization (`initialize` function):**
        *   Gets references to important DOM elements (chat input, message container, buttons, etc.) using `document.getElementById`.
        *   Sets the displayed API URL text based on the proxy's base URL (`/api`).
        *   Attaches event listeners (`attachEventListeners`) to UI elements (clicks on buttons, keypresses in input, changes in settings, window resize).
        *   Initializes the model selection logic (`initializeModelDropdown`).
        *   Adjusts the sidebar visibility based on the initial window size (`checkWindowSizeForSidebar`).
        *   Sets focus to the chat input field (`chatInput.focus()`).
    *   **Model Dropdown Initialization (`initializeModelDropdown` calling `model-dropdown.js` logic):**
        *   **Class Instantiation:** An instance of the `ModelDropdown` class (defined in `model-dropdown.js`) is created. It takes options including the container element (`#model-dropdown-container`), the `onChange` callback (`handleModelSelect` from `app.js`), and potentially the experimental toggle element (`#show-experimental`). It sets up API endpoints (specifically `/api/models/classified`) and a cache expiry time (default 5 mins).
        *   **Initialization (`ModelDropdown.initialize`):** This asynchronous method orchestrates the setup:
            *   **Cache Check (`getCachedModels`):** Checks `localStorage` for `modelDropdownCache`. If valid (exists, correct structure, not expired), it loads `processedModels`, `allModels`, and `experimentalModels` from the cache.
            *   **API Fetch (`fetchModels`):** If no valid cache exists, it makes a `fetch` request to `/api/models/classified`. It expects a response containing a `hierarchical_groups` array (like `SampleClassifiedObject`).
            *   **Data Processing (`processModels`):** If fetched successfully, it processes the `hierarchical_groups` data:
                *   Recursively traverses the provider -> type -> version hierarchy.
                *   For each model found in the `models` array at the version level, it extracts properties (id, name, provider, capabilities, is_experimental, is_multimodal, version, etc.).
                *   Determines the category ('Chat', 'Image', 'Embedding') based on `model.type` or `model.capabilities`.
                *   Normalizes the display name using `normalizeModelName` (if `model.display_name` isn't set).
                *   Stores the processed model object in a flat list (`this.allModels`) and identifies experimental models (`this.experimentalModels`).
                *   Builds a structured object (`this.processedModels`) grouping models by Category -> Provider -> Type Group (`groupingKey`, e.g., 'GPT 4', 'Flash') for rendering.
                *   Applies complex, provider-specific sorting rules (`sortModelsByProvider`) to the models within each group (e.g., OpenAI: Mini > O Series, shortest name; Gemini: version descending, 'latest' first; Anthropic: Sonnet > Opus > Haiku).
            *   **Caching (`cacheModels`):** Saves the processed structure, flat lists, and timestamp to `localStorage`.
            *   **Rendering (`render`):** Calls internal methods to build the UI (`createDropdownUI`), including the collapsible provider and type group headers, and the individual model options. It uses `DocumentFragment` for efficient DOM manipulation.
            *   **Filtering (`applyFilters`):** Applies initial filters (based on checkbox states and search input) to populate the rendered list. Filtering logic checks category, experimental status, and performs a case-insensitive search across multiple model fields (name, display name, provider, family, series, grouping key).
            *   **Event Listeners Setup (`setupEventListeners`):** Attaches 'change' listeners to category checkboxes and the experimental toggle, and a debounced ('input') listener to the search field (`#model-name-filter`), all triggering `applyFilters`.
            *   **Default Selection:** Selects the first model in the `allModels` list by default by calling `handleModelSelect`.
        *   **Rendering Variations:** When the search input has text, `renderSearchResultsList` is called instead of `renderFilteredModels`. This displays a flat, categorized list of matching models rather than the full hierarchy.
    *   **`app.js` `handleModelSelect` (Callback):** This function in `app.js` is called by `ModelDropdown` whenever a model is clicked. It updates the `selectedModel` state variable in `app.js` with the selected model object. Updates the "Selected Model" display text in the UI. **Crucially, it checks if the model name or series starts with 'o'; if so, it sets the temperature slider value to 1 and disables it.** Otherwise, it ensures the slider is enabled.

### 3. User Interaction (Chatting)

1.  The user selects an AI model from the sidebar (triggering `handleModelSelect` in `app.js`).
2.  The user types a message into the `#chat-input` textarea.
3.  The user either clicks the Send button (`#send-button`) or presses Enter (without Shift).
4.  **`app.js` `handleUserMessage` function:**
    *   Retrieves the text from the input field (`chatInput.value.trim()`).
    *   Validates that a message exists and a model is selected (shows an error message via `appendMessage` if not).
    *   Appends the user's message to the chat display (`#chat-messages`) using the `appendMessage` function. This function creates `div` elements with appropriate classes ('message', 'user') and uses `formatMessageContent` to process the text.
    *   Adds the user message object `{ role: 'user', content: userMessage }` to the `chatHistory` array.
    *   Clears the input field and resets its height.
    *   Disables the send button.
    *   Displays a typing indicator for the AI using `showTypingIndicator`. This function creates a `div.message.assistant` containing a `div.typing-indicator` with three animated `span.dot` elements and appends it to the message container.
    *   Resets performance metrics (`resetPerformanceMetrics`) and records the current time in `startTime`.
    *   Calls `getCompletionResponse` to fetch the AI's reply, passing the selected model object and the typing indicator element.
5.  **`app.js` `getCompletionResponse` function (Currently configured for non-streaming):**
    *   Retrieves current settings values (temperature, max_tokens) from the global `settings` object (which is kept up-to-date by `updateSettings`).
    *   Constructs the model identifier string for the request body by combining the provider and model ID: `${providerName}/${modelId}` (e.g., `openai/gpt-4o`).
    *   Constructs the request body payload for the backend API, including the formatted `model` string, the current `chatHistory` array, and parameters from `settings` (temperature, max_tokens, `stream: false`).
    *   Makes a `fetch` request (POST) to the `/api/chat/completions` endpoint with `Content-Type: application/json` header.
    *   **Handles the Response:**
        *   Checks `response.ok`. If not ok, it reads the response text, attempts to parse it as JSON to find an error message, otherwise throws an error with the status code and truncated response text.
        *   If ok, parses the JSON response (`response.json()`).
        *   Extracts the AI's reply from `data.content`.
        *   **Updates UI:** Calls `updateTypingAnimation`, passing the original `typingElement` and the received `content`. `updateTypingAnimation` clears the typing indicator's content, creates a new `div.message-content`, processes the `content` with `formatMessageContent`, appends the formatted content, and ensures the element is visible.
        *   Adds the final AI message object `{ role: 'assistant', content: content }` to the `chatHistory` array.
        *   **Calculates Tokens:** Determines the `tokenCount` by checking the response data (`data`) in this order of preference: `data.tokenUsage.output`, `data.tokenUsage.total`, `data.usage.completion_tokens`, `data.usage.total_tokens`. If none are found, it estimates based on word count: `Math.ceil((content.split(/\s+/).length) * 1.3)`.
        *   Updates performance metrics display (`updatePerformanceMetrics`) with the final time and token count.
        *   Handles potential errors during the fetch or processing by clearing the typing indicator and appending an error message.
    *   **Streaming Logic (Present but not fully utilized by current `getCompletionResponse` flow):**
        *   The frontend logic (`app.js`) includes handling for streamed responses when the 'Stream Response' setting is enabled (which is the default). The `updateTypingAnimation` function is designed to be called repeatedly with content deltas. However, the `getCompletionResponse` function currently sends `stream: false` in the request and processes the full response at once. Activating end-to-end streaming would require changing `getCompletionResponse` to handle a streaming `fetch` response and parse chunks, likely involving `ReadableStream` and `TextDecoder`. Full end-to-end streaming functionality might be subject to future enhancements.

### 4. Formatting and UI Helpers

*   **`formatMessageContent`**: Takes raw message text. Replaces URLs with clickable `<a>` tags. Escapes HTML characters (`<`, `>`). Replaces `\n` with `<br>`. Calls `processCodeBlocks`.
*   **`processCodeBlocks`**: Splits content by ```language markers. Wraps code sections in `<pre><code class="language-...">...</code></pre>`. Wraps non-code text in `<p>` tags, attempting to preserve paragraph breaks (based on `<br><br>`). Relies on Highlight.js (loaded via CDN) to apply syntax highlighting based on the language class.
*   **`appendMessage`**: Creates the message `div` structure, applies role classes ('user', 'assistant', 'system', 'error'), formats content using `formatMessageContent`, appends to the container, and scrolls down.
*   **`showTypingIndicator` / `clearTypingIndicator` / `updateTypingAnimation`**: Manage the visual feedback while waiting for/receiving the AI response, as described in the chat interaction flow.
*   **`updatePerformanceMetrics`**: Calculates elapsed time (`Date.now() - startTime`) in ms. Displays time and token count. If time > 500ms, calculates and displays Tokens Per Second (TPS). Appends " - Complete" to the token display on the final update.

### 5. Other Features

*   **Settings Panel (`#settings-panel`, toggled by `#settings-toggle`):**
    *   Contains sliders and inputs for `temperature`, `top_p`, `max_tokens`, `frequency_penalty`, `presence_penalty`, and a checkbox for `stream`.
    *   **`updateSettings` function:** Attached as a 'change' listener to all `.settings-input` elements. Reads the input's `id` and `value` (parsing type appropriately). Updates the corresponding key in the global `settings` object. If the temperature slider changes, it also updates the `span#temperature-value` text.
*   **Theme Toggle (`#theme-toggle`):**
    *   **`toggleTheme` function:** Attached as a 'click' listener. Toggles `dark-mode`/`light-mode` classes on `<body>`. Updates the button's icon class (`ri-moon-line`/`ri-sun-line`). Saves the new theme ('light' or 'dark') to `localStorage` under the key 'theme'.
    *   Theme is loaded on startup by `loadSavedTheme`.
*   **Reset Chat (`#reset-button`):**
    *   **`resetChat` function:** Attached as a 'click' listener. Clears the `chatHistory` array. Clears the HTML content of `#chat-messages`. Appends a system message indicating the reset. Calls `resetPerformanceMetrics`.
*   **Download Chat (`#download-chat`):**
    *   **`downloadChatHistory` function:** Attached as a 'click' listener. Checks if `chatHistory` is empty. Stringifies `chatHistory` with pretty-printing (`JSON.stringify(..., null, 2)`). Creates a `Blob` with `type: 'application/json'`. Creates an object URL (`URL.createObjectURL`). Creates a temporary `<a>` element, sets its `href` to the object URL and `download` attribute to `chat-history-YYYY-MM-DD.json`. Clicks the link programmatically. Removes the link and revokes the object URL after a short delay.
*   **Sidebar Toggle (`#sidebar-toggle`) & Responsive Behavior:**
    *   **`checkWindowSizeForSidebar` function:** Runs on 'resize' and 'DOMContentLoaded'. If `window.innerWidth < 1024`, adds `hidden-mobile` class to the sidebar (`#sidebar`) and uses JavaScript to apply fixed positioning and styling to the API status container (`.api-status-container`) to move it to the top-right corner. Otherwise (>= 1024px), removes the class and resets the inline styles on the status container.
    *   The `#sidebar-toggle` button's 'click' listener only toggles the sidebar's `active` class (and an overlay) if `window.innerWidth < 1024`, allowing it to slide in/out on mobile.

## Key Components Summary

*   **`start.js`**: Development server (using Node.js, Express), static file serving, API proxy (using `http-proxy-middleware`).
*   **`public/index.html`**: Main HTML structure for the chat UI.
*   **`public/css/styles.css`**: Styles for the UI components, including dark/light themes. Uses CSS variables extensively for theming (toggled by a class on `<body>`), Flexbox for layout, and media queries for responsiveness (handled partly by JS for sidebar visibility).
*   **`public/js/app.js`**: Core frontend logic - Initialization, UI event handling, state management (`chatHistory`, `settings`, `selectedModel`), chat message formatting and display, API calls (via proxy using `fetch`), performance metrics, settings management, theme switching, chat download.
*   **`public/js/model-dropdown.js`**: Self-contained class (`ModelDropdown`) responsible for fetching model data (from `/api/models/classified`), processing the hierarchical structure, caching results in `localStorage`, rendering the interactive/collapsible/filterable/searchable model selection list UI in the sidebar, handling complex sorting logic, managing model selection state within the component, and notifying `app.js` of selection changes via a callback.
*   **Backend API (External)**: The actual AI service located at `API_URL`, which receives requests proxied by `start.js`. This codebase does *not* include the implementation of this backend API itself.

This setup allows the frontend (UI) to be developed and served independently while securely and conveniently interacting with a potentially separate backend API service through the proxy layer. 