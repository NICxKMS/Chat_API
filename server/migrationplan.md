# ✅ Phase 1: Express.js Codebase Audit & Migration Checklist

## 🚀 Core Application Setup

-   [x] **File:** `src/server.js` (Lines: 18-63)
    -   **Description:** Main application entry point. Initializes `express()`, applies global middleware (`cors`, `helmet`, `compression`, `express.json`, `express.urlencoded`, custom `rateLimiter`), mounts API routes (`/api`), defines health checks (`/health`, `/api/health`), registers global error handler (`errorHandler`), and starts server (`app.listen`).
    -   **Complexity:** Medium
    -   **Pattern:** Global Error Handler, Global Middleware Application
    -   **Test Impact:** Yes
-   [x] **File:** `src/app.js` (Lines: 3-13) // Deleted as unused
    -   **Description:** Creates a separate `express()` instance and defines `/api/health`. Appears unused by `server.js` but might be for tests or other purposes. (Migration priority: Low, potentially delete if unused).
    -   **Complexity:** Low
    -   **Test Impact:** Unknown

## 📁 Routers (`express.Router`)

-   [x] **File:** `src/routes/index.js` (Lines: 8-28)
    -   **Description:** Aggregates `modelRoutes` and `chatRoutes` under `/api`. Defines `/status` and `/version` routes directly. Uses `express.Router()`.
    -   **Complexity:** Low
    -   **Test Impact:** Yes
-   [x] **File:** `src/routes/modelRoutes.js` (Lines: 8-36)
    -   **Description:** Defines 6 GET routes for model information using `express.Router()` and delegates to `ModelController`.
    -   **Complexity:** Low
    -   **Test Impact:** Yes
-   [x] **File:** `src/routes/chatRoutes.js` (Lines: 9-43)
    -   **Description:** Defines 2 POST (`/completions`, `/stream`) and 1 GET (`/capabilities`) routes using `express.Router()`, delegates to `ChatController`. Includes explicit `router.options` handler for CORS preflight.
    -   **Complexity:** Low (Router definition), Medium (Handler complexity)
    -   **Test Impact:** Yes

## 🧩 Middleware

### Built-in

-   [x] **File:** `src/server.js` (Line: 28)
    -   **Description:** `express.json({ limit: "2mb" })` middleware for parsing JSON request bodies.
    -   **Complexity:** Low
    -   **Pattern:** Built-in Middleware
    -   **Test Impact:** No (if Fastify equivalent used correctly)
-   [x] **File:** `src/server.js` (Line: 29)
    -   **Description:** `express.urlencoded({ extended: true, limit: "2mb" })` middleware for parsing URL-encoded request bodies.
    -   **Complexity:** Low
    -   **Pattern:** Built-in Middleware
    -   **Test Impact:** No (if Fastify equivalent used correctly)

### Third-Party

-   [x] **File:** `src/server.js` (Line: 25)
    -   **Description:** `cors()` middleware (global usage).
    -   **Complexity:** Low
    -   **Dependency:** `cors`
    -   **Test Impact:** No (if replaced with `fastify-cors`)
-   [x] **File:** `src/routes/chatRoutes.js` (Lines: 12-23)
    -   **Description:** Explicit OPTIONS handler using `res.setHeader` for CORS preflight on specific routes. May be redundant with global `cors`.
    -   **Complexity:** Low
    -   **Dependency:** `cors` (potentially, or just standard headers)
    -   **Test Impact:** No (if replaced/handled by `fastify-cors`)
-   [x] **File:** `src/server.js` (Line: 26)
    -   **Description:** `helmet()` middleware for security headers.
    -   **Complexity:** Low
    -   **Dependency:** `helmet`
    -   **Test Impact:** No (if replaced with `fastify-helmet`)
-   [x] **File:** `src/server.js` (Line: 27)
    -   **Description:** `compression()` middleware for response compression.
    -   **Complexity:** Low
    -   **Dependency:** `compression`
    -   **Test Impact:** No (if replaced with `fastify-compress`)

### Custom

