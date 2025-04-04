# Frontend Integration Guide (Chat API)

## Overview

This guide details how to interact with the Chat API backend from a frontend application. The backend uses **Fastify** and **Firebase Authentication**.

A key feature is the support for both **authenticated** (logged-in) and **anonymous** (temporary, non-persistent) user sessions.

## Authentication Flow (Optional Login)

The application allows users to start using the core chat functionality **without logging in initially**. This creates a temporary, anonymous session stored only in the client's browser state (e.g., local/session storage).

1.  **Anonymous Session (Default):**
    *   When the user first interacts with the API (e.g., sends a chat message), do **NOT** send an `Authorization` header.
    *   The backend will process the request anonymously.
    *   **Important:** Any data generated during this session (like chat history) **will NOT be saved** persistently on the server.
    *   The frontend is responsible for managing the state of the anonymous session (e.g., storing current chat messages locally).

2.  **Optional Login:**
    *   Provide users with an option to **Log In / Sign Up** using Firebase Authentication.
    *   Implement the sign-in/sign-up flow using a **Firebase client SDK** (Web, iOS, Android).
    *   Upon successful Firebase authentication, the SDK provides a **Firebase ID Token** (a JWT).

3.  **Authenticated Session:**
    *   Once the user is logged in via Firebase, **ALL** subsequent requests to the backend API (endpoints under `/api/`) **MUST** include the obtained Firebase ID Token in the `Authorization` header using the `Bearer` scheme:
        ```
        Authorization: Bearer <firebase_id_token>
        ```
    *   The backend will verify this token. If valid, it will associate the request with the logged-in user.
    *   **Benefit:** Actions performed while authenticated (e.g., sending chat messages) **can be saved persistently** on the server associated with that user account (Note: Save functionality needs to be implemented on the backend for relevant endpoints).

4.  **Token Refresh:** Firebase client SDKs typically handle ID token refreshes automatically. Ensure your frontend logic correctly retrieves the *current* ID token before making each API request.

5.  **Logout:** When the user logs out on the client, simply stop sending the `Authorization` header with API requests. The backend will treat subsequent requests as anonymous again.

## API Endpoint Documentation

### Common Headers

*   **Requests (All):**
    *   `Content-Type: application/json`: Required for requests with a JSON body (e.g., POST).
    *   `Accept: application/json`: Recommended for clients expecting JSON responses.
*   **Requests (Authenticated Only):**
    *   `Authorization: Bearer <firebase_id_token>`: **Required** only when the user is logged in via Firebase.
*   **Responses:**
    *   `Content-Type: application/json`: For standard JSON responses.
    *   `Content-Type: text/event-stream`: For Server-Sent Event streams (`/api/chat/stream`).
    *   `X-RateLimit-*`, `Retry-After`: May be present if rate limiting is enabled.

### Standard Error Response Format

