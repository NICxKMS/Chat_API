# 📑 API Documentation for Seamless Frontend Integration (v2.0)

This document provides a comprehensive overview of the backend API, enabling the development of a new frontend client without referencing the original frontend codebase. All information herein is derived directly from the source code.

# 0. Project Summary

-   **Purpose of the project**: To provide a chat interface that communicates with various AI models. The application supports both standard request-response chat and real-time streaming chat. It also allows users to select from a classified list of AI models.
-   **Backend base URL(s)**:
    -   The base URL is configured via the `REACT_APP_API_URL` environment variable.
    -   If not set, it defaults to `http://localhost:3000/api`.
    -   **Source Reference**: `src/contexts/ApiContext.js` (Line 17)
-   **Key constraints**:
    -   **Authentication**: Some endpoints are optionally authenticated using Bearer tokens (Firebase JWTs). Unauthenticated access may be possible but could be restricted or offer different data (e.g., the models list).
    -   **Real-Time Communication**: The primary chat functionality relies on Server-Sent Events (SSE) for real-time updates.
-   **Non-functional notes**:
    -   **Timeouts**: The client implements a 60-second timeout for streaming connections. If no data is received in this window, the connection is aborted.
        -   **Source Reference**: `src/contexts/StreamingEventsContext.js` (Lines 101, 139)
    -   **Retries**: All network requests automatically retry up to 3 times on failure, using an exponential backoff strategy.
        -   **Source Reference**: `src/utils/network.js` (Lines 1-20)

# 1. API Contract (Canonical)

---

### Get Available AI Models

-   **Method & Path**: `GET /api/models/classified`
-   **Purpose**: Retrieves a hierarchically structured list of all available AI models.
-   **Auth**: Optional. An `Authorization` header with a Bearer token may be provided to fetch a user-specific or more comprehensive model list.
    -   **Source Reference**: `src/contexts/ModelContext.js` (Lines 142-147)
-   **Headers**:
    -   `Accept: application/json`
    -   `Authorization: Bearer <JWT_TOKEN>` (Optional)
    -   **Source Reference**: `src/contexts/ModelContext.js` (Lines 141, 146)
-   **Response (200)**: A JSON object containing the model hierarchy.
    -   **JSON Schema**:
        ```json
        {
          "type": "object",
          "properties": {
            "hierarchical_groups": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "group_value": { "type": "string", "description": "Provider name (e.g., 'OpenAI')" },
                  "children": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "group_value": { "type": "string", "description": "Model type (e.g., 'GPT')" },
                        "children": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "group_value": { "type": "string", "description": "Model version (e.g., 'GPT-4')" },
                              "models": {
                                "type": "array",
                                "items": { "$ref": "#/components/schemas/RawModel" }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "required": ["hierarchical_groups"]
        }
        ```
    -   **Source Reference**: `src/workers/modelProcessor.js` (Lines 12-68)
-   **Examples**:
    -   **cURL**:
        ```bash
        # Unauthenticated
        curl -X GET "http://localhost:3000/api/models/classified" -H "Accept: application/json"

        # Authenticated
        curl -X GET "http://localhost:3000/api/models/classified" \
             -H "Accept: application/json" \
             -H "Authorization: Bearer <YOUR_JWT>"
        ```
    -   **JavaScript `fetch`**:
        ```javascript
        const getModels = async (token) => {
          const headers = { 'Accept': 'application/json' };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          const response = await fetch('http://localhost:3000/api/models/classified', { headers });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        };
        ```

---

### Chat Completions (Non-Streaming & Streaming)

This section covers the two primary chat endpoints. They share the same request body structure but differ in their response format.

-   **Method & Path**:
    -   `POST /api/chat/completions` (Non-streaming)
    -   `POST /api/chat/stream` (Streaming via SSE)
