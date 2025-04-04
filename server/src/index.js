// Load environment variables first, before any other imports
import dotenv from "dotenv";
dotenv.config();

// --- Environment Variable Validation ---
import { z } from "zod";

// Define the schema for expected environment variables
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().positive().int().optional().default(3000),
  // Provider API Keys (optional, depends on which providers are enabled/used)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(), // Could also be JWT format
  // Cache settings
  CACHE_ENABLED: z.enum(["true", "false"]).optional().default("true"),
  MAX_REQUEST_SIZE: z.string().optional().default("1mb"), // e.g., '1mb', '500kb'
  // Classification Service (Optional)
  USE_CLASSIFICATION_SERVICE: z.enum(["true", "false"]).optional().default("false"),
  CLASSIFICATION_SERVER_HOST: z.string().optional().default("localhost"),
  CLASSIFICATION_SERVER_PORT: z.coerce.number().positive().int().optional().default(8080),
  // Other optional settings
  ENABLE_HTTP2: z.enum(["true", "false"]).optional().default("false"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "http", "verbose", "debug", "silly"]).optional().default("info"),
});

try {
  // Validate process.env against the schema
  envSchema.parse(process.env);
  console.log("Environment variables validated successfully.");
} catch (error) {
  console.error("❌ Invalid environment variables:", error.format());
  process.exit(1); // Exit if validation fails
}
// --- End Environment Variable Validation ---

// Now import the rest of the modules
import express from "express";
import cors from "cors";
import compression from "compression";
import fs from "fs";
import path from "path";
import spdy from "spdy"; // HTTP/2 support

// Import routes
import modelRoutes from "./routes/modelRoutes";
import chatRoutes from "./routes/chatRoutes";

// Import utilities
import * as metrics from "./utils/metrics";
import * as cache from "./utils/cache";
// Import the centralized error handler
import errorHandler from "./middleware/errorHandler.js"; 

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// --- Core Middlewares ---

// Enable CORS for all origins
app.use(cors());

// Parse JSON request bodies with size limit
app.use(express.json({ limit: process.env.MAX_REQUEST_SIZE || "1MB" }));

/**
 * Compression Middleware Configuration.
 * Enables Gzip compression for responses but explicitly disables it for Server-Sent Events (SSE)
 * to prevent buffering issues that break streaming.
 */
app.use(compression({
  filter: (req, res) => {
    // Disable compression for Server-Sent Events (SSE) content type
    if (res.getHeader("Content-Type") === "text/event-stream") {
      return false; // Must return false to disable compression
    }
    
    // Allow disabling compression via request header
    if (req.headers["x-no-compression"]) {
      return false;
    }
    
    // Otherwise, use the default filter behavior provided by the compression library
    return compression.filter(req, res);
  },
  level: 6 // Balance between compression ratio and CPU usage
}));

// --- Monitoring & Metrics Middlewares ---

/**
 * Basic Request Metrics Middleware.
 * Increments total request count and records response time histogram.
 * Also tracks request counts per provider/model based on request path/body.
 */
app.use((req, res, next) => {
  // Track total request count
  metrics.incrementRequestCount();
  
  // Measure response time
  const startTime = process.hrtime();
  
  // When response finishes
  res.on("finish", () => {
    // Calculate response time
    const duration = process.hrtime(startTime);
    const responseTimeMs = (duration[0] * 1000) + (duration[1] / 1000000);
    
    // Record response time
    metrics.recordResponseTime(responseTimeMs / 1000); // Convert to seconds for histogram
    
    // Get provider and model from request (if applicable)
    const provider = (req.body?.provider || req.query?.provider || "unknown");
    const model = (req.body?.model || req.query?.model || "unknown");
    
    // Record provider request (if applicable)
    if (req.path.includes("/api/chat") || req.path.includes("/api/models")) {
      metrics.incrementProviderRequestCount(
        provider,
        model,
        res.statusCode.toString()
      );
    }
  });
  
  next();
});

/**
 * Memory Usage Monitoring Middleware.
 * Logs a warning and records metrics if heap usage exceeds a threshold.
 */
app.use((req, res, next) => {
  const memUsage = process.memoryUsage();
  
  // Log warning if memory usage is high (e.g., > 500MB)
  if (memUsage.heapUsed > 500 * 1024 * 1024) { 
    console.warn("High memory usage detected", {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      endpoint: req.originalUrl
    });
    
    // Record in metrics
    metrics.memoryGauge.labels("heapUsed").set(memUsage.heapUsed);
  }
  
  next();
});

/**
 * Periodic Memory Cleanup Middleware.
 * Logs memory stats and suggests garbage collection if usage is high.
 * Runs checks periodically (e.g., every 5 minutes).
 */
let lastMemoryCleanup = Date.now();
app.use((req, res, next) => {
  const currentTime = Date.now();
  
  // Check memory usage periodically (every 5 minutes)
  if (currentTime - lastMemoryCleanup > 5 * 60 * 1000) {
    lastMemoryCleanup = currentTime;
    
    // Log current memory usage
    const memUsage = process.memoryUsage();
    console.log("Memory usage stats:", {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
    });
    
    // Record in metrics
    metrics.memoryGauge.labels("heapUsed").set(memUsage.heapUsed);
    metrics.memoryGauge.labels("heapTotal").set(memUsage.heapTotal);
    metrics.memoryGauge.labels("rss").set(memUsage.rss);
  }
  
  next();
});

// --- Routing ---
app.use("/api/models", modelRoutes);
app.use("/api/chat", chatRoutes);

// --- Standard Endpoints ---

/**
 * Health Check Endpoint.
 * Provides basic status, uptime, memory, CPU (if available), and cache stats.
 */
app.get("/health", (req, res) => {
  // Get memory usage data
  const memUsage = process.memoryUsage();
  
  // Get CPU usage (from metrics if available)
  const cpuUsage = metrics.getCpuUsage ? metrics.getCpuUsage() : undefined;
  
  // Get cache stats
  const cacheStats = cache.getStats ? cache.getStats() : undefined;
  
  // Return health data
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024)
    },
    cpu: cpuUsage,
    cache: cacheStats,
    environment: process.env.NODE_ENV || "development"
  });
});

/**
 * Prometheus Metrics Endpoint.
 * Exposes metrics collected by the `prom-client` registry.
 */
app.get("/metrics", (req, res) => {
  res.set("Content-Type", metrics.register.contentType);
  metrics.register.metrics().then(data => res.end(data));
});

// --- Error Handling ---

// Catch-all for 404 Not Found errors.
// Creates an error object and passes it to the next middleware (the errorHandler).
app.use((req, res, next) => {
  const err = new Error(`Not Found: The requested path ${req.originalUrl} does not exist.`);
  err.status = 404;
  err.name = "NotFoundError"; // Ensure name is set for mapping in errorHandler
  next(err); // Pass the error to the centralized handler
});

// Register the centralized error handler middleware.
// IMPORTANT: This MUST be the last middleware registered with app.use()
app.use(errorHandler);

// --- Server Start ---

// Start HTTP/2 or HTTP server based on environment configuration
if (process.env.ENABLE_HTTP2 === "true") {
  // Setup HTTP/2 server with SSL certificates
  const options = {
    key: fs.readFileSync(path.join(__dirname, "../certs/server.key")),
    cert: fs.readFileSync(path.join(__dirname, "../certs/server.crt"))
  };
  
  spdy.createServer(options, app).listen(PORT, () => {
    console.log(`HTTP/2 Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });
} else {
  // Start standard HTTP/1.1 server
  app.listen(PORT, () => {
    console.log(`HTTP Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

export default app; 