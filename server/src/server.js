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
// import authRoutesPlugin from "./routes/authRoutes.js"; // Removed
import fastifyErrorHandler from "./middleware/errorHandler.js"; // Added error handler import
import rateLimiterHook from "./middleware/rateLimiter.js"; // Hook import
import config from "./config/config.js";
import admin from "firebase-admin"; // Added Firebase Admin
import logger from "./utils/logger.js"; // Import logger
// import fastifyJwt from '@fastify/jwt'; // Removed

// Load environment variables from .env file
// // dotenv.config(); // Temporarily commented out for benchmark testing
dotenv.config({ override: false }); // Load .env but don't override existing env vars

// Create Fastify application
// const app = express(); // Removed
const fastify = Fastify({ logger: true }); // Added (with logger)
const PORT = process.env.PORT || 3000;

// --- Initialize Firebase Admin SDK --- 
try {
  // Check if GOOGLE_APPLICATION_CREDENTIALS is set
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set. Firebase Admin SDK cannot initialize.');
  }
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    // Optionally add databaseURL if using Realtime Database features
    // databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
  });
  logger.info("Firebase Admin SDK initialized successfully.");
} catch (error) {
  logger.error("Firebase Admin SDK initialization error:", error);
  process.exit(1); // Exit if Firebase Admin fails to initialize
}
// ------------------------------------

// --- Firebase Authentication Hook --- 
async function firebaseAuthHook(request, reply) {
  // Initialize request.user to null for every request
  request.user = null;
  const authHeader = request.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.split('Bearer ')[1];
    try {
      // Verify the ID token using Firebase Admin SDK
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      // Attach decoded user information if token is valid
      request.user = { 
        uid: decodedToken.uid,
        email: decodedToken.email,
        // Add other properties from decodedToken as needed
      }; 
      logger.debug(`Authenticated user via hook: ${request.user.uid}`);
    } catch (error) {
      // Token provided but invalid/expired. Log warning but allow request to proceed
      // The route handler can then check request.user to see if auth succeeded
      logger.warn(`Firebase token verification failed (allowing anonymous access): ${error.message}`, { code: error.code });
      // Optional: Attach error info if needed downstream, but keep user null
      // request.authError = { code: error.code, message: error.message };
    }
  } else {
    // No token provided, proceed as anonymous
    logger.debug('No auth token provided, proceeding as anonymous.');
  }

  // Always return (allow request to proceed)
  return;
}
// ------------------------------------

// Start the server (using async/await)
const start = async () => {
  try {
    // Register essential plugins
    await fastify.register(fastifyCors, {
      // origin: 'http://localhost:3001', // Temporarily commented out
      origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3001', 'http://localhost:3000', 'http://localhost:3002'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization',
        'Accept',
        'Cache-Control',
        'Connection',
        'X-Requested-With',
        'Range'
      ],
      exposedHeaders: ['Content-Length', 'Content-Range', 'Content-Encoding'],
      credentials: true,
      maxAge: 86400 // 24 hours
    });
    await fastify.register(fastifyHelmet, {
        // TODO: Review Helmet options for production.
        // Disabling CSP/COEP might be insecure.
        // Consider default policies or configuring them properly.
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    });
    await fastify.register(fastifyCompress);

    // --- Register Hooks & Auth ---
    // Register JWT Plugin // Removed section
    // await fastify.register(fastifyJwt, {
    //   secret: config.jwtSecret 
    // });

    // Decorate request with an authentication handler method // Removed section
    // fastify.decorate('authenticate', async function(request, reply) {
    //   try {
    //     await request.jwtVerify(); 
    //   } catch (err) {
    //     reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Missing or invalid authentication token.' });
    //   }
    // });

    // Add Rate Limiter Hook
    if (config.rateLimiting?.enabled !== false) {
      fastify.addHook('onRequest', rateLimiterHook);
    }

    // --- Register Route Plugins ---
    // Health check endpoints (can also be moved into a plugin)
    fastify.get("/health", (request, reply) => {
      reply.status(200).send({ status: "OK", version: config.version });
    });
    // fastify.get("/api/health", (request, reply) => {
    //   reply.status(200).send({ status: "ok", timestamp: new Date().toISOString(), service: "Chat API" });
    // });

    // Register Auth routes (unprotected) // Removed
    // await fastify.register(authRoutesPlugin, { prefix: "/api/auth" }); // Removed

    // Register main API plugin (hook now checks auth, doesn't block)
    await fastify.register(mainApiRoutes, { 
        prefix: "/api",
        onRequest: [firebaseAuthHook] // Apply hook to check auth status
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