// AWS Lambda HTTP API handler with support for SSE via Lambda Response Streaming.

import { loadConfig } from "../shared/config.js";
import { createProviderFactory } from "../shared/providers/factory.js";
import { createChatController } from "../shared/controllers/chat.js";
import { createModelController } from "../shared/controllers/models.js";

const env = process.env;
const config = loadConfig(env);
const factory = createProviderFactory(config);
const chat = createChatController(factory, undefined, env);
const models = createModelController(factory, undefined, env);

function json(statusCode, payload, headers = {}) {
  return {
    statusCode,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(payload)
  };
}

export async function handler(event, context) {
  const { rawPath } = event;
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const path = rawPath || event.path || "/";

  if (method === "GET" && path === "/api/models") {
    const data = await models.getAllModels();
    return json(200, data);
  }

  if (method === "GET" && path === "/api/models/categories") {
    const data = await models.getCategories();
    return json(200, data);
  }

  if (method === "GET" && path === "/api/models/providers") {
    const data = await models.getProviders();
    return json(200, data);
  }
  // /api/models/:providerName
  if (method === "GET" && path.startsWith("/api/models/")) {
    const providerName = decodeURIComponent(path.replace("/api/models/", ""));
    if (providerName && !["providers","categories","classified","classified/criteria"].includes(providerName)) {
      const data = await models.getProviderModels(providerName);
      const status = data.error ? 404 : 200;
      return json(status, data);
    }
  }
  if (method === "GET" && path === "/api/models/classified") {
    const data = await models.getClassifiedModels();
    return json(data.error ? 501 : 200, data);
  }
  if (method === "POST" && path === "/api/models/classified/criteria") {
    const body = typeof event.body === "string" && event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    const parsed = typeof body === "string" ? JSON.parse(body || "{}") : (body || {});
    const data = await models.getClassifiedModelsWithCriteria(parsed);
    return json(data.error ? 501 : 200, data);
  }

  if (method === "POST" && path === "/api/chat/completions") {
    const body = typeof event.body === "string" && event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    const parsed = typeof body === "string" ? JSON.parse(body || "{}") : (body || {});
    const data = await chat.chatCompletion(parsed);
    return json(200, data, { "x-request-id": parsed.requestId || "" });
  }

  if (method === "POST" && path === "/api/chat/stop") {
    const body = typeof event.body === "string" && event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    const parsed = typeof body === "string" ? JSON.parse(body || "{}") : (body || {});
    const data = await chat.stopGeneration(parsed);
    return json(200, data);
  }

  if (method === "GET" && path === "/api/chat/capabilities") {
    const data = await chat.getChatCapabilities();
    return json(200, data);
  }

  if (method === "POST" && path === "/api/chat/stream") {
    // Streaming response; requires Lambda Response Streaming enabled.
    const responseStream = context.responseStream;
    if (!responseStream) return json(500, { error: "Streaming not enabled for Lambda function" });
    const headers = new Headers();
    headers.set("content-type", "text/event-stream");
    headers.set("cache-control", "no-cache, no-transform");
    headers.set("connection", "keep-alive");
    responseStream.setContentType("text/event-stream");
    responseStream.enableCompression && responseStream.enableCompression();

    const body = typeof event.body === "string" && event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    const parsed = typeof body === "string" ? JSON.parse(body || "{}") : (body || {});

    try {
      for await (const chunk of chat.chatCompletionStream(parsed)) {
        responseStream.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      responseStream.write("data: [DONE]\n\n");
    } catch (e) {
      responseStream.write(`data: ${JSON.stringify({ error: { message: e.message } })}\n\n`);
    } finally {
      responseStream.close();
    }
    return { statusCode: 200 }; // Already streamed
  }

  if (method === "GET" && path === "/metrics") {
    return { statusCode: 200, headers: { "content-type": "text/plain" }, body: "# metrics disabled in serverless shared" };
  }

  // Info endpoints
  if (method === "GET" && (path === "/api/health" || path === "/api/status")) {
    return json(200, { status: "ok", timestamp: new Date().toISOString() });
  }
  if (method === "GET" && path === "/api/ready") {
    return json(200, { ready: true, timestamp: new Date().toISOString() });
  }
  if (method === "GET" && path === "/api/version") {
    return json(200, { version: "2.0.0", environment: env.NODE_ENV || "development", timestamp: new Date().toISOString() });
  }

  return json(404, { error: "Not Found" });
}


