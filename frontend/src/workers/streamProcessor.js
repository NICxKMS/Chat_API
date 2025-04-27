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
          
          // Check if this is the final chunk with complete metadata
          // Look for the specific format from the example
          const isFinalChunk = parsed.id && parsed.model && parsed.usage;
          
          const content = parsed.content || '';
          
          // Extract token details if available
          let tokenInfo = null;
          
          if (parsed.usage) {
            // Direct match to the provided example
            tokenInfo = {
              promptTokens: parsed.usage.promptTokens,
              completionTokens: parsed.usage.completionTokens,
              totalTokens: parsed.usage.totalTokens
            };
            // console.log("[WORKER] Found usage data:", tokenInfo);
          } else if (parsed.raw?.usageMetadata) {
            tokenInfo = {
              promptTokens: parsed.raw.usageMetadata.promptTokenCount,
              completionTokens: parsed.raw.usageMetadata.candidatesTokenCount,
              totalTokens: parsed.raw.usageMetadata.totalTokenCount
            };
            console.log("[WORKER] Found raw.usageMetadata:", tokenInfo);
          }
          
          // Fallback token count calculation if no detailed info
          const tokenCount = content.split(/\s+/).filter(Boolean).length;
          
          messages.push({ 
            content, 
            tokenCount,
            tokenInfo,
            finishReason: parsed.finishReason,
            model: parsed.model,
            provider: parsed.provider,
            isFinalChunk,
            rawChunk: parsed
          });
        } catch (e) {
          // ignore parse errors
          console.error("[WORKER] Parse error:", e);
        }
      }
    }
  }

  // Send parsed messages back to main thread
  self.postMessage(messages);
}; 