Errors generally follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE_STRING", // e.g., "ValidationError", "TOKEN_INVALID", "InternalServerError"
    "message": "A human-readable error message.",
    "status": 4xx_or_5xx_StatusCode, 
    "details": [ /* Optional: Validation details */ ], 
    "timestamp": "ISO_8601_Timestamp",
    "path": "/requested/path"
  }
}
```
*   A `401 Unauthorized` error (`TOKEN_INVALID` code) indicates an invalid or expired token was sent. If no token was sent (anonymous session), this error will **not** occur simply due to lack of authentication.

--- 

### Health & Status Endpoints

(These do not require authentication)

**1. `GET /health`**
*   **Description:** Basic health check.
*   **Request:** None
*   **Response (Success - 200 OK):** 
    ```json
    {
      "status": "OK",
      "version": "1.0.0" 
    }
    ```
*   **Error Responses:** Unlikely, potentially 500 for unexpected server issues.

**2. `GET /api/health`** 
*   **Description:** Simple API health check.
*   **Request:** None
*   **Response (Success - 200 OK):** 
    ```json
    {
      "status": "ok",
      "timestamp": "2023-10-27T10:00:00.000Z",
      "service": "Chat API"
    }
    ```
*   **Error Responses:** Unlikely, potentially 500.

**(Note:** `/api/status` and `/api/version` are now protected under `/api`.)*

--- 

### Model Information Endpoints (`/api/models`)

**(Authentication: Optional - Token required only if user is logged in)**

These endpoints generally provide information and may not differ in response based on auth status, but require the token if the user *is* logged in.

**1. `GET /api/models`**
*   **Description:** Gets all available models grouped by provider.
*   **Request:** None
*   **Response (Success - 200 OK):** 
    ```json
    {
      "models": {
        "openai": {
          "models": [ "gpt-4o", "gpt-4-turbo" ],
          "defaultModel": "gpt-4o"
        },
        "anthropic": {
          "models": [ "claude-3-opus-20240229" ],
          "defaultModel": "claude-3-opus-20240229"
        }
      },
      "providers": ["openai", "anthropic"],
      "default": {
        "provider": "openai",
        "model": "gpt-4o"
      }
    }
    ```
*   **Error Responses:** 
    *   `401 Unauthorized` (if invalid/expired token sent)
    *   `500 Internal Server Error` (if provider factory fails)

**2. `GET /api/models/providers`**
*   **Description:** Gets detailed provider capabilities.
*   **Request:** None
*   **Response (Success - 200 OK):** 
    ```json
    {
      "openai": {
          "name": "openai",
          "apiKey": true,
          "models": [ "gpt-4o", "gpt-4-turbo" ],
          "features": { "streaming": true, "jsonMode": true },
          "defaultModel": "gpt-4o"
      },
      "anthropic": {
          "name": "anthropic",
          "apiKey": true,
          "models": [ "claude-3-opus-20240229" ],
          "features": { "streaming": true },
          "defaultModel": "claude-3-opus-20240229"
      }
    }
    ```
*   **Error Responses:** 
    *   `401 Unauthorized` (if invalid/expired token sent)
    *   `500 Internal Server Error`

**3. `GET /api/models/categories`**
*   **Description:** Gets UI-categorized models (fallback or gRPC).
*   **Request:** None
*   **Response (Success - 200 OK - Fallback Example):** 
    ```json
    [
      {
        "name": "Latest & Greatest",
        "providers": [
          { "name": "openai", "models": [ { "name": "gpt-4o", "isExperimental": false }, {"name": "gpt-4-turbo", "isExperimental": false } ] },
          { "name": "anthropic", "models": [ { "name": "claude-3-opus", "isExperimental": false } ] }
        ]
      }
    ]
    ```
*   **Response (Success - 200 OK - gRPC Example):** (Structure depends on gRPC service contract)
    ```json
    { 
        "hierarchical_groups": [ /* ... gRPC defined structure ... */ ],
        "available_properties": [ /* ... gRPC defined structure ... */ ],
        "timestamp": "..."
    }
    ```
*   **Error Responses:**
    *   `401 Unauthorized` (if invalid/expired token sent)
    *   `503 Service Unavailable` (If gRPC enabled but fails/unavailable)
    *   `500 Internal Server Error` (Other internal issues)

**4. `GET /api/models/classified`**
*   **Description:** Gets gRPC classified models (requires service enabled).
*   **Request:** None
*   **Response (Success - 200 OK):** (Structure depends on gRPC service contract)
    ```json
    { 
        "hierarchical_groups": [ /* ... gRPC defined structure ... */ ],
        "available_properties": [ /* ... gRPC defined structure ... */ ],
        "timestamp": "..."
    }
    ```
*   **Error Responses:**
    *   `401 Unauthorized` (if invalid/expired token sent)
    *   `503 Service Unavailable` (If service disabled or gRPC call fails)
    *   `500 Internal Server Error` (If internal error during processing)

**5. `GET /api/models/classified/criteria`**
*   **Description:** Gets gRPC classified models matching query criteria (requires service enabled).
*   **Request Query Params:** 
    *   Key-value pairs matching classification criteria (e.g., `?task=summarization&complexity=low`). Specific keys depend on gRPC service.
*   **Response (Success - 200 OK):** (Structure depends on gRPC service contract)
    ```json
    { 
        "models": [ /* List of matching model objects/IDs from gRPC */ ],
        "count": 2, 
        "criteria_matched": { "task": "summarization", "complexity": "low" },
        "timestamp": "..."
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request` (`INVALID_ARGUMENT` code, if criteria invalid per gRPC service)
    *   `401 Unauthorized` (if invalid/expired token sent)
    *   `503 Service Unavailable` (If service disabled or gRPC call fails)
    *   `500 Internal Server Error` (Other internal issues)

**6. `GET /api/models/:providerName`**
*   **Description:** Gets models for a specific provider.
*   **Request Path Param:** 
    *   `:providerName` (string, required): e.g., `openai`, `anthropic`.
*   **Response (Success - 200 OK):** 
    ```json
    {
      "provider": "openai",
      "models": ["gpt-4o", "gpt-4-turbo"],
      "defaultModel": "gpt-4o"
    }
    ```
*   **Error Responses:**
    *   `401 Unauthorized` (if invalid/expired token sent)
    *   `404 Not Found` (`NotFoundError` code, if provider name invalid)
    *   `500 Internal Server Error`

--- 

### Chat Endpoints (`/api/chat`)

**(Authentication: Optional - Token required only if user is logged in. Affects data persistence.)**

**1. `POST /api/chat/completions`**
*   **Description:** Standard non-streaming chat request.
*   **Request Body (JSON):**
    ```json
    {
      "model": "string", // Required: Format "provider/model_id" (e.g., "openai/gpt-4o")
      "messages": [ // Required: Array, min 1 item
        {
          "role": "system" | "user" | "assistant", // Required
          "content": "string" // Required
        }
        // ... more messages
      ],
      "temperature": "number", // Optional: 0.0 - 2.0, default varies by provider (often ~0.7)
      "max_tokens": "integer", // Optional: Positive integer, default varies (often ~1000)
      "nocache": "boolean" // Optional: default false. Set true to bypass backend response cache.
    }
    ```
*   **Response (Success - 200 OK):** (Structure varies by provider, this is OpenAI-like)
    ```json
    {
      "id": "chatcmpl-xxxx",
      "object": "chat.completion",
      "created": 1677652288,
      "model": "gpt-4o-YYYYMMDD", // Actual model used by provider
      "choices": [
        {
          "index": 0,
          "message": {
            "role": "assistant",
            "content": "This is the LLM response."
          },
          "finish_reason": "stop" // or "length", "tool_calls", etc.
        }
      ],
      "usage": {
        "prompt_tokens": 50,
        "completion_tokens": 60,
        "total_tokens": 110
      },
      "cached": true // Optional: Only present if response was cached
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request` (`ValidationError` code, if request body fails schema validation; `BadRequestError` if missing required fields like model/messages)
    *   `401 Unauthorized` (`TOKEN_INVALID` code, if invalid/expired token sent)
    *   `404 Not Found` (`NotFoundError` code, if provider/model specified in body is invalid)
    *   `429 Too Many Requests` (`RateLimitError` code, if rate limit exceeded)
    *   `500 Internal Server Error` (`InternalServerError` code)
    *   `502 Bad Gateway` (`ProviderError` or `ProviderClientError` code, if LLM provider API returns an error)
    *   `504 Gateway Timeout` (`TimeoutError` code, if LLM provider request times out)

**2. `POST /api/chat/stream`**
*   **Description:** Streaming chat request (Server-Sent Events).
*   **Request Body (JSON):** Same structure and validation as `/api/chat/completions`.
*   **Response (Success - 200 OK with SSE Stream):**
    *   **Headers:** `Content-Type: text/event-stream`, `Connection: keep-alive`, `Cache-Control: no-cache`, `Transfer-Encoding: chunked`.
    *   **Body Stream:** 
        *   Zero or more `:heartbeat\n\n` comments.
        *   One or more `data: JSON_CHUNK\n\n` events. The `JSON_CHUNK` structure depends on the provider but typically contains deltas:
            ```json
            // Example OpenAI chunk structure within the 'data:' line:
            {
              "id":"chatcmpl-xxx",
              "object":"chat.completion.chunk",
              "created":1677652288,
              "model":"gpt-4o-...",
              "choices":[{
                "index":0,
                "delta":{"role":"assistant"}, // First chunk often has role
                "finish_reason":null
              }]
            }
            // --- or --- 
            {
              "id":"chatcmpl-xxx",
              "object":"chat.completion.chunk",
              "created":1677652288,
              "model":"gpt-4o-...",
              "choices":[{
                "index":0,
                "delta":{"content":" some text"}, // Subsequent chunks have content
                "finish_reason":null
              }]
            }
            // --- or --- 
            {
              "id":"chatcmpl-xxx",
              "object":"chat.completion.chunk",
              "created":1677652288,
              "model":"gpt-4o-...",
              "choices":[{
                "index":0,
                "delta":{}, // Final chunk often has empty delta
                "finish_reason":"stop"
              }]
            }
            ```
        *   Potentially a stream termination indicator like `data: [DONE]\n\n` (Provider specific).
        *   If an error occurs *during* the stream, potentially an `event: error\ndata: JSON_ERROR_PAYLOAD\n\n` event:
            ```json
            // Example JSON_ERROR_PAYLOAD within the 'data:' line:
            {
              "code": "ProviderStreamError",
              "message": "An error occurred during streaming.",
              "status": 502,
              "provider": "openai",
              "model": "gpt-4o"
            }
            ```
*   **Error Responses (Before Stream Starts):** Same as `/api/chat/completions` (400, 401, 404, 429, 500, 502) returned as standard JSON error objects.

**3. `GET /api/chat/capabilities`**
*   **Description:** Gets provider/system/cache capabilities.
*   **Request:** None
*   **Response (Success - 200 OK):** 
    ```json
    {
      "providers": { /* Detailed provider info */ },
      "defaultProvider": "openai",
      "circuitBreakers": { "openai": "CLOSED", /* ... */ },
      "cacheStats": { "enabled": true, "size": 10, "maxSize": 100 },
      "systemStatus": {
        "uptime": 1800.5,
        "memory": { /* Node memory usage object */ },
        "timestamp": "2023-10-27T10:30:00.000Z"
      }
    }
    ```
*   **Error Responses:**
    *   `401 Unauthorized` (if invalid/expired token sent)
    *   `500 Internal Server Error`

--- 

## Frontend State Management Considerations

*   **Anonymous Sessions:** The frontend MUST store the state for anonymous chat sessions (e.g., the list of messages sent/received) locally (e.g., in component state, Zustand, Redux, localStorage/sessionStorage). This state is lost if the user reloads or closes the browser unless explicitly persisted client-side.
*   **Authenticated Sessions:** When a user logs in:
    *   The frontend should fetch any previously saved persistent data (e.g., chat history) associated with that user (Requires backend endpoints for this, TBD).
    *   Continue sending the Firebase ID Token with all subsequent requests.
*   **Switching States:** Handle the transition smoothly:
    *   **Anonymous -> Authenticated:** After login, potentially clear local anonymous state and fetch/display persistent state.
    *   **Authenticated -> Anonymous:** After logout, clear any displayed persistent state and revert to managing state locally for the new anonymous session.

This guide provides the necessary information to interact with the updated backend. Remember to implement the client-side Firebase Authentication flow and manage session state accordingly. 
