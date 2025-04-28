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
          
          // Priority: OpenAI raw.usage for usage metadata (snake_case)
          if (parsed.raw?.usage) {
            const u = parsed.raw.usage;
            tokenInfo = {
              promptTokens: u.prompt_tokens ?? u.promptTokens,
              completionTokens: u.completion_tokens ?? u.completionTokens,
              totalTokens: u.total_tokens ?? u.totalTokens
            };
            console.log("[WORKER] Found raw.usage:", tokenInfo);
          } else if (parsed.usage) {
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
          
          messages.push({
            content,
            // Forward server usage metadata only; no client-side tokenCount
            usage: tokenInfo,
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