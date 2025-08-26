console.log('[StreamProcessor] Worker script initializing');
/* eslint-disable no-restricted-globals */

// streamProcessor.js
// Web Worker to parse SSE streaming chunks into content + tokenCount
console.log('[StreamProcessor] Worker self.onmessage binding about to happen');
let buffer = '';

self.onmessage = ({ data: chunk }) => {
  console.log('[StreamProcessor] onmessage received data length:', chunk?.length);
  // Append to buffer and only parse complete frames
  buffer += chunk || '';
  const messages = [];

  while (true) {
    const sepIndex = buffer.indexOf('\n\n');
    if (sepIndex === -1) break; // wait for more data
    const part = buffer.slice(0, sepIndex);
    buffer = buffer.slice(sepIndex + 2);

    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith(':heartbeat')) continue;
    if (!trimmed.startsWith('data:')) continue;

    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') {
      messages.push({ isDone: true });
      continue;
    }
    try {
      const parsed = JSON.parse(payload);

      // If server sent an error envelope (same as completion mode), surface it identically
      if (parsed && parsed.error) {
        messages.push({ rawChunk: { error: parsed.error }, isFinalChunk: true });
        continue;
      }

      // Normal chunk path
      const isFinalChunk = parsed.id && parsed.model && parsed.usage;
      let content = parsed.content;
      if (content == null) content = parsed.delta?.content;
      if (content == null) content = parsed.choices?.[0]?.delta?.content;
      if (content == null) {
        const parts = parsed.raw?.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) content = parts.map(p => p?.text || '').join('');
      }
      if (content == null) content = parsed.text;
      if (typeof content !== 'string') content = content ?? '';

      let tokenInfo = null;
      if (parsed.raw?.usage) {
        const u = parsed.raw.usage;
        tokenInfo = {
          promptTokens: u.prompt_tokens ?? u.promptTokens,
          completionTokens: u.completion_tokens ?? u.completionTokens,
          totalTokens: u.total_tokens ?? u.totalTokens
        };
      } else if (parsed.usage) {
        tokenInfo = {
          promptTokens: parsed.usage.promptTokens,
          completionTokens: parsed.usage.completionTokens,
          totalTokens: parsed.usage.totalTokens
        };
      } else if (parsed.raw?.usageMetadata) {
        tokenInfo = {
          promptTokens: parsed.raw.usageMetadata.promptTokenCount,
          completionTokens: parsed.raw.usageMetadata.candidatesTokenCount,
          totalTokens: parsed.raw.usageMetadata.totalTokenCount
        };
      }
      messages.push({
        content,
        usage: tokenInfo,
        finishReason: parsed.finishReason,
        model: parsed.model,
        provider: parsed.provider,
        isFinalChunk,
        rawChunk: parsed
      });
    } catch (e) {
      // Re-buffer this frame to wait for completion on next chunk
      buffer = `data: ${payload}\n\n` + buffer;
      break;
    }
  }

  self.postMessage(messages);
};