## Chat API - Serverless Migrated (AWS Lambda + Cloudflare Workers)

This is a serverless-ready migration of your Chat API, structured to run on both AWS Lambda and Cloudflare Workers. Shared business logic resides in `shared/`, while platform adapters live in `aws-lambda/` and `cloudflare-worker/`.

### Folder structure

```
project-serverless-migrated/
  shared/
  aws-lambda/
  cloudflare-worker/
  package.json
  README.md
```

### Features

- Unified provider abstraction for OpenAI, Anthropic, Gemini, and OpenRouter
- Streaming responses (SSE) on both platforms
- Auth via Firebase ID tokens
  - AWS Lambda: `firebase-admin`
  - Cloudflare Workers: JOSE + Google JWKS (no admin SDK)
- Optional Firestore-backed caching on AWS; disabled on Workers
- Minimal metrics endpoint on AWS (`/metrics`), disabled on Workers

### Environment variables (both platforms)

- OPENAI_API_KEY
- ANTHROPIC_API_KEY
- GOOGLE_API_KEY or GEMINI_API_KEY
- OPENROUTER_API_KEY (optional)
- DEFAULT_PROVIDER (optional: openai|anthropic|gemini|openrouter)
- FIREBASE_PROJECT_ID (required for auth)
- FIRESTORE_CACHE_ENABLED (aws only, default=false)
- FIRESTORE_CACHE_TTL (aws only, default=3600)

Set variables:

```
# common
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
DEFAULT_PROVIDER=openai
FIREBASE_PROJECT_ID=your-project-id

# aws only
FIRESTORE_CACHE_ENABLED=false
FIRESTORE_CACHE_TTL=3600
```

---

## AWS Lambda

### Deploy with AWS Lambda + API Gateway (HTTP API)

1. Create Lambda (Node.js 20.x). Enable "Response streaming" in the Lambda function configuration.
2. Configure environment variables above.
3. Add an HTTP API (API Gateway v2) with proxy integration to Lambda.
4. Set routes:
   - POST /api/chat/completions
   - POST /api/chat/stream
   - POST /api/chat/stop
   - GET  /api/models
   - GET  /api/models/providers
   - GET  /api/models/categories
   - GET  /api/models/classified
   - GET  /api/models/classified/criteria
   - GET  /metrics (optional)

Build/Upload:

```
npm i --omit=dev
zip -r function.zip .
# upload function.zip to Lambda
```

### Local test (Node)

Use `aws-lambda/local-dev.js` to emulate requests directly against handlers if needed.

---

## Cloudflare Workers

### Deploy with Wrangler

1. Create a `wrangler.toml` (example below).
2. Set environment variables in Cloudflare dashboard or `wrangler.toml` [vars].
3. Publish.

Example `wrangler.toml`:

```
name = "chat-api-worker"
main = "cloudflare-worker/worker.js"
compatibility_date = "2024-08-01"

[vars]
DEFAULT_PROVIDER = "openai"

[[routes]]
pattern = "your.domain.com/*"
zone_id = "YOUR_ZONE_ID"
```

### Routes

The worker handles the same routes as AWS under `/api/...`.

---

## Notes

- Streaming is implemented with SSE in both environments.
- Firebase Admin SDK is not supported on Workers; JOSE verification against Google JWKS is used instead.
- Firestore caching is only enabled for AWS Lambda. On Workers the caching is a no-op by design.