-   **Purpose**: Submits a chat history and receives an AI-generated response, either as a single payload or a real-time stream.
-   **Auth**: Optional Bearer token.
    -   **Source Reference**: `src/contexts/ChatControlContext.js` (Line 99)

#### Request Body & Message Formatting

The request body is **identical** for both the streaming and non-streaming endpoints.

-   **JSON Schema**:
    ```json
    {
      "type": "object",
      "properties": {
        "requestId": {
          "type": "string",
          "description": "A client-generated unique identifier for the request (UUID or similar).",
          "example": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
        },
        "model": {
          "type": "string",
          "description": "The identifier for the AI model to be used, formatted as 'provider/model-id'.",
          "example": "openai/gpt-4-turbo"
        },
        "messages": {
          "type": "array",
          "description": "The full conversation history, chronologically ordered. See 'Message Formatting Details' below.",
          "items": { "$ref": "#/components/schemas/Message" }
        },
        "temperature": {
          "type": "number",
          "description": "Controls randomness. Lower values make the model more deterministic.",
          "example": 0.7
        },
        "max_tokens": {
          "type": "number",
          "description": "The maximum number of tokens to generate in the response.",
          "example": 2048
        },
        "top_p": {
          "type": "number",
          "description": "Nucleus sampling parameter.",
          "example": 1.0
        },
        "frequency_penalty": {
          "type": "number",
          "description": "Penalizes new tokens based on their existing frequency in the text so far.",
          "example": 0.0
        },
        "presence_penalty": {
          "type": "number",
          "description": "Penalizes new tokens based on whether they appear in the text so far.",
          "example": 0.0
        }
      },
      "required": ["requestId", "model", "messages", "temperature", "max_tokens", "top_p", "frequency_penalty", "presence_penalty"]
    }
    ```
    -   **Source Reference**: `src/contexts/ChatControlContext.js` (Lines 87-95)

-   **Message Formatting Details**:
    -   **Structure**: Before sending, the client-side message objects are sanitized. Only the `role`, `content`, and `timestamp` fields are included in the request payload. Any other client-side fields (e.g., `id`, `metrics`) **must be stripped**.
        -   **Source Reference**: `src/contexts/ChatControlContext.js` (Line 82)
    -   **System Prompt Injection**: The client has logic to conditionally prepend a `system` message to the `messages` array if one is configured for the selected model and a system message is not already the first message in the history.
        -   **Source Reference**: `src/contexts/ChatControlContext.js` (Lines 83-85)
    -   **Example Request `messages` array**: This example shows a sanitized history with an injected system prompt.
        ```json
        "messages": [
          {
            "role": "system",
            "content": "You are a helpful assistant.",
            "timestamp": 1678886400000
          },
          {
            "role": "user",
            "content": "What is the capital of France?",
            "timestamp": 1678886401000
          },
          {
            "role": "assistant",
            "content": "The capital of France is Paris.",
            "timestamp": 1678886402000
          },
          {
            "role": "user",
            "content": "Thanks!",
            "timestamp": 1678886403000
          }
        ]
        ```

#### Response (`/api/chat/completions`)

-   **Response (200)**: A single JSON object containing the full response.
    -   **JSON Schema**:
        ```json
        {
          "type": "object",
          "properties": {
            "content": {
              "type": "string",
              "description": "The complete AI-generated response message.",
              "example": "The capital of France is Paris."
            },
            "usage": { "$ref": "#/components/schemas/Usage" },
            "finishReason": {
              "type": "string",
              "description": "The reason the model stopped generating tokens.",
              "enum": ["stop", "length", "error", "tool_calls"]
            }
          },
          "required": ["content", "usage", "finishReason"]
        }
        ```
    -   **Source Reference**: `src/contexts/ChatControlContext.js` (Lines 108, 140-145, 164)
-   **Other Responses**: Errors are returned with non-2xx status codes and a standard error envelope. See Section 5. A 200 OK can also contain an error payload.
    -   **Source Reference**: `src/contexts/ChatControlContext.js` (Lines 105, 112)

