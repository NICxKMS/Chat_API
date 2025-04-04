# Codebase Improvement Plan

## Critical Problem Fixes & Streaming Preparation
- [ ] **(Architecture/Maintainability)** Remove hardcoded `/api/models/categories` route from `src/index.js:161-204` and implement logic correctly in `src/controllers/ModelController.js`. *(Addresses incorrect data and inconsistent architecture)*
- [ ] **(Streaming/Architecture)** Modify `src/providers/BaseProvider.js` to add an abstract `chatCompletionStream` method (e.g., using async iterators or callbacks) for streaming responses. *(Essential groundwork for streaming)*
- [ ] **(Streaming/Implementation)** Implement the `chatCompletionStream` method in all concrete provider classes (`src/providers/*Provider.js`) using their respective SDK streaming capabilities. *(Enables streaming per provider)*
- [ ] **(Streaming/Bug)** Remove or conditionally apply the global `compression` middleware (`src/index.js:43-51`) to prevent interference (buffering) with streaming responses. *(Fixes blocker for streaming)*
- [ ] **(Streaming/Bug)** Remove the global `setTimeout` from `src/controllers/ChatController.js:101-108` in the standard `chatCompletion` method, as it's incompatible with potentially long-lived streams. Implement alternative timeout/heartbeat logic specifically for streams if needed. *(Fixes blocker for streaming)*
- [ ] **(Performance/Bug)** Refactor `src/services/ModelClassificationService.js` (`getClassifiedModels`, `getModelsByCriteria`) to accept pre-fetched model data as an argument, eliminating redundant API calls made via `getAllModelsForProto` (`src/services/ModelClassificationService.js:25`). *(Reduces latency and external API load)*

## Performance Optimizations
- [ ] **(Caching)** Investigate replacing `JSON.stringify` with cryptographic hashing (e.g., SHA-256) for generating cache keys from large objects (like `messages`) in `src/utils/cache.js:26` and controller usage (`ChatController.js`, `ModelController.js`). *(Improves CPU efficiency for caching)*
- [ ] **(Resource Management)** Monitor memory usage under load. Consider removing the explicit `global.gc()` call (`src/index.js:144-151`) if V8's default garbage collection proves sufficient, to avoid potential GC pauses.
- [ ] **(gRPC)** Monitor gRPC connection health and error rates (`src/services/ModelClassificationService.js`); consider adding channel readiness checks (`waitForReady`) or more sophisticated client connection management if instability is observed.

## Architectural Improvements & Refinements
- [ ] **(Error Handling)** Enhance the centralized error handler (`src/middleware/errorHandler.js`, `src/index.js:253-260`) for more structured JSON responses, detailed logging (respecting environment), and potentially mapping specific error types to HTTP statuses.
- [ ] **(Error Handling)** Enhance `ChatController.js` non-streaming error handling to map provider-specific errors (e.g., invalid API key, model not found) to appropriate HTTP 4xx/5xx status codes where possible.
- [ ] **(Scalability/Caching)** Evaluate replacing the in-memory cache (`src/utils/cache.js`) with an external, shared cache solution (e.g., Redis, Memcached) if horizontal scaling or cache persistence across restarts is required. Abstract the cache interface if implementing this.
- [ ] **(Configuration)** Implement configuration schema validation (e.g., using `joi` or `zod`) in `src/config/config.js` or at application startup (`src/index.js`) to ensure required environment variables are present and correctly typed, allowing the app to fail fast on configuration errors.
- [ ] **(Metrics)** Review usages of dynamic metric creation (`incrementCounter`, `observeHistogram` in `src/utils/metrics.js`) within provider implementations (`src/providers/*`) to ensure metric names/labels have low cardinality and avoid performance issues in Prometheus.
- [ ] **(Routing)** Consider removing alias routes (`/list`, `/categorized`, etc.) in `src/routes/modelRoutes.js` if they are not strictly needed for backward compatibility, to reduce redundancy.

## Streaming Implementation Plan
- [ ] **(Design)** Choose the specific streaming mechanism (Server-Sent Events (SSE) is recommended for chat unless bi-directional needed) for the `/api/chat/completions` endpoint (or a new dedicated streaming endpoint).
- [ ] **(Implementation)** Update `src/controllers/ChatController.js` to handle streaming requests:
    - Detect streaming intent (e.g., `Accept: text/event-stream` header or a dedicated route).
    - Set appropriate response headers (e.g., `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`).
    - Call the provider's `chatCompletionStream` method.
    - Iterate over the stream results (e.g., `for await...of` if using async iterators) and write formatted chunks (e.g., SSE `data: ...\n\n`) to the `res` object.
    - Ensure the response is correctly ended (`res.end()`) when the stream finishes.
- [ ] **(Error Handling/Streaming)** Implement robust error handling *within* the stream processing logic in `ChatController.js`:
    - Catch errors originating from the provider's stream.
    - Log the error server-side.
    - If headers haven't been sent, use the standard error handler.
    - If headers *have* been sent, attempt to send a formatted error message over the stream (e.g., SSE `event: error\ndata: {"message": "..."}\n\n`).
    - Gracefully close the response stream (`res.end()`).
- [ ] **(Metrics/Streaming)** Enhance metrics collection (`src/index.js` middleware, `src/utils/metrics.js`) to include relevant metrics for streaming interactions, such as Time To First Byte (TTFB) and total stream duration. Differentiate these from standard request response times.
- [ ] **(Testing)** Develop comprehensive functional tests for the streaming chat functionality, covering successful chunk delivery, handling of various provider responses, error conditions (provider errors, network interruptions), and graceful connection closure from both client and server.
- [ ] **(Testing)** Develop performance tests specifically targeting the streaming endpoint to measure TTFB, chunk latency, concurrency handling, and resource utilization under sustained load. 