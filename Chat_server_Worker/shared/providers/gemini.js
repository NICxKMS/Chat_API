import { GoogleGenAI } from "@google/genai";
import { BaseProvider } from "../providers/base.js";

function isBase64DataUrl(str) {
  return typeof str === "string" && /^data:image\/(?:jpeg|png|gif|webp);base64,/.test(str);
}

async function fetchAsBase64(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Image fetch failed: ${resp.status}`);
  const ab = await resp.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function buildGeminiPayloadFromMessages(messages) {
  let systemInstruction;
  const contents = [];
  for (const message of messages || []) {
    if (message.role === "system" && systemInstruction === undefined) {
      if (typeof message.content === "string") {
        systemInstruction = { parts: [{ text: message.content }] };
      } else if (Array.isArray(message.content) && message.content.length && message.content[0].type === "text") {
        systemInstruction = { parts: [{ text: message.content[0].text }] };
      }
      continue;
    }
    const role = message.role === "assistant" ? "model" : "user";
    const parts = [];
    if (typeof message.content === "string") {
      if (message.content) parts.push({ text: message.content });
    } else if (Array.isArray(message.content)) {
      for (const item of message.content) {
        if (item.type === "text" && item.text) {
          parts.push({ text: item.text });
        } else if (item.type === "image_url" && item.image_url?.url) {
          const url = item.image_url.url;
          if (isBase64DataUrl(url)) {
            const base64Data = url.split(",")[1];
            const mimeType = url.match(/^data:(image\/[^;]+);base64,/)?.[1] || "image/jpeg";
            parts.push({ inlineData: { mimeType, data: base64Data } });
          } else if (/^https?:\/\//i.test(url)) {
            try {
              const data = await fetchAsBase64(url);
              const mimeType = "image/jpeg";
              parts.push({ inlineData: { mimeType, data } });
            } catch {}
          }
        }
      }
    }
    if (parts.length > 0) contents.push({ role, parts });
  }
  return { contents, systemInstruction };
}

export class GeminiProvider extends BaseProvider {
  constructor(config) {
    super("gemini", config);
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async getModels() {
    const base = (this.config.baseUrl || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
    const url = `${base}/v1beta/models?key=${encodeURIComponent(this.config.apiKey)}`;
    try {
      const resp = await fetch(url, { method: "GET" });
      if (!resp.ok) throw new Error(`Gemini list failed: ${resp.status}`);
      const data = await resp.json();
      const arr = Array.isArray(data.models) ? data.models : [];
      const mapped = arr.map(raw => {
        const full = raw.name || raw.id || raw.displayName || ""; // e.g., models/gemini-1.5-flash
        const id = String(full).includes("/") ? full.split("/").pop() : full;
        return { id, name: raw.displayName || id, provider: this.name };
      }).filter(m => m.id && m.id.startsWith("gemini-"));
      if (mapped.length) return mapped;
    } catch (e) {}
    const ids = ["gemini-1.5-flash", "gemini-1.5-pro"]; 
    return ids.map(id => ({ id, name: id, provider: this.name }));
  }

  async chatCompletion(options) {
    const model = options.model.includes("/") ? options.model.split("/")[1] : options.model;
    const { contents, systemInstruction } = await buildGeminiPayloadFromMessages(options.messages);
    const req = systemInstruction ? { model, contents, config: { systemInstruction } } : { model, contents };
    const resp = await this.client.models.generateContent(req);
    const text = resp?.text || resp?.candidates?.[0]?.content?.parts?.map(p => p?.text || "").join("") || "";
    return {
      id: undefined,
      model,
      provider: this.name,
      createdAt: new Date().toISOString(),
      content: text,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latency: 0,
      finishReason: null,
      raw: resp,
    };
  }

  async *chatCompletionStream(options) {
    const model = options.model.includes("/") ? options.model.split("/")[1] : options.model;
    const { contents, systemInstruction } = await buildGeminiPayloadFromMessages(options.messages);
    const req = systemInstruction ? { model, contents, config: { systemInstruction } } : { model, contents };
    const result = await this.client.models.generateContentStream(req);

    const iterator = (result && typeof result[Symbol.asyncIterator] === "function")
      ? result
      : (result && result.stream && typeof result.stream[Symbol.asyncIterator] === "function")
        ? result.stream
        : null;

    if (iterator) {
      for await (const item of iterator) {
        const textPart = (typeof item.text === "function" ? item.text() : item.text) || (item.candidates?.[0]?.content?.parts?.map(p => p?.text || "").join("") ?? "");
        if (!textPart) continue;
        
        // Extract usage from Gemini's usageMetadata if available
        let usage = null;
        if (item.usageMetadata) {
          usage = {
            promptTokens: item.usageMetadata.promptTokenCount || 0,
            completionTokens: item.usageMetadata.candidatesTokenCount || 0,
            totalTokens: item.usageMetadata.totalTokenCount || 0
          };
        }
        
        yield {
          id: undefined,
          model,
          provider: this.name,
          createdAt: new Date().toISOString(),
          content: textPart,
          usage: usage,
          latency: 0,
          finishReason: null,
          raw: item,
        };
      }
      return;
    }

    const textFallback = (typeof result?.text === "function" ? result.text() : result?.text) || (result?.candidates?.[0]?.content?.parts?.map(p => p?.text || "").join("") ?? "");
    if (textFallback) {
      // Extract usage from Gemini's usageMetadata if available
      let usage = null;
      if (result.usageMetadata) {
        usage = {
          promptTokens: result.usageMetadata.promptTokenCount || 0,
          completionTokens: result.usageMetadata.candidatesTokenCount || 0,
          totalTokens: result.usageMetadata.totalTokenCount || 0
        };
      }
      
      yield {
        id: undefined,
        model,
        provider: this.name,
        createdAt: new Date().toISOString(),
        content: textFallback,
        usage: usage,
        latency: 0,
        finishReason: null,
        raw: result,
      };
    } else {
      throw new Error("Invalid stream response from Gemini generateContentStream");
    }
  }
}


