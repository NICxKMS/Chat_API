**Codebase Improvement & Streaming Implementation Plan**

**Guiding Principles:**
* [ ] **Stability First:** Address critical bugs and architectural flaws that impede core functionality or streaming implementation.
* [ ] **Incremental Progress:** Break down large features (like streaming) into manageable steps.
* [ ] **Maintainability:** Improve code structure, error handling, and configuration for long-term health.
* [ ] **Performance Awareness:** Proactively identify and address performance bottlenecks.
* [ ] **Testability:** Ensure changes are accompanied by appropriate tests.

**Priority Legend:**
* **P1 - Critical:** Must be done. Blockers for stability or core new features (streaming).
* **P2 - High:** Important improvements for performance, robustness, or maintainability. Should be done soon after P1.
* **P3 - Medium:** Valuable refinements or optimizations. Can be scheduled after P1/P2.

---

**Phase 1: Critical Fixes & Streaming Foundation (P1)**

*These items address immediate bugs and lay the essential groundwork for streaming.*

* [x] **[P1]** **(Bug/Architecture)** Refactor Model Route Logic:
    * **Task:** Remove hardcoded `/api/models/categories` logic from `src/index.js:161-204`.
    * **Action:** Implement this logic correctly within `src/controllers/ModelController.js`.
    * **Rationale:** Fixes incorrect data fetching and aligns with proper MVC/controller architecture.
* [x] **[P1]** **(Streaming/Architecture)** Define Streaming Interface:
    * **Task:** Modify `src/providers/BaseProvider.js` to add an abstract `chatCompletionStream` method.
    * **Action:** Use async iterators (`async function* ()`) or a callback-based approach.
    * **Rationale:** Establishes the contract for all providers to support streaming. *Prerequisite for Provider Implementation.*
* [x] **[P1]** **(Streaming/Implementation)** Implement Provider Streaming:
    * **Task:** Implement the `chatCompletionStream` method in *all* concrete provider classes (`src/providers/*Provider.js`).
    * **Action:** Leverage each provider's specific SDK streaming capabilities.
    * **Rationale:** Enables streaming functionality at the provider level. *Depends on P1.2.*
* [x] **[P1]** **(Streaming/Bug)** Resolve Compression Conflict:
    * **Task:** Remove or conditionally disable the global compression middleware (`src/index.js:43-51`).
    * **Action:** Ensure it doesn't buffer/interfere with `text/event-stream` or other streaming responses.
    * **Rationale:** Critical fix; compression middleware often buffers the entire response, breaking streaming.
* [x] **[P1]** **(Streaming/Bug)** Remove Global Chat Timeout:
    * **Task:** Remove the global `setTimeout` from the standard chatCompletion method in `src/controllers/ChatController.js:101-108`.
    * **Action:** Implement alternative timeout/heartbeat logic *specifically for stream handling* if required later (see Phase 2).
    * **Rationale:** Global `setTimeout` is incompatible with potentially long-running streams and will prematurely terminate them.
* [x] **[P1]** **(Performance/Bug)** Optimize Model Classification Calls:
    * **Task:** Refactor `src/services/ModelClassificationService.js` (`getClassifiedModels`, `getModelsByCriteria`).
    * **Action:** Modify functions to accept pre-fetched model data as an argument, eliminating redundant internal `getAllModelsForProto` calls (`src/services/ModelClassificationService.js:25`).
    * **Rationale:** Reduces latency, lowers external API load, and potentially fixes staleness issues.

---

**Phase 2: Streaming Feature Implementation (P1/P2 - Depends on Feature Priority)**

*Builds upon the foundation to deliver the end-to-end streaming feature.*

* [x] **[P1/P2]** **(Streaming/Design)** Choose Streaming Transport: *(Completed via implementation)*
    * **Task:** Decide on the specific mechanism for the streaming chat endpoint (e.g., `/api/chat/completions/stream` or using `Accept` header).
    * **Action:** Server-Sent Events (SSE) is strongly recommended for unidirectional chat streaming. Document the choice.
