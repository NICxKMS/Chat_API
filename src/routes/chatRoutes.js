/**
 * Chat Routes
 * Defines endpoints for chat-related operations
 */
const express = require('express');
const chatController = require('../controllers/ChatController');

const router = express.Router();

// POST /chat/completions - Non-streaming chat completion
router.post('/completions', chatController.chatCompletion);

// POST /chat/completions/stream - Streaming chat completion
router.post('/completions/stream', chatController.streamChatCompletion);

// GET /chat/completions/stream - Streaming chat completion (GET for easier testing)
router.get('/completions/stream', chatController.streamChatCompletion);

// GET /chat/capabilities - Get chat capabilities and system status
router.get('/capabilities', chatController.getChatCapabilities);

module.exports = router;