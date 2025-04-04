/**
 * Main API Routes Plugin
 * Combines all API routes and registers them under a common prefix.
 */
// import express from "express"; // Removed
import modelRoutesPlugin from "./modelRoutes.js";
import chatRoutesPlugin from "./chatRoutes.js";
// Import config or package.json directly if needed for version
// import config from "../config/config.js"; 
// import pkg from '../../package.json' assert { type: 'json' }; // Example for package.json

// Fastify Plugin function
async function mainApiRoutes (fastify, options) {

  // Status endpoint for API health check
  fastify.get("/status", (request, reply) => {
    reply.send({
      status: "ok",
      timestamp: new Date().toISOString()
    });
  });

  // Version info route
  fastify.get("/version", (request, reply) => {
    // Reading package.json version might require different import methods depending on Node version/setup
    // Using process.env is often simpler if available
    reply.send({
      version: process.env.npm_package_version || "1.0.0", 
      apiVersion: "v1",
      timestamp: new Date().toISOString()
    });
  });

  // Register nested route plugins
  await fastify.register(modelRoutesPlugin, { prefix: "/models" });
  await fastify.register(chatRoutesPlugin, { prefix: "/chat" });

}

// export default router; // Removed
export default mainApiRoutes; // Export the plugin function