* [x] **[P1/P2]** **(Streaming/Implementation)** Implement Controller Streaming Logic: *(Completed via [P2] Stream Handling task)*
    * **Task:** Update `src/controllers/ChatController.js` (or create a new method/controller) to handle streaming requests.
    * **Action:**
        * Detect streaming intent (header/route).
        * Set appropriate response headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`).
        * Call the provider's `chatCompletionStream` method.
        * Iterate over results (e.g., `for await...of`) and write formatted chunks (e.g., SSE `data: {...}\n\n`) to the `res` object.
        * Ensure `res.end()` is called correctly upon stream completion or error.
    * **Rationale:** Core implementation of the user-facing streaming endpoint. *Depends on P1.2, P1.3.*
* [x] **[P1/P2]** **(Streaming/Error Handling)** Implement Robust Stream Error Handling:
    * **Task:** Add error handling *within* the stream processing loop in `ChatController.js`.
    * **Action:**
        * Catch provider stream errors.
        * Log errors server-side.
        * If headers not sent, use standard error middleware.
        * If headers *are* sent, attempt to send a formatted error over the stream (e.g., SSE `event: error\ndata: {"message": "..."}\n\n`) before closing.
        * Gracefully close the response (`res.end()`).
    * **Rationale:** Ensures streams terminate cleanly and clients can be notified of issues mid-stream.
* [x] **[P2]** **(Streaming/Metrics)** Enhance Streaming Metrics: *(Completed via [P2] Add Metrics task)*
    * **Task:** Update metrics collection (`src/index.js` middleware, `src/utils/metrics.js`).
    * **Action:** Add metrics specific to streaming: Time To First Byte (TTFB), total stream duration, chunk count/rate. Differentiate from standard request metrics.
    * **Rationale:** Provides visibility into streaming performance characteristics.
* [x] **[P2]** **(Streaming/Endpoint)** Create Streaming Chat Endpoint:
    * **Task:** Add a new route (`POST /api/chat/stream`) in `src/routes/chatRoutes.js`.
    * **Action:** Link it to a new `chatCompletionStream` method in `src/controllers/ChatController.js`.
    * **Rationale:** Dedicated endpoint for streaming requests, separating concerns from non-streaming.
* [x] **[P2]** **(Streaming/Endpoint)** Implement Controller Stream Handling:
    * **Task:** In `src/controllers/ChatController.js` (`chatCompletionStream` method).
    * **Action:** Set correct `text/event-stream` headers, call the provider's `chatCompletionStream`, iterate through the async generator, format chunks as SSE messages (`data: JSON.stringify(chunk)\n\n`), and write to the response. Handle errors appropriately (e.g., write an error event to the stream if possible).
    * **Rationale:** Connects the endpoint to the provider logic and sends data to the client.
* [x] **[P2]** **(Streaming/Robustness)** Add Stream Timeout/Heartbeat:
    * **Task:** Add basic timeout logic to the `chatCompletionStream` method in `src/controllers/ChatController.js`.
    * **Action:** Implement a mechanism (e.g., using `setInterval`) to send periodic heartbeat comments (`:heartbeat\n\n`) and detect if the stream or client connection becomes unresponsive. Close the connection if no data/heartbeat ack is received for a configurable period (e.g., 60 seconds).
    * **Rationale:** Prevents orphaned connections and resource leaks if the client disconnects or the stream stalls indefinitely.
* [x] **[P2]** **(Metrics)** Add Streaming Metrics:
    * **Task:** Update `src/utils/metrics.js` and relevant controller/provider code.
    * **Action:** Add metrics specific to streaming: Time To First Byte (TTFB), total stream duration, chunk count/rate. Differentiate from standard request metrics.
    * **Rationale:** Provides visibility into streaming performance characteristics.

---

**Phase 3: Testing (P1 for Critical Changes, P2 for Others)**

*Essential for verifying correctness and robustness.*

* [ ] **[P1]** **(Testing/Functional)** Test Critical Fixes:
    * **Task:** Add/update tests verifying the fixes from Phase 1 (e.g., model route logic, non-streaming timeout removal impact, classification service optimization).
* [ ] **[P1/P2]** **(Testing/Functional)** Test Streaming Functionality:
    * **Task:** Develop comprehensive functional tests for the streaming chat endpoint.
    * **Action:** Cover successful chunk delivery, various provider responses, error conditions (provider errors, network issues), client/server disconnects, adherence to chosen format (SSE).
* [ ] **[P2]** **(Testing/Performance)** Test Streaming Performance:
    * **Task:** Develop performance tests targeting the streaming endpoint.
    * **Action:** Measure TTFB, chunk latency, concurrency limits, resource usage (CPU/memory) under sustained load.
* [ ] **[P2/P3]** **(Testing/Regression)** Test Non-Streaming Endpoints:
    * **Task:** Ensure existing tests for non-streaming chat and other endpoints pass after all changes.

---

**Phase 4: Refinement & Optimization (P2/P3)**

*Improves overall quality, performance, and maintainability.*

* [x] **[P2]** **(Performance/Caching)** Optimize Cache Key Generation:
    * **Task:** Investigate replacing `JSON.stringify` with cryptographic hashing (e.g., SHA-256) for cache keys.
    * **Action:** Profile the impact, especially for large message payloads in `src/utils/cache.js` and controller usage.
    * **Rationale:** Potential CPU savings during cache key computation.
* [x] **[P2]** **(Error Handling)** Standardize API Error Responses:
    * **Task:** Enhance the centralized error handler (`src/middleware/errorHandler.js`, `src/index.js:253-260`).
    * **Action:** Implement structured JSON error responses (e.g., `{ "error": { "code": "...", "message": "..." } }`), improve detailed logging (respecting `NODE_ENV`), map common error types to appropriate HTTP statuses.
    * **Rationale:** Provides consistent and informative error feedback to clients.
* [x] **[P2]** **(Error Handling)** Improve Controller Error Mapping:
    * **Task:** Refine non-streaming error handling in `ChatController.js`.
    * **Action:** Map provider-specific errors (invalid key, model not found, rate limits) to specific HTTP 4xx/5xx statuses and potentially clearer error messages.
    * **Rationale:** Provide more specific feedback to the client about provider issues.
* [x] **[P2]** **(Configuration)** Add Configuration Validation:
    * **Task:** Implement schema validation for configuration/environment variables.
    * **Action:** Use libraries like `joi` or `zod` in `src/config/config.js` or at app startup (`src/index.js`) to validate presence, types, and potentially formats.
    * **Rationale:** Fail-fast on configuration errors, improving deployment reliability.
* [x] **[P3]** **(Resource Management)** Evaluate Explicit GC Calls:
    * **Task:** Monitor memory usage under load, particularly around the explicit `global.gc()` call (`src/index.js:144-151`).
    * **Action:** Consider removing it if V8's default GC is sufficient, to avoid potential performance stalls caused by forced GC pauses. Requires careful profiling.
    * **Rationale:** Explicit GC can sometimes hinder performance more than help.
* [x] **[P3]** **(gRPC)** Monitor gRPC Stability:
    * **Task:** Monitor gRPC connection health and error rates related to `src/services/ModelClassificationService.js`.
    * **Action:** Consider adding channel readiness checks (`waitForReady`) or more robust connection management/retries if instability is observed.
    * **Rationale:** Improve resilience when communicating with the classification service.
* [x] **[P3]** **(Metrics)** Review Metric Cardinality:
    * **Task:** Review dynamic metric creation (`incrementCounter`, `observeHistogram` in `src/utils/metrics.js`) within provider implementations (`src/providers/*`).
    * **Action:** Ensure label values (like model names, error types) have bounded, low cardinality to prevent Prometheus performance issues.
    * **Rationale:** High cardinality labels can overload Prometheus.
* [-] **[P3]** **(Scalability/Caching)** Evaluate External Cache: *(Deferred)*
    * **Task:** Assess the need for replacing the in-memory cache (`src/utils/cache.js`) with an external solution (Redis, Memcached).
    * **Action:** Implement if horizontal scaling or persistence across restarts is needed. Abstract the cache interface first (`src/utils/cache.js`) to simplify future switching.
    * **Rationale:** In-memory cache doesn't scale horizontally and data is lost on restart.
* [x] **[P3]** **(Routing)** Simplify Model Routes: *(Completed via [P3] Cleanup task)*
    * **Task:** Consider removing alias routes (`/list`, `/categorized`, etc.) in `src/routes/modelRoutes.js`.
    * **Action:** Remove if not required for backward compatibility, reducing route definition redundancy.

### Phase 3: Documentation & Cleanup (P3)
*Final polish and preparation for deployment.*
* [x] **[P3]** **(Docs/Code)** Update Docstrings & Comments: *(Partially Complete - Skipped OpenAIProvider.js)*
    * **Task:** Review and update docstrings (`/** ... */`) and comments in all modified files (`BaseProvider.js`, `*Provider.js`, `ChatController.js`, `ModelController.js`, `index.js`, `chatRoutes.js`, `metrics.js`).
    * **Action:** Ensure comments accurately reflect the new streaming logic, parameters, return types (especially `async function*`), and rationales. Add comments where streaming logic is complex.
    * **Rationale:** Improves code maintainability and understanding.
* [x] **[P3]** **(Docs)** Update README.md:
    * **Task:** Update `README.md` with information about the new streaming endpoint (`/api/chat/stream`), its usage (SSE), and any relevant configuration changes.
    * **Action:** Add a section detailing streaming functionality.
    * **Rationale:** Ensures documentation reflects current API capabilities.
* [x] **[P3]** **(Cleanup)** Remove Unused Code/Aliases:
    * **Task:** Consider removing alias routes (`/list`, `/categorized`, etc.) in `src/routes/modelRoutes.js`.
    * **Action:** Remove if not required for backward compatibility, reducing route definition redundancy.
    * **Rationale:** Simplifies routing table.