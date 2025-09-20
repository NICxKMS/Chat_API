import { BaseProvider, parseSSE } from "../providers/base.js";

export class OpenRouterProvider extends BaseProvider {
  constructor(config) {
    super("openrouter", config);
    this.baseUrl = (config.baseUrl || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  }

  headers() {
    const h = { "content-type": "application/json", Authorization: `Bearer ${this.config.apiKey}` };
    if (this.config.httpReferer) h["HTTP-Referer"] = this.config.httpReferer;
    if (this.config.title) h["X-Title"] = this.config.title;
    return h;
  }

  async getModels() {
    try {
      const resp = await fetch(`${this.baseUrl}/models`, { headers: this.headers() });
      const json = await resp.json();
      const arr = Array.isArray(json.data) ? json.data : [];
      return arr.map(m => ({ id: m.id || m.name, name: m.name || m.id, provider: this.name }));
    } catch {
      return [];
    }
  }

  async chatCompletion(options) {
    const model = options.model; // OpenRouter accepts provider-prefixed
    const resp = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ model, messages: options.messages, temperature: options.temperature, max_tokens: options.max_tokens })
    });
    if (!resp.ok) throw new Error(`OpenRouter error: ${resp.status}`);
    const data = await resp.json();
    const choice = data.choices?.[0];
    return {
      id: data.id,
      model: data.model || model,
      provider: this.name,
      createdAt: data.created ? new Date(data.created*1000).toISOString() : new Date().toISOString(),
      content: choice?.message?.content ?? "",
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      latency: 0,
      finishReason: choice?.finish_reason || null,
      raw: data,
    };
  }

  async *chatCompletionStream(options) {
    const model = options.model; // OpenRouter accepts provider-prefixed
    const resp = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ model, messages: options.messages, temperature: options.temperature, max_completion_tokens: options.max_tokens, stream: true }),
      signal: options.abortSignal,
    });
    if (!resp.ok || !resp.body) throw new Error(`OpenRouter stream failed: ${resp.status}`);
    for await (const evt of parseSSE(resp.body)) {
      if (evt.data === "[DONE]") continue;
      const chunk = evt.data;
      const choice = chunk.choices?.[0];
      const delta = choice?.delta;
      yield {
        id: chunk.id,
        model: chunk.model || model,
        provider: this.name,
        createdAt: chunk.created ? new Date(chunk.created*1000).toISOString() : new Date().toISOString(),
        content: delta?.content || null,
        usage: chunk.usage ? {
          promptTokens: chunk.usage.prompt_tokens || 0,
          completionTokens: chunk.usage.completion_tokens || 0,
          totalTokens: chunk.usage.total_tokens || 0,
        } : null,
        latency: 0,
        finishReason: choice?.finish_reason || null,
        raw: chunk,
      };
    }
  }
}


