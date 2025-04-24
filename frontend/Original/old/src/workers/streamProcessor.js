/* eslint-disable no-restricted-globals */

// streamProcessor.js
// Web Worker to parse SSE streaming chunks into content + tokenCount

self.onmessage = ({ data: chunk }) => {
  // data is the raw chunk string from fetch streams
  const messages = [];
  const parts = chunk.split('\n\n');

  for (const part of parts) {
    if (!part.trim()) continue;
    if (part.startsWith(':heartbeat')) continue;
    if (part.startsWith('data:')) {
      const payload = part.slice(5).trim();
      if (payload === '[DONE]') {
        messages.push({ isDone: true });
      } else {
        try {
          const parsed = JSON.parse(payload);
          const content = parsed.content || '';
          const tokenCount = content.split(/\s+/).filter(Boolean).length;
          messages.push({ content, tokenCount });
        } catch (e) {
          // ignore parse errors
        }
      }
    }
  }

  // Send parsed messages back to main thread
  self.postMessage(messages);
}; 