#### Response (`/api/chat/stream`)

-   **Response (200)**: A `text/event-stream` response. See Section 2 for the detailed SSE format.

---

### Stop Generation

-   **Method & Path**: `POST /api/chat/stop`
-   **Purpose**: Notifies the backend to terminate a running SSE stream for a given `requestId`, allowing for server-side resource cleanup.
-   **Auth**: Optional Bearer token.
    -   **Source Reference**: `src/contexts/StreamingEventsContext.js` (Line 231)
-   **Request Body**:
    -   **JSON Schema**:
        ```json
        {
          "type": "object",
          "properties": {
            "requestId": {
              "type": "string",
              "description": "The unique client-generated ID of the stream that should be stopped."
            }
          },
          "required": ["requestId"]
        }
        ```
    -   **Source Reference**: `src/contexts/StreamingEventsContext.js` (Line 234)
-   **Response**: No response body is expected or processed by the client.
-   **Examples**:
    -   **cURL**:
        ```bash
        curl -X POST "http://localhost:3000/api/chat/stop" \
             -H "Content-Type: application/json" \
             -H "Authorization: Bearer <YOUR_JWT>" \
             -d '{"requestId": "a1b2c3d4-e5f6-7890-1234-567890abcdef"}'
        ```
    -   **JavaScript `fetch`**:
        ```javascript
        const stopStream = async (requestId, token) => {
          const headers = { 'Content-Type': 'application/json' };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          await fetch('http://localhost:3000/api/chat/stop', {
            method: 'POST',
            headers,
            body: JSON.stringify({ requestId })
          });
        };
        ```

# 2. Streaming / Real-Time (SSE)

-   **Endpoint**: `POST /api/chat/stream`
-   **Purpose**: Initiates a Server-Sent Events (SSE) stream for real-time chat responses.
-   **Handshake**:
    -   **Headers**: `Content-Type: application/json`, `Accept: text/event-stream`, `Cache-Control: no-cache`
    -   **Request Body**: See Section 1 for the detailed request body schema.
    -   **Source Reference**: `src/contexts/StreamingEventsContext.js` (Lines 117-131)
-   **Event format**:
    -   Events are delimited by double newlines (`\n\n`).
    -   **Heartbeat / keep-alive**: Lines starting with `:heartbeat` are sent as keep-alive signals and should be ignored.
        -   **Source Reference**: `src/workers/streamProcessor.js` (Line 15)
    -   **Data Events**: Events start with `data: ` followed by a JSON payload.
        -   **JSON Data Schema**:
            ```json
            {
              "type": "object",
              "properties": {
                "content": { "type": "string", "description": "A chunk of the AI-generated text." },
                "usage": { "$ref": "#/components/schemas/Usage" },
                "finishReason": { "type": "string", "description": "Typically appears in the final chunk." },
                "error": { "$ref": "#/components/schemas/ErrorPayload" }
              }
            }
            ```
        -   **Source Reference**: `src/workers/streamProcessor.js` (Lines 21-68)
-   **Completion signal**: The stream is terminated by a final message: `data: [DONE]`.
    -   **Source Reference**: `src/workers/streamProcessor.js` (Lines 18-19)
-   **Error events**: Errors can be sent in a `data` payload, identified by `finishReason: 'error'` or the presence of an `error` object.
    -   **Source Reference**: `src/contexts/StreamingEventsContext.js` (Line 156)
-   **Example Raw Stream**:
    ```
    :heartbeat

    data: {"content":"The capital","usage":null,"finishReason":null}

    data: {"content":" of France","usage":null,"finishReason":null}

    data: {"content":" is Paris.","usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15},"finishReason":"stop"}

    data: [DONE]
    ```

# 3. Authentication & Authorization

