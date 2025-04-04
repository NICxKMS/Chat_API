# Codebase Improvement Plan

## 1. Critical Problem Fixes & Streaming Preparation
- [ ] **(Architecture/Maintainability):** Remove the hardcoded `/api/models/categories` route in `src/index.js` (lines 161–204) and integrate its logic into `src/controllers/ModelController.js` to ensure consistent and centralized routing logic.
- [ ] **(Streaming/Architecture):** Update `src/providers/BaseProvider.js` by introducing an abstract `chatCompletionStream` method (using async iterators or callbacks) that all provider implementations can adopt for streaming responses.
- [ ] **(Streaming/Implementation):** Implement the new `chatCompletionStream` method in each concrete provider (`src/providers/*Provider.js`) leveraging their SDK’s native streaming capabilities.
- [ ] **(Streaming/Bug Fix):** Remove or conditionally apply the global `compression` middleware in `src/index.js` (lines 43–51) to prevent it from buffering responses and interfering with streaming.
- [ ] **(Streaming/Bug Fix):** Remove the global `setTimeout` from the standard `chatCompletion` method in `src/controllers/ChatController.js` (lines 101–108). Replace it with a streaming-specific timeout/heartbeat mechanism as needed.
- [ ] **(Performance/Bug Fix):** Refactor methods in `src/services/ModelClassificationService.js` (`getClassifiedModels` and `getModelsByCriteria`) to accept pre-fetched model data (from `getAllModelsForProto` at line 25) to eliminate redundant API calls, reducing latency and load.

## 2. Performance Optimizations
- [ ] **(Caching Efficiency):** Replace the use of `JSON.stringify` for generating cache keys in `src/utils/cache.js` (line 26) and relevant controller calls (e.g., in `ChatController.js` and `ModelController.js`) with a more efficient cryptographic hash (e.g., SHA-256) to lower CPU overhead.
- [ ] **(Resource Management):** Monitor memory usage under load and consider removing the explicit `global.gc()` call in `src/index.js` (lines 144–151) if V8’s automatic garbage collection is sufficient, thus avoiding potential GC-induced pauses.
- [ ] **(gRPC Connection Management):** Enhance monitoring of gRPC connections in `src/services/ModelClassificationService.js`. Implement channel readiness checks (e.g., using `waitForReady`) and robust connection management strategies to mitigate instability and error rates.

## 3. Architectural Improvements & Refinements
- [ ] **(Centralized Error Handling):** Improve the centralized error handler (found in `src/middleware/errorHandler.js` and `src/index.js` lines 253–260) to produce structured JSON responses, incorporate detailed logging (environment-aware), and map specific error types to the appropriate HTTP status codes.
- [ ] **(Provider Error Mapping):** Enhance error handling in `ChatController.js` for non-streaming responses by mapping provider-specific errors (e.g., invalid API key or model not found) to suitable HTTP 4xx/5xx statuses.
- [ ] **(Scalable Caching):** Evaluate transitioning from the in-memory cache in `src/utils/cache.js` to an external shared cache (e.g., Redis or Memcached) for scenarios requiring horizontal scaling or cache persistence across application restarts. Abstract the cache interface to allow seamless swapping of cache implementations.
- [ ] **(Configuration Validation):** Implement schema validation for configuration settings (using libraries such as `joi` or `zod`) in `src/config/config.js` or during application startup (in `src/index.js`) to ensure all required environment variables are correctly set.
- [ ] **(Metrics Optimization):** Review dynamic metric creation in `src/utils/metrics.js` (e.g., functions like `incrementCounter` and `observeHistogram` in provider implementations) to ensure metric names and labels have low cardinality, reducing overhead in Prometheus.
- [ ] **(Route Simplification):** Revisit and potentially remove legacy alias routes (e.g., `/list`, `/categorized` in `src/routes/modelRoutes.js`) if they are not needed for backward compatibility, thereby reducing redundancy in route definitions.

## 4. Streaming Implementation Plan
- [ ] **(Streaming Design):** Finalize the choice of streaming mechanism for the `/api/chat/completions` endpoint (SSE is recommended unless bi-directional communication via WebSockets is required). Define clear criteria for detecting streaming intent (e.g., checking the `Accept: text/event-stream` header or using a dedicated route).
- [ ] **(Controller Update):** Modify `src/controllers/ChatController.js` to support streaming:
  - Detect streaming requests.
  - Set appropriate headers (e.g., `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`).
  - Invoke the provider’s `chatCompletionStream` method and iterate over the stream (using `for await...of` for async iterators) to send SSE-formatted data chunks.
  - Ensure proper closure of the response with `res.end()` after streaming completes.
- [ ] **(Stream Error Handling):** Build robust error handling within the streaming logic:
  - Catch and log errors from the provider’s streaming method.
  - If headers have not yet been sent, delegate errors to the centralized error handler; otherwise, send an SSE-formatted error message and gracefully close the stream.
- [ ] **(Streaming Metrics):** Enhance the metrics collection (via middleware in `src/index.js` and functions in `src/utils/metrics.js`) to capture streaming-specific metrics such as Time To First Byte (TTFB) and total stream duration, clearly differentiating these from standard request metrics.
- [ ] **(Testing Streaming):** Develop comprehensive functional tests covering:
  - Successful delivery of data chunks.
  - Various provider streaming responses.
  - Error scenarios (provider failures, network interruptions) and graceful connection closures.
- [ ] **(Performance Testing):** Establish performance tests focused on the streaming endpoint to measure TTFB, chunk latency, concurrency handling, and overall resource utilization under sustained load.