-   [ ] **File:** `src/middleware/errorHandler.js` (Lines: 30-75)
    -   **Description:** Custom global error handler using `(err, req, res, next)` signature. Sends standardized JSON errors.
    -   **Complexity:** Medium
    -   **Pattern:** Custom Error Handler
    -   **Test Impact:** Yes
-   [ ] **File:** `src/middleware/rateLimiter.js` (Lines: 26-69)
    -   **Description:** Custom rate limiting middleware using `rate-limiter-flexible`. Modifies `res` headers, uses `req.ip` and potentially `req.user`, calls `next()`.
    -   **Complexity:** Medium
    -   **Dependency:** `rate-limiter-flexible`
    -   **Pattern:** Custom Middleware, `res` modification, `req.user` usage (implies auth middleware elsewhere?)
    -   **Test Impact:** Yes

## 🔄 Route Handlers & Specific Patterns

-   [x] **File:** `src/controllers/ChatController.js` (Lines: 25-227)
    -   **Description:** Standard `chatCompletion` handler using `(req, res, next)`. Relies on `req.body`, `res.status().json()`, and `next(err)`.
    -   **Complexity:** Medium
    -   **Pattern:** `req`/`res`/`next` usage, `res.status().json()`, `next(err)`
    -   **Test Impact:** Yes
-   [x] **File:** `src/controllers/ChatController.js` (Lines: 229-438)
    -   **Description:** Handles SSE endpoint (`/chat/stream`) using `res.setHeader()`, `res.flushHeaders()`, `res.write()`, `res.end()`, `req.on('close')`. Implements custom heartbeats and timeouts. Handles errors internally for streaming responses.
    -   **Complexity:** High
    -   **Streaming:** Yes
    -   **Pattern:** SSE, `res.write()`, `res.setHeader()`, `res.flushHeaders()`, `res.end()`, Manual Connection Management
    -   **Test Impact:** Yes
-   [x] **File:** `src/controllers/ModelController.js` (Multiple Methods)
    -   **Description:** Various handlers (`getAllModels`, `getProviderModels`, etc.) using standard `(req, res)`. Relies on `req.params`, `res.json()`, `res.status().json()`. No complex patterns detected.
    -   **Complexity:** Low
    -   **Pattern:** `req`/`res` usage, `res.json()`, `res.status().json()`
    -   **Test Impact:** Yes
-   [x] **File:** `src/server.js` (Lines: 37-49) & `src/routes/index.js` (Lines: 11-17, 23-29) **(server.js routes migrated)**
    -   **Description:** Simple inline route handlers for health checks, status, and version using `(req, res) => res.json(...)` or `res.status().json(...)`.
    -   **Complexity:** Low
    -   **Test Impact:** Yes

## 📦 Express-Specific Dependencies (`package.json`)

-   [x] **Dependency:** `express` (Version: ^4.21.2)
    -   **Description:** Core Express framework. Needs complete replacement by Fastify.
    -   **Complexity:** High (Core)
    -   **Test Impact:** Yes
-   [x] **Dependency:** `cors` (Version: ^2.8.5)
    -   **Description:** Standard CORS middleware. Replace with `fastify-cors`.
    -   **Complexity:** Low
    -   **Test Impact:** No
-   [x] **Dependency:** `helmet` (Version: ^8.1.0)
    -   **Description:** Security headers middleware. Replace with `fastify-helmet`.
    -   **Complexity:** Low
    -   **Test Impact:** No
-   [x] **Dependency:** `compression` (Version: ^1.7.4)
    -   **Description:** Response compression middleware. Replace with `fastify-compress`.
    -   **Complexity:** Low
    -   **Test Impact:** No
