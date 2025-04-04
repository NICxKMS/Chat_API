/**
 * Chat Routes
 * Routes for the chat API endpoints
 */
import express from "express";
import chatController from "../controllers/ChatController.js";
import cors from "cors";

const router = express.Router();

// Handle CORS preflight requests specifically for chat endpoints if needed,
// although the global CORS middleware in index.js might suffice.
router.options(["/completions", "/stream"], (req, res) => { // Apply OPTIONS to both chat endpoints
  // Get the requesting origin or use a wildcard
  const origin = req.headers.origin || "*";
  
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); // Methods allowed for chat
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours
  res.setHeader("Cache-Control", "no-cache");
  res.sendStatus(204);
});

/**
 * POST /api/chat/completions
 * Endpoint for standard (non-streaming) chat completion requests.
 * Delegates handling to `chatController.chatCompletion`.
 */
router.post("/completions", chatController.chatCompletion);

/**
 * POST /api/chat/stream
 * Endpoint for streaming chat completion requests using Server-Sent Events (SSE).
 * Delegates handling to `chatController.chatCompletionStream`.
 */
router.post("/stream", chatController.chatCompletionStream);

// GET /chat/capabilities - Get chat capabilities and system status
router.get("/capabilities", chatController.getChatCapabilities);

// Export router for use in main application
export default router;