// Abstract provider base; avoids Node-only deps. Streaming via fetch.

export class BaseProvider {
  constructor(name, config) {
    if (new.target === BaseProvider) throw new Error("BaseProvider is abstract");
    this.name = name;
    this.config = config || {};
  }

  async getModels() {
    throw new Error("getModels not implemented");
  }

  async chatCompletion(options) {
    throw new Error("chatCompletion not implemented");
  }

  async *chatCompletionStream(_options) {
    throw new Error("chatCompletionStream not implemented");
  }

  // Optimized fetch with HTTP/3 and connection reuse
  optimizedFetch(url, options = {}) {
    return fetch(url, {
      ...options,
      cf: {
        // Prefer HTTP/3 (QUIC) for better performance
        httpVersion: '3',
        // Fallback to HTTP/2 if HTTP/3 not available
        httpVersionFallback: '2',
        // Don't cache responses, but reuse connections
        cacheTtl: 0,
        cacheEverything: false
      },
      // Add keep-alive headers
      headers: {
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=60, max=100',
        ...options.headers
      }
    });
  }
}

// SSE parser for fetch body
export async function* parseSSE(readable) {
  const decoder = new TextDecoder();
  let buffer = "";

  const processText = async function*(text) {
    buffer += text;
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const lines = part.split("\n");
      let event = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data === "[DONE]") {
        yield { event, data: "[DONE]" };
      } else if (data) {
        try { yield { event, data: JSON.parse(data) }; } catch {}
      }
    }
  };

  // Web ReadableStream
  if (readable && typeof readable.getReader === "function") {
    const reader = readable.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = typeof value === "string" ? value : decoder.decode(value, { stream: true });
        for await (const evt of processText(text)) yield evt;
      }
    } finally {
      reader.releaseLock();
    }
    return;
  }

  // Node.js Readable (async iterable)
  for await (const chunk of readable) {
    const text = typeof chunk === "string" ? chunk : decoder.decode(chunk);
    for await (const evt of processText(text)) yield evt;
  }
}


