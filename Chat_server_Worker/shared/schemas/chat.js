import { z } from "zod";

export const chatPayloadSchema = z.object({
  model: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(["system","user","assistant"]),
    content: z.union([
      z.string(),
      z.array(z.union([
        z.object({ type: z.literal("text"), text: z.string() }),
        z.object({ type: z.literal("image_url"), image_url: z.object({ url: z.string().url() }) })
      ]))
    ])
  })).min(1),
  temperature: z.number().optional(),
  max_tokens: z.number().optional(),
  response_format: z.object({ type: z.literal("json_object") }).optional(),
  requestId: z.string().optional(),
  nocache: z.boolean().optional()
});

export const stopSchema = z.object({ requestId: z.string().min(1) });

export function parseJson(requestBody) {
  try { return JSON.parse(requestBody || "{}"); } catch { return {}; }
}


