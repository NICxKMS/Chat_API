import Anthropic from "@anthropic-ai/sdk";
import { BaseProvider, parseSSE } from "../providers/base.js";

export class AnthropicProvider extends BaseProvider {
  constructor(config) {
    super("anthropic", config);
    this.client = new Anthropic({ apiKey: config.apiKey, baseURL: config.baseUrl });
  }

  async getModels() {
    const ids = ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"];
    return ids.map(id => ({ id, name: id, provider: this.name }));
  }

  async chatCompletion(options) {
    const model = options.model.includes("/") ? options.model.split("/")[1] : options.model;
    const res = await this.client.messages.create({
      model,
      messages: options.messages.map(m => ({ role: m.role === "assistant" ? "assistant" : m.role, content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) })),
      max_tokens: options.max_tokens || 1024,
      temperature: options.temperature,
    });
    const content = Array.isArray(res.content) ? res.content.map(p => p.text).join("") : (res.content?.[0]?.text || "");
    return {
      id: res.id,
      model,
      provider: this.name,
      createdAt: new Date().toISOString(),
      content,
      usage: {
        promptTokens: res.usage?.input_tokens || 0,
        completionTokens: res.usage?.output_tokens || 0,
        totalTokens: (res.usage?.input_tokens || 0) + (res.usage?.output_tokens || 0)
      },
      latency: 0,
      finishReason: res.stop_reason || null,
      raw: res,
    };
  }

  async *chatCompletionStream(options) {
    const model = options.model.includes("/") ? options.model.split("/")[1] : options.model;
    const url = (this.config.baseUrl || "https://api.anthropic.com").replace(/\/$/, "") + "/v1/messages";
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: options.messages.map(m => ({ role: m.role === "assistant" ? "assistant" : m.role, content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) })),
        max_tokens: options.max_tokens || 1024,
        temperature: options.temperature,
        stream: true
      }),
      signal: options.abortSignal,
    });
    if (!resp.ok || !resp.body) throw new Error(`Anthropic stream failed: ${resp.status}`);
    for await (const evt of parseSSE(resp.body)) {
      if (evt.data === "[DONE]") continue;
      const d = evt.data;
      const text = d?.delta?.text || d?.content_block?.text || null;
      yield {
        id: d.id || undefined,
        model,
        provider: this.name,
        createdAt: new Date().toISOString(),
        content: text,
        usage: null,
        latency: 0,
        finishReason: d?.stop_reason || null,
        raw: d,
      };
    }
  }
}