-   **Method**: Authentication is handled via [Firebase Authentication](https://firebase.google.com/docs/auth).
-   **Token Acquisition**:
    1.  The client initiates a Firebase login flow (e.g., popup or redirect).
    2.  Upon successful login, the client receives a `user` object from Firebase.
    3.  The client calls `user.getIdToken()` to obtain a JWT.
    -   **Source Reference**: `src/contexts/AuthContext.js` (Lines 109-114)
-   **Format**: The `idToken` is a standard Firebase JWT. Its claims and expiry are handled by the Firebase client SDK.
-   **Required Headers**: For authenticated requests, the token is sent in the `Authorization` header: `Authorization: Bearer <FIREBASE_ID_TOKEN>`.
    -   **Source Reference**: `src/contexts/ChatControlContext.js` (Line 99)
-   **Role/Permission Model**: No client-side role or permission model is evident. Access control is presumed to be handled by the backend based on the JWT's validity and claims.
-   **Token Storage**: The JWT is cached in `localStorage` under the key `idToken` to persist sessions across page loads.
    -   **Source Reference**: `src/contexts/AuthContext.js` (Lines 115, 134)

# 4. Shared Domain Models

-   **`RawModel`**: The representation of a model as received directly from the `GET /api/models/classified` endpoint.
    ```json
    {
      "title": "Raw AI Model",
      "type": "object",
      "properties": {
        "id": { "type": "string", "example": "gpt-4" },
        "name": { "type": "string", "example": "GPT-4" },
        "display_name": { "type": "string", "example": "GPT-4" },
        "type": { "type": "string", "example": "GPT" },
        "version": { "type": "string", "example": "4.0" },
        "is_experimental": { "type": "boolean" },
        "is_multimodal": { "type": "boolean" },
        "capabilities": { "type": "object" },
        "family": { "type": "string" },
        "series": { "type": "string" }
      },
      "required": ["id"]
    }
    ```
    -   **Source Reference**: `src/workers/modelProcessor.js` (Lines 35-53)

-   **`ClientModel`**: The client-side processed and enriched representation of a model.
    ```json
    {
      "title": "Client AI Model",
      "type": "object",
      "properties": {
        "id": { "type": "string" }, "name": { "type": "string" }, "provider": { "type": "string" },
        "type": { "type": "string" }, "version": { "type": "string" },
        "category": { "type": "string", "enum": ["Chat", "Image", "Embedding"] },
        "is_experimental": { "type": "boolean" }, "is_multimodal": { "type": "boolean" },
        "capabilities": { "type": "object" }, "family": { "type": "string" }, "series": { "type": "string" }
      },
      "required": ["id", "name", "provider", "type", "version", "category"]
    }
    ```
    -   **Source Reference**: `src/workers/modelProcessor.js` (Lines 41-53)

-   **`Message`**: A message object within a chat history, as sent to the API.
    ```json
    {
      "title": "Chat Message",
      "type": "object",
      "properties": {
        "role": {
          "type": "string",
          "enum": ["system", "user", "assistant"],
          "description": "The role of the message author."
        },
        "content": {
          "type": "string",
          "description": "The text content of the message."
        },
        "timestamp": {
          "type": "number",
          "description": "Client-side Unix timestamp in milliseconds."
        }
      },
      "required": ["role", "content", "timestamp"]
    }
    ```
    -   **Source Reference**: `src/contexts/ChatControlContext.js` (Line 82)

-   **`Usage`**: Token usage statistics for an API call.
    ```json
    {
      "title": "Token Usage",
      "type": "object",
      "properties": {
        "prompt_tokens": { "type": "number" },
        "completion_tokens": { "type": "number" },
        "total_tokens": { "type": "number" }
      }
    }
    ```
    -   **Source Reference**: `src/contexts/ChatControlContext.js` (Lines 142-145)

# 5. Error Contract (Global)

-   **Standard Error Envelope**: For non-2xx HTTP responses, a JSON body with the following schema is expected. The client code prioritizes `error.message` but falls back to `message`.
    -   **Schema**:
        ```json
        {
          "title": "Error Payload",
          "type": "object",
          "properties": {
            "error": {
              "type": "object",
              "properties": { "message": { "type": "string" } }
            },
            "message": { "type": "string" }
          }
        }
        ```
    -   **Source Reference**: `src/contexts/ChatControlContext.js` (Line 105)
-   **In-Stream Errors**: The SSE stream can deliver errors in a `data` event with `finishReason: 'error'`.
    -   **Source Reference**: `src/contexts/StreamingEventsContext.js` (Line 156)
-   **Example**:
    ```json
    {
      "error": {
        "message": "The requested model is not available."
      }
    }
    ```

# 6. Integration Flow (Frontend ↔ Backend)

-   **Request Lifecycle**:
    1.  Client constructs the `messages` array from its internal state, stripping any client-only fields.
    2.  Client conditionally injects a `system` prompt at the beginning of the `messages` array based on settings.
    3.  If authenticated, the Firebase JWT is added to the `Authorization` header.
    4.  The request is sent via `fetch`. If the request fails (network error or non-2xx status), it is retried up to 3 times with exponential backoff.
    5.  The response is processed (either by parsing the complete JSON or by reading the SSE stream chunk by chunk).
-   **Streaming State Management**:
    1.  For streaming calls, an empty placeholder assistant message is typically added to the UI first.
    2.  The API request is sent *without* this placeholder.
    3.  As `content` chunks arrive in the SSE stream, they are appended to the placeholder message in the UI.
    4.  At the end of the stream (`[DONE]`), the final `usage` metrics are received and associated with the completed message.
    -   **Source Reference**: `src/contexts/StreamingEventsContext.js` (Line 100, 111-113, 181-183)
-   **Retry/Backoff**: Implemented in a `fetchWithRetry` utility.
    -   **Retries**: 3
    -   **Initial Backoff**: 500ms, increasing exponentially with jitter.
    -   **Source Reference**: `src/utils/network.js` (Lines 1-20)
-   **Timeout/Cancelation**:
    -   Streaming connections are aborted client-side after 60 seconds of inactivity.
        -   **Source Reference**: `src/contexts/StreamingEventsContext.js` (Lines 101, 139)
    -   Users can manually stop a stream, which triggers a `POST /api/chat/stop` call to the backend.
        -   **Source Reference**: `src/contexts/StreamingEventsContext.js` (Line 226)

# 7. Config & Environment

-   **Required Environment Variables**:
    -   `REACT_APP_API_URL`: Backend API base URL. Defaults to `http://localhost:3000/api`.
        -   **Source Reference**: `src/contexts/ApiContext.js` (Line 17)
    -   `REACT_APP_FIREBASE_API_KEY`: Firebase API Key.
    -   `REACT_APP_FIREBASE_AUTH_DOMAIN`: Firebase Auth Domain.
    -   `REACT_APP_FIREBASE_PROJECT_ID`: Firebase Project ID.
    -   `REACT_APP_FIREBASE_STORAGE_BUCKET`: Firebase Storage Bucket.
    -   `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`: Firebase Messaging Sender ID.
    -   `REACT_APP_FIREBASE_APP_ID`: Firebase App ID.
    -   **Source Reference**: `src/firebaseConfig.js` (Lines 6-11)
-   **Feature Flags**: No API-affecting feature flags were identified in the codebase analysis.

# 8. Security Considerations

-   **HTTPS**: Assumed to be required in production environments to protect the `Authorization` token and user data in transit.
-   **Sensitive Fields**: The `Authorization` header contains the user's JWT, which must be protected.
-   **Token Storage**: The JWT is stored in `localStorage`. This is standard practice but is vulnerable to XSS attacks. A new frontend should consider the security implications and alternatives (e.g., `HttpOnly` cookies if the architecture allows).
    -   **Source Reference**: `src/contexts/AuthContext.js` (Line 115)

# 9. Drop-in Frontend Blueprint (Framework-Agnostic)

-   **HTTP Client Pseudocode**:
    ```javascript
    class ApiClient {
      constructor(baseUrl, getToken) {
        this.baseUrl = baseUrl;
        this.getToken = getToken; // Function to retrieve the auth token
      }

      async _fetchWithRetry(url, options, retries = 3, backoff = 500) {
        let attempt = 0;
        while (true) {
          try {
            const token = this.getToken();
            const headers = { ...options.headers };
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }
            const response = await fetch(url, { ...options, headers });
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            return response;
          } catch (error) {
            if (attempt >= retries) throw error;
            const delay = backoff * Math.pow(2, attempt) + Math.random() * 100;
            await new Promise(res => setTimeout(res, delay));
            attempt++;
          }
        }
      }

      // Prepares the chat payload by injecting system prompt and sanitizing messages
      _prepareChatPayload(payload) {
          // IMPORTANT: Implement system prompt injection before sending.
          if (payload.systemPrompt && (!payload.messages.length || payload.messages[0].role !== 'system')) {
              payload.messages.unshift({ role: 'system', content: payload.systemPrompt, timestamp: Date.now() - 1 });
          }
          // IMPORTANT: Strip client-only fields from messages.
          const apiMessages = payload.messages.map(({ role, content, timestamp }) => ({ role, content, timestamp }));
          
          return { ...payload, messages: apiMessages };
      }

      async getModels() {
        const response = await this._fetchWithRetry(`${this.baseUrl}/api/models/classified`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        return response.json();
      }

      async getCompletion(payload) {
        const finalPayload = this._prepareChatPayload(payload);
        const response = await this._fetchWithRetry(`${this.baseUrl}/api/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(finalPayload)
        });
        return response.json();
      }
      
      async getCompletionStream(payload, onChunk, onDone, onError) {
        const finalPayload = this._prepareChatPayload(payload);
        // ... SSE fetch and parsing logic as detailed in the SSE Client Pseudocode ...
      }
    }
    ```
-   **SSE Client Pseudocode**:
    ```javascript
    async function handleStreamingChat(baseUrl, payload, token, onChunk, onDone, onError) {
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        const response = await fetch(`${baseUrl}/api/chat/stream`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop(); // Keep the last, possibly incomplete, part

          for (const part of parts) {
            if (part.startsWith('data: ')) {
              const dataStr = part.substring(6);
              if (dataStr === '[DONE]') {
                onDone();
                return;
              }
              try {
                const data = JSON.parse(dataStr);
                if (data.error || data.finishReason === 'error') {
                  onError(data.error?.message || 'Stream error');
                } else {
                  onChunk(data);
                }
              } catch (e) { /* Ignore parse errors for incomplete JSON */ }
            }
          }
        }
      } catch (e) {
        onError(e.message);
      }
    }
    ```

# 10. Versioning & Change Detection

-   **Versioning**: **⚠ Unknown – requires confirmation**. No evidence of API versioning (e.g., via URL path like `/api/v2/...` or headers like `X-API-Version`) was found in the analyzed frontend code. The API contract appears to be unversioned from the client's perspective.

# 11. File/Code Reference Index

| API / Feature                  | File                                     | Line Range      |
| ------------------------------ | ---------------------------------------- | --------------- |
| **API Base URL**               | `src/contexts/ApiContext.js`             | 17              |
| **Request Retry Logic**        | `src/utils/network.js`                   | 1-20            |
| **Auth (Firebase)**            | `src/contexts/AuthContext.js`            | 34, 98-99, 109-114 |
| **Token Storage**              | `src/contexts/AuthContext.js`            | 115, 134        |
| **Firebase Config**            | `src/firebaseConfig.js`                  | 6-11            |
| **System Prompt Injection**    | `src/contexts/ChatControlContext.js`     | 83-85           |
| **Message Sanitization**       | `src/contexts/ChatControlContext.js`     | 82              |
| **GET /api/models/classified** | `src/contexts/ModelContext.js`           | 141-150         |
| **Model Response Processing**  | `src/workers/modelProcessor.js`          | 12-69           |
| **POST /api/chat/completions** | `src/contexts/ChatControlContext.js`     | 87-102          |
| **POST /api/chat/stream**      | `src/contexts/StreamingEventsContext.js` | 117-131         |
| **SSE Stream Processing**      | `src/workers/streamProcessor.js`         | 7-82            |
| **POST /api/chat/stop**        | `src/contexts/StreamingEventsContext.js` | 226-244         |

# 12. Appendix

-   **OpenAPI-like YAML Spec (Inferred)**:
    ```yaml
    openapi: 3.0.0
    info:
      title: Chat API
      version: "2.0.0"
    paths:
      /api/models/classified:
        get:
          summary: Get Available AI Models
          security: [{ bearerAuth: [] }]
          responses:
            '200': { description: 'A list of models.' }
      /api/chat/completions:
        post:
          summary: Chat Completions (Non-Streaming)
          security: [{ bearerAuth: [] }]
          requestBody:
            required: true
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatRequest' } } }
          responses:
            '200': { description: 'Successful response.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatResponse' } } } }
      /api/chat/stream:
        post:
          summary: Chat Completions (Streaming)
          security: [{ bearerAuth: [] }]
          requestBody:
            required: true
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatRequest' } } }
          responses:
            '200': { description: 'A Server-Sent Events stream.', content: { 'text/event-stream': {} } }
      /api/chat/stop:
        post:
          summary: Stop Generation
          security: [{ bearerAuth: [] }]
          requestBody:
            required: true
            content: { 'application/json': { schema: { type: 'object', properties: { requestId: { type: 'string' } } } } }
          responses:
            '200': { description: 'Stop signal received.' }
    components:
      securitySchemes:
        bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }
      schemas:
        ChatRequest:
          type: object
          properties:
            requestId: { type: string }
            model: { type: string }
            messages: { type: array, items: { $ref: '#/components/schemas/Message' } }
            # ... other properties
        ChatResponse:
          type: object
          properties:
            content: { type: string }
            usage: { $ref: '#/components/schemas/Usage' }
            finishReason: { type: string }
        Message:
          type: object
          properties: { role: { type: string }, content: { type: string }, timestamp: { type: number } }
        Usage:
          type: object
          properties: { prompt_tokens: { type: number }, completion_tokens: { type: number }, total_tokens: { type: number } }
    ```
-   **cURL Collection**:
    ```bash
    # Get Models (Authenticated)
    curl -X GET "http://localhost:3000/api/models/classified" -H "Authorization: Bearer <TOKEN>"

    # Send Chat (Non-Streaming)
    curl -X POST "http://localhost:3000/api/chat/completions" -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" -d '{"requestId": "1", "model": "provider/model", "messages": [{"role": "user", "content": "test", "timestamp": 1678886401000}]}'

    # Send Chat (Streaming)
    curl -N -X POST "http://localhost:3000/api/chat/stream" -H "Content-Type: application/json" -H "Accept: text/event-stream" -H "Authorization: Bearer <TOKEN>" -d '{"requestId": "2", "model": "provider/model", "messages": [{"role": "user", "content": "test", "timestamp": 1678886401000}]}'

    # Stop Stream
    curl -X POST "http://localhost:3000/api/chat/stop" -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" -d '{"requestId": "2"}'
    ```
-   **Glossary**:
    -   **SSE**: Server-Sent Events. A mechanism for a server to push real-time data to a client over a single HTTP connection.
    -   **JWT**: JSON Web Token. A compact, URL-safe means of representing claims to be transferred between two parties. Used here for authentication.
    -   **idToken**: The specific name for the Firebase JWT used in this application.