-   [x] **DevDependency:** `@types/express` (Version: ^4.17.21)
    -   **Description:** TypeScript definitions for Express. Replace with `@types/node` (for Fastify's core Node types) and specific Fastify plugin types.
    -   **Complexity:** Low
    -   **Test Impact:** Yes (for TS projects)
-   [x] **DevDependency:** `@types/cors` (Version: ^2.8.17)
    -   **Description:** TypeScript definitions for CORS. Replace with types from `fastify-cors`.
    -   **Complexity:** Low
    -   **Test Impact:** Yes (for TS projects)
-   [x] **DevDependency:** `@types/helmet` (Version: ^0.0.48)
    -   **Description:** TypeScript definitions for Helmet. Replace with types from `fastify-helmet`.
    -   **Complexity:** Low
    -   **Test Impact:** Yes (for TS projects)
-   [x] **DevDependency:** `@types/compression` (Version: ^1.7.5)
    -   **Description:** TypeScript definitions for Compression. Replace with types from `fastify-compress`.
    -   **Complexity:** Low
    -   **Test Impact:** Yes (for TS projects)

## 🧪 Testing Setup

-   [x] **File:** `package.json` (script: `test`) // Script exists but is placeholder
    -   **Description:** Currently shows `"echo "Error: no test specified" && exit 1"`. No active test setup detected using common Express testing libraries like `supertest`. If tests exist elsewhere (e.g., using Postman, external scripts), they will need adapting to Fastify's structure and potentially different port/response formats.
    -   **Complexity:** Low (based on current script), Potentially High (if external tests exist)
    -   **Test Impact:** Yes (if tests are added or exist externally)

## ⚙️ Configuration & Deployment

-   [x] **Files:** `.env`, `.env.example`, `.env.local`, `src/config/config.js` // No changes needed
    -   **Description:** Standard environment variable usage via `dotenv`. No obvious Express-specific configurations found in filenames, but `src/config/config.js` should be checked for any hardcoded Express assumptions (though none were apparent from middleware usage). Rate limiter config is read here.
    -   **Complexity:** Low
    -   **Test Impact:** No
-   [x] **File:** `docker-compose.yml`, `Dockerfile` (if exists) // No changes needed for basic run
    -   **Description:** `docker-compose.yml` exists. Need to check if it or any associated `Dockerfile` relies on Express-specific commands, ports (though port is configurable), or environment variables during build or runtime. Likely only needs port mapping updates.
    -   **Complexity:** Low
    -   **Test Impact:** No

---

## 📊 Summary & Next Steps

*   **Total Items:** 24 checklist items identified.
*   **Complexity Highlights:**
    *   **High:** Core `express` replacement, migrating the SSE streaming logic in `ChatController.js`.
    *   **Medium:** Migrating custom middleware (`errorHandler`, `rateLimiter`), standard `chatCompletion` handler, core app setup in `server.js`.
    *   **Low:** Replacing third-party middleware (cors, helmet, compression), migrating routers and simple route handlers, updating dependencies.
*   **Potential Blockers:** The SSE streaming implementation requires careful translation to Fastify's request/response lifecycle and potentially different stream handling APIs. Ensuring the custom error handler and rate limiter integrate correctly with Fastify's hook system will be important.
*   **Quick Wins:** Replacing `cors`, `helmet`, and `compression` middleware with their Fastify equivalents (`fastify-cors`, `fastify-helmet`, `fastify-compress`) is usually straightforward. Migrating the simple routers (`modelRoutes.js`, parts of `index.js`) is also relatively low effort.
*   **Suggested Migration Order (Initial Chunks):**
    1.  **Dependencies:** Update `package.json` - remove Express deps, add Fastify core and equivalent middleware plugin dependencies (`fastify`, `fastify-cors`, `fastify-helmet`, `fastify-compress`).
    2.  **Core Setup:** Replace `express()` with `fastify()` in `src/server.js`. Adapt basic server instantiation and `listen()`.
    3.  **Third-Party Middleware:** Register `fastify-cors`, `fastify-helmet`, `fastify-compress` in `src/server.js`. Remove `express.json` and `express.urlencoded` (Fastify handles this by default).
    4.  **Simple Routes:** Migrate the basic health/status/version routes defined directly in `src/server.js` and `src/routes/index.js`.
*   **Relative Effort Estimate:** Medium. The core replacement is significant, and the streaming endpoint adds complexity. However, much of the routing and basic middleware is standard and has direct Fastify equivalents.

📌 **End of Phase 1 Analysis & Transition**