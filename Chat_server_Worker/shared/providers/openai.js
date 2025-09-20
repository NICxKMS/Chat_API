import { OpenAI } from "openai";
import { BaseProvider, parseSSE } from "../providers/base.js";

export class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super("openai", config);
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    this._modelsCache = null; // { data, expiry }
    this._modelsTtlMs = 60_000;
  }

  async getModels() {
    const now = Date.now();
    if (this._modelsCache && this._modelsCache.expiry > now) return this._modelsCache.data;
    try {
      const res = await this.client.models.list();
      const filtered = (res.data || [])
        .filter(m => {
          const id = m.id || "";
          const c0 = id.charAt(0);
          if (!id) return false;
          if (c0 === "t" || c0 === "b" || c0 === "w") return false;
          if (id.startsWith("om")) return false;
          if (id.startsWith("dav")) return false;
          return true;
        })
        .map(m => ({ id: m.id, name: m.id, provider: this.name }));
      const data = filtered.length ? filtered : ["gpt-4","gpt-4-turbo","gpt-4o","gpt-4o-mini","gpt-3.5-turbo","gpt-3.5-turbo-16k"].map(id => ({ id, name: id, provider: this.name }));
      this._modelsCache = { data, expiry: now + this._modelsTtlMs };
      return data;
    } catch {
      try {
        const url = (this.config.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "") + "/models";
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${this.config.apiKey}` } });
        if (!resp.ok) throw new Error(String(resp.status));
        const data = await resp.json();
        const arr = Array.isArray(data.data) ? data.data : [];
        const filtered = arr
          .filter(m => {
            const id = m.id || "";
            const c0 = id.charAt(0);
            if (!id) return false;
            if (c0 === "t" || c0 === "b" || c0 === "w") return false;
            if (id.startsWith("om")) return false;
            if (id.startsWith("dav")) return false;
            return true;
          })
          .map(m => ({ id: m.id, name: m.id, provider: this.name }));
        const out = filtered.length ? filtered : ["gpt-4","gpt-4-turbo","gpt-4o","gpt-4o-mini","gpt-3.5-turbo","gpt-3.5-turbo-16k"].map(id => ({ id, name: id, provider: this.name }));
        this._modelsCache = { data: out, expiry: now + this._modelsTtlMs };
        return out;
      } catch {
        const out = ["gpt-4","gpt-4-turbo","gpt-4o","gpt-4o-mini","gpt-3.5-turbo","gpt-3.5-turbo-16k"].map(id => ({ id, name: id, provider: this.name }));
        this._modelsCache = { data: out, expiry: now + this._modelsTtlMs };
        return out;
      }
    }
  }

  async chatCompletion(options) {
    const model = options.model.includes("/") ? options.model.split("/")[1] : options.model;
    const resp = await this.client.chat.completions.create({
      model,
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
    });
    const choice = resp.choices?.[0];
    return {
      id: resp.id,
      model: resp.model || model,
      provider: this.name,
      createdAt: resp.created ? new Date(resp.created*1000).toISOString() : undefined,
      content: choice?.message?.content ?? "",
      usage: {
        promptTokens: resp.usage?.prompt_tokens || 0,
        completionTokens: resp.usage?.completion_tokens || 0,
        totalTokens: resp.usage?.total_tokens || 0,
      },
      latency: 0,
      finishReason: choice?.finish_reason || null,
      raw: resp,
    };
  }

  async *chatCompletionStream(options) {
    const model = options.model.includes("/") ? options.model.split("/")[1] : options.model;
    const url = (this.config.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "") + "/chat/completions";
    const resp = await this.optimizedFetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        stream: true,
        stream_options: { include_usage: true }
      }),
      signal: options.abortSignal,
    });
    if (!resp.ok || !resp.body) {
      let errPayload;
      try { errPayload = await resp.json(); } catch { errPayload = null; }
      const err = new Error(`OpenAI stream failed: ${resp.status}`);
      err.error = errPayload?.error || { message: `OpenAI stream failed: ${resp.status}`, code: resp.status, type: "StreamError" };
      throw err;
    }
    for await (const evt of parseSSE(resp.body)) {
      if (evt.data === "[DONE]") continue;
      const chunk = evt.data;
      const choice = chunk.choices?.[0];
      const delta = choice?.delta;
      yield {
        id: chunk.id,
        model: chunk.model || model,
        provider: this.name,
        createdAt: chunk.created ? new Date(chunk.created*1000).toISOString() : undefined,
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


