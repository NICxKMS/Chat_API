/**
 * Main server entry point
 * Sets up Express server with configured routes and middleware
 */
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import routes from "./routes/index.js";
import errorHandler from "./middleware/errorHandler.js";
import rateLimiter from "./middleware/rateLimiter.js";
import config from "./config/config.js";

// Load environment variables from .env file
// // dotenv.config(); // Temporarily commented out for benchmark testing
dotenv.config({ override: false }); // Load .env but don't override existing env vars

// Create Express application
const app = express();
const PORT = process.env.PORT || 3000;

// Apply middleware
app.use(cors());
app.use(helmet()); // Security headers
app.use(compression()); // Compress responses
app.use(express.json({ limit: "2mb" })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: "2mb" })); // Parse URL-encoded bodies

// Apply rate limiting if enabled
if (config.rateLimiting && config.rateLimiting.enabled) {
  app.use(rateLimiter);
}

// Basic health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", version: config.version });
});

// API health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ 
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "Chat API"
  });
});

// Apply API routes
app.use("/api", routes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  // Add any cleanup logic here if needed
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT (Ctrl+C) received, shutting down gracefully");
  // Add any cleanup logic here if needed
  process.exit(0);
});

export default app; 