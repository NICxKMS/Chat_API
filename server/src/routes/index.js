/**
 * Routes index
 * Combines all API routes into a single router
 */
import express from "express";
import modelRoutes from "./modelRoutes.js";
import chatRoutes from "./chatRoutes.js";

const router = express.Router();

// Status endpoint for API health check
router.get("/status", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

// Apply API routes
router.use("/models", modelRoutes);
router.use("/chat", chatRoutes);

// Version info route
router.get("/version", (req, res) => {
  res.json({
    version: process.env.npm_package_version || "1.0.0",
    apiVersion: "v1",
    timestamp: new Date().toISOString()
  });
});

export default router;