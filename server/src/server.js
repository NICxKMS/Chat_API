/**
 * Main server entry point
 * Sets up Fastify server with configured routes and middleware
 */
import dotenv from "dotenv";
import Fastify from "fastify";
// import cors from "cors"; // Replaced by @fastify/cors
// import helmet from "helmet"; // Replaced by @fastify/helmet
// import compression from "compression"; // Replaced by @fastify/compress
import fastifyCors from "@fastify/cors"; // Added
import fastifyHelmet from "@fastify/helmet"; // Added
import fastifyCompress from "@fastify/compress"; // Added
import mainApiRoutes from "./routes/index.js"; // Main plugin
// import modelRoutesPlugin from "./routes/modelRoutes.js"; // Removed - Registered inside mainApiRoutes
// import chatRoutesPlugin from "./routes/chatRoutes.js"; // Removed - Registered inside mainApiRoutes
import authRoutesPlugin from "./routes/authRoutes.js"; // Added
import fastifyErrorHandler from "./middleware/errorHandler.js"; // Added error handler import
import rateLimiterHook from "./middleware/rateLimiter.js"; // Hook import
import config from "./config/config.js";
import fastifyJwt from '@fastify/jwt'; // Added

// Load environment variables from .env file
// // dotenv.config(); // Temporarily commented out for benchmark testing
dotenv.config({ override: false }); // Load .env but don't override existing env vars

// Create Fastify application
// const app = express(); // Removed
const fastify = Fastify({ logger: true }); // Added (with logger)
const PORT = process.env.PORT || 3000;

// Start the server (using async/await)
const start = async () => {
  try {
    // Register essential plugins
    await fastify.register(fastifyCors, { origin: true });
    await fastify.register(fastifyHelmet, {
        // TODO: Review Helmet options for production.
        // Disabling CSP/COEP might be insecure.
        // Consider default policies or configuring them properly.
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    });
    await fastify.register(fastifyCompress);

    // --- Register Hooks & Auth ---
    // Register JWT Plugin
    await fastify.register(fastifyJwt, {
      secret: config.jwtSecret 
    });

    // Decorate request with an authentication handler method
    fastify.decorate('authenticate', async function(request, reply) {
      try {
        await request.jwtVerify(); // Verifies token and attaches payload to request.user
      } catch (err) {
        // Send appropriate unauthorized response
        reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Missing or invalid authentication token.' });
      }
    });

    // Add Rate Limiter Hook
    if (config.rateLimiting?.enabled !== false) {
      fastify.addHook('onRequest', rateLimiterHook);
    }
    // TODO: Add other hooks like authentication here // No longer needed, authenticate is a decorator

    // --- Register Route Plugins ---
    // Health check endpoints (can also be moved into a plugin)
    fastify.get("/health", (request, reply) => {
      reply.status(200).send({ status: "OK", version: config.version });
    });
    fastify.get("/api/health", (request, reply) => {
      reply.status(200).send({ status: "ok", timestamp: new Date().toISOString(), service: "Chat API" });
    });

    // Register Auth routes (unprotected)
    await fastify.register(authRoutesPlugin, { prefix: "/api/auth" });

    // Register main API plugin (protected)
    await fastify.register(mainApiRoutes, { 
        prefix: "/api",
        onRequest: [fastify.authenticate] // Apply auth hook here
    });

    // --- Register Error Handler ---
    fastify.setErrorHandler(fastifyErrorHandler);

    // --- Start Server ---
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    // Logger automatically logs listen address
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Handle graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach(signal => {
  process.on(signal, async () => {
    fastify.log.info(`${signal} received, shutting down gracefully`);
    await fastify.close(); // Close the Fastify server
    // Add any other cleanup logic here if needed
    fastify.log.info("Server closed.");
    process.exit(0);
  });
});

start();

// export default app; // Removed 