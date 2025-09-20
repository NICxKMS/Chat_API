/**
 * Message Processing Utilities
 * Centralized utilities for handling message content, validation, and transformation
 */

/**
 * Validate message content and extract text
 * @param {string|Array} message - Message content (string or array of parts)
 * @returns {Object} - Validation result with content and validity
 */
export const validateMessageContent = (message) => {
  if (!message) {
    return { isValid: false, content: '', reason: 'Empty message' };
  }
  
  let textContent = '';
  
  if (Array.isArray(message)) {
    // Handle array format (multi-part messages with text/images)
    textContent = message
      .filter(part => part.type === 'text')
      .map(part => part.text || '')
      .join(' ')
      .trim();
    
    if (!textContent) {
      return { isValid: false, content: '', reason: 'No text content in message parts' };
    }
  } else if (typeof message === 'string') {
    textContent = message.trim();
    if (!textContent) {
      return { isValid: false, content: '', reason: 'Empty string message' };
    }
  } else {
    return { isValid: false, content: '', reason: 'Invalid message format' };
  }
  
  return { isValid: true, content: textContent };
};

/**
 * Process message content and separate text from images
 * @param {string|Array} content - Message content
 * @returns {Object} - Processed content with images and text separated
 */
export const processMessageContent = (content) => {
  if (!content) return { images: [], text: '' };
  
  if (Array.isArray(content)) {
    const { images, texts } = content.reduce(
      (acc, part) => {
        if (part.type === 'image_url') {
          acc.images.push({
            url: part.image_url.url,
            alt: part.image_url.alt || part.alt || null
          });
        } else if (part.type === 'text') {
          acc.texts.push(part.text || '');
        }
        return acc;
      },
      { images: [], texts: [] }
    );
    return { images, text: texts.join(' ').trim() };
  }
  
  return { images: [], text: typeof content === 'string' ? content.trim() : '' };
};

/**
 * Find message by unique identifier with fallback matching
 * @param {Array} messages - Array of messages to search
 * @param {Object} targetMessage - Message object with identifiers
 * @returns {number} - Index of found message or -1 if not found
 */
export const findMessageIndex = (messages, targetMessage) => {
  if (!messages || !Array.isArray(messages) || !targetMessage) {
    return -1;
  }
  
  const targetId = targetMessage.uniqueId || targetMessage.id || targetMessage.timestamp;
  
  return messages.findIndex(msg => {
    // Try unique identifiers first
    if (targetId && [msg.uniqueId, msg.id, msg.timestamp].includes(targetId)) {
      return true;
    }
    
    // Fallback to content matching for user messages
    if (
      targetMessage.role === 'user' && 
      msg.role === 'user' &&
      typeof msg.content === 'string' && 
      typeof targetMessage.content === 'string' &&
      msg.content === targetMessage.content
    ) {
      return true;
    }
    
    return false;
  });
};

/**
 * Prepare message for submission with unique ID
 * @param {string|Array} message - Message content
 * @param {string} uniqueId - Unique identifier for the message
 * @returns {Object|Array} - Formatted message with unique ID
 */
export const prepareMessageForSubmission = (message, uniqueId) => {
  if (Array.isArray(message)) {
    return message.map(part => ({ ...part, uniqueId }));
  } else {
    return { type: 'text', text: message, uniqueId };
  }
};

/**
 * Extract content from streaming chunk
 * @param {Object} chunk - Streaming chunk data
 * @returns {string} - Extracted content or empty string
 */
export const extractChunkContent = (chunk) => {
  if (!chunk) return '';
  
  let content = chunk.content;
  
  // Try different content paths
  if (content == null) content = chunk.delta?.content;
  if (content == null) content = chunk.choices?.[0]?.delta?.content;
  if (content == null) {
    const parts = chunk.raw?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      content = parts.map(p => p?.text || '').join('');
    }
  }
  if (content == null) content = chunk.text;
  
  return typeof content === 'string' ? content : '';
};

/**
 * Normalize usage metadata from different providers
 * @param {Object} chunk - Streaming chunk with usage data
 * @returns {Object|null} - Normalized usage object or null
 */
export const normalizeUsageMetadata = (chunk) => {
  if (!chunk) return null;
  
  // Try standard usage field first
  if (chunk.usage) {
    return chunk.usage;
  }
  
  // Try raw usage metadata (Gemini)
  if (chunk.raw?.usageMetadata) {
    const metadata = chunk.raw.usageMetadata;
    return {
      prompt_tokens: metadata.promptTokenCount || 0,
      completion_tokens: metadata.candidatesTokenCount || 0,
      total_tokens: metadata.totalTokenCount || 0
    };
  }
  
  return null;
};

/**
 * Check if message is final chunk in stream
 * @param {Object} chunk - Streaming chunk data
 * @returns {boolean} - Whether this is the final chunk
 */
export const isFinalChunk = (chunk) => {
  if (!chunk) return false;
  
  // Common indicators of final chunk
  return !!(
    chunk.isDone ||
    chunk.isFinalChunk ||
    (chunk.id && chunk.model && chunk.usage) ||
    chunk.finishReason ||
    chunk.finish_reason
  );
};
