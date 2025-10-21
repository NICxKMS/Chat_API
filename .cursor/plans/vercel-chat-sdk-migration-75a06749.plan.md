<!-- 75a06749-7597-413a-9e0b-b4266830a377 660087bd-caef-448a-9a4d-ccd0f7d751b9 -->
# Migration to Vercel Chat SDK

## Overview

Migrate from custom React + Cloudflare Workers setup to Vercel's Chat SDK (Next.js-based) with full feature parity including multi-provider AI support, streaming, and authentication.

**Key Technologies:**

- Next.js 15 with App Router
- Vercel AI SDK & Chat SDK ([chat-sdk.dev](https://chat-sdk.dev))
- Auth.js for authentication
- Vercel Postgres (or Neon) for data persistence
- AI SDK Gateway for unified provider access

**Architecture Decision:**

- **WebSocket Support**: While Chat SDK uses Server-Sent Events (SSE) by default, AI SDK 5 supports custom transport layers including WebSockets. We'll implement SSE initially (recommended by Vercel) and can add WebSocket as an enhancement if needed.
- **Authentication**: Use Auth.js (NextAuth) as it's natively integrated with Chat SDK, rather than Firebase Auth.

## Phase 1: Project Initialization

### 1.1 Clone and Set Up Chat SDK Template

Clone the official Chat SDK repository into the new `nextchatapp` folder:

```bash
git clone https://github.com/vercel/chat-sdk.git nextchatapp
cd nextchatapp
```

Install dependencies:

```bash
pnpm install
```

### 1.2 Configure Database

Set up Vercel Postgres or Neon PostgreSQL:

1. Create database instance (via Vercel dashboard or Neon)
2. Add to `.env.local`:
```
DATABASE_URL=postgresql://...
```


Run migrations:

```bash
pnpm db:push
```

### 1.3 Configure Authentication

Set up Auth.js in `.env.local`:

```
AUTH_SECRET=<generate-with-openssl-rand>
AUTH_URL=http://localhost:3000
```

Configure email provider or OAuth providers in `auth.config.ts`

### 1.4 Configure Vercel Blob Storage

For file uploads and multimodal support:

```
BLOB_READ_WRITE_TOKEN=<from-vercel-dashboard>
```

## Phase 2: AI Provider Configuration

### 2.1 Set Up AI SDK Gateway

Create custom provider configuration in `/lib/ai/models.ts` to support multiple providers:

**Providers to configure:**

- OpenAI (gpt-4, gpt-3.5-turbo, etc.)
- Anthropic (claude-3.5-sonnet, claude-3-opus, etc.)
- Google Gemini (gemini-pro, gemini-1.5-pro, etc.)
- OpenRouter (various models)

Add environment variables to `.env.local`:

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
OPENROUTER_API_KEY=...
AI_GATEWAY_API_KEY=... (optional, for AI SDK Gateway)
```

### 2.2 Create Multi-Provider Model Selector

Implement model selection UI similar to current setup:

- Categorize models by provider
- Show model capabilities (context length, features)
- Persist user's model selection

File: `app/components/model-selector.tsx`

### 2.3 Migrate Provider Factory Logic

Adapt the current provider factory pattern from `Chat_server_Worker/shared/providers/factory.js` to work with AI SDK's `customProvider` approach.

Reference: Current factory supports dynamic provider selection - replicate this in AI SDK Gateway configuration.

## Phase 3: Core Chat Features

### 3.0 Leverage Vercel AI SDK Components

**Primary AI SDK utilities to use:**

Install AI SDK packages:

```bash
pnpm add ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google @ai-sdk/openrouter
```

**Core hooks and functions:**

- `useChat()` - Primary hook for chat interfaces with built-in state management
- `useCompletion()` - For text completions
- `streamText()` - Server-side streaming
- `generateText()` - Server-side non-streaming generation
- `useAssistant()` - For assistant/agent workflows

**Built-in features:**

- Automatic request/response handling
- Built-in optimistic updates
- Automatic retry logic
- Token counting utilities
- Streaming data protocol

Reference: [AI SDK Core Documentation](https://sdk.vercel.ai/docs/ai-sdk-core)

### 3.1 Chat Interface Migration

Use **AI SDK's `useChat` hook** as the foundation, leveraging its built-in functionality:

**Primary implementation approach:**

```typescript
// app/components/chat.tsx
'use client';
import { useChat } from 'ai/react';

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    initialMessages: [],
    onResponse: (response) => {
      // Track performance metrics
    },
    onFinish: (message) => {
      // Handle completion
    },
  });
  
  return (
    // Chat UI using AI SDK's message handling
  );
}
```

**Components to build using AI SDK primitives:**

- Main chat interface using `useChat()` hook
- Message rendering with markdown, code highlighting (use AI SDK's message format)
- Chat input with multimodal support (leverage AI SDK's file handling)

**Features to integrate with AI SDK:**

- Streaming message display (AI SDK handles streaming automatically)
- Code syntax highlighting (integrate with AI SDK's message renderer)
- LaTeX/KaTeX rendering
- Token usage display (use AI SDK's usage data)
- Performance metrics (track via AI SDK callbacks)

### 3.2 Implement Streaming

Use AI SDK's `streamText` with the multi-provider setup:

File: `app/api/chat/route.ts`

```typescript
import { streamText } from 'ai';
import { myProvider } from '@/lib/ai/models';

export async function POST(req: Request) {
  const { messages, model } = await req.json();
  
  const result = streamText({
    model: myProvider(model),
    messages,
  });
  
  return result.toDataStreamResponse();
}
```

### 3.3 Advanced Message Formatting

Implement comprehensive message rendering with full formatting support using AI SDK primitives:

**Required packages:**

```bash
pnpm add react-markdown remark-gfm remark-math rehype-katex rehype-highlight
pnpm add katex highlight.js
pnpm add @types/katex @types/react-markdown --save-dev
```

**Formatting features to implement:**

#### a) Markdown Rendering

- Use `react-markdown` with AI SDK's message format
- Support for headings, lists, blockquotes, links
- GFM (GitHub Flavored Markdown) via `remark-gfm`

#### b) Code Syntax Highlighting

- Multi-language support via `rehype-highlight` or `react-syntax-highlighter`
- Line numbers and copy-to-clipboard functionality
- Theme matching (light/dark mode)
- Language detection from code fence info

#### c) Tables

- Full table support via `remark-gfm`
- Responsive table rendering
- Sortable columns (optional enhancement)

#### d) LaTeX/Math Equations

- Inline math: `$equation# Migration to Vercel Chat SDK

## Overview

Migrate from custom React + Cloudflare Workers setup to Vercel's Chat SDK (Next.js-based) with full feature parity including multi-provider AI support, streaming, and authentication.

**Key Technologies:**

- Next.js 15 with App Router
- Vercel AI SDK & Chat SDK ([chat-sdk.dev](https://chat-sdk.dev))
- Auth.js for authentication
- Vercel Postgres (or Neon) for data persistence
- AI SDK Gateway for unified provider access

**Architecture Decision:**

- **WebSocket Support**: While Chat SDK uses Server-Sent Events (SSE) by default, AI SDK 5 supports custom transport layers including WebSockets. We'll implement SSE initially (recommended by Vercel) and can add WebSocket as an enhancement if needed.
- **Authentication**: Use Auth.js (NextAuth) as it's natively integrated with Chat SDK, rather than Firebase Auth.

## Phase 1: Project Initialization

### 1.1 Clone and Set Up Chat SDK Template

Clone the official Chat SDK repository into the new `nextchatapp` folder:

```bash
git clone https://github.com/vercel/chat-sdk.git nextchatapp
cd nextchatapp
```

Install dependencies:

```bash
pnpm install
```

### 1.2 Configure Database

Set up Vercel Postgres or Neon PostgreSQL:

1. Create database instance (via Vercel dashboard or Neon)
2. Add to `.env.local`:
```
DATABASE_URL=postgresql://...
```


Run migrations:

```bash
pnpm db:push
```

### 1.3 Configure Authentication

Set up Auth.js in `.env.local`:

```
AUTH_SECRET=<generate-with-openssl-rand>
AUTH_URL=http://localhost:3000
```

Configure email provider or OAuth providers in `auth.config.ts`

### 1.4 Configure Vercel Blob Storage

For file uploads and multimodal support:

```
BLOB_READ_WRITE_TOKEN=<from-vercel-dashboard>
```

## Phase 2: AI Provider Configuration

### 2.1 Set Up AI SDK Gateway

Create custom provider configuration in `/lib/ai/models.ts` to support multiple providers:

**Providers to configure:**

- OpenAI (gpt-4, gpt-3.5-turbo, etc.)
- Anthropic (claude-3.5-sonnet, claude-3-opus, etc.)
- Google Gemini (gemini-pro, gemini-1.5-pro, etc.)
- OpenRouter (various models)

Add environment variables to `.env.local`:

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
OPENROUTER_API_KEY=...
AI_GATEWAY_API_KEY=... (optional, for AI SDK Gateway)
```

### 2.2 Create Multi-Provider Model Selector

Implement model selection UI similar to current setup:

- Categorize models by provider
- Show model capabilities (context length, features)
- Persist user's model selection

File: `app/components/model-selector.tsx`

### 2.3 Migrate Provider Factory Logic

Adapt the current provider factory pattern from `Chat_server_Worker/shared/providers/factory.js` to work with AI SDK's `customProvider` approach.

Reference: Current factory supports dynamic provider selection - replicate this in AI SDK Gateway configuration.

## Phase 3: Core Chat Features

### 3.0 Leverage Vercel AI SDK Components

**Primary AI SDK utilities to use:**

Install AI SDK packages:

```bash
pnpm add ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google @ai-sdk/openrouter
```

**Core hooks and functions:**

- `useChat()` - Primary hook for chat interfaces with built-in state management
- `useCompletion()` - For text completions
- `streamText()` - Server-side streaming
- `generateText()` - Server-side non-streaming generation
- `useAssistant()` - For assistant/agent workflows

**Built-in features:**

- Automatic request/response handling
- Built-in optimistic updates
- Automatic retry logic
- Token counting utilities
- Streaming data protocol

Reference: [AI SDK Core Documentation](https://sdk.vercel.ai/docs/ai-sdk-core)

### 3.1 Chat Interface Migration

Use **AI SDK's `useChat` hook** as the foundation, leveraging its built-in functionality:

**Primary implementation approach:**

```typescript
// app/components/chat.tsx
'use client';
import { useChat } from 'ai/react';

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    initialMessages: [],
    onResponse: (response) => {
      // Track performance metrics
    },
    onFinish: (message) => {
      // Handle completion
    },
  });
  
  return (
    // Chat UI using AI SDK's message handling
  );
}
```

**Components to build using AI SDK primitives:**

- Main chat interface using `useChat()` hook
- Message rendering with markdown, code highlighting (use AI SDK's message format)
- Chat input with multimodal support (leverage AI SDK's file handling)

**Features to integrate with AI SDK:**

- Streaming message display (AI SDK handles streaming automatically)
- Code syntax highlighting (integrate with AI SDK's message renderer)
- LaTeX/KaTeX rendering
- Token usage display (use AI SDK's usage data)
- Performance metrics (track via AI SDK callbacks)

- Block math: `$equation$`
- Use `remark-math` + `rehype-katex`
- Include KaTeX CSS for proper rendering

#### e) Additional Formatting

- **Mermaid diagrams** (optional): Add `mermaid` for flowcharts/diagrams
- **Emoji support**: Via `remark-emoji`
- **Task lists**: Checkboxes in markdown
- **Strikethrough, superscript, subscript**
- **HTML in markdown** (sanitized)

**Implementation Example:**

File: `app/components/message-content.tsx`

```typescript
'use client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

interface MessageContentProps {
  content: string;
}

export function MessageContent({ content }: MessageContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeHighlight]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline ? (
            <CodeBlock
              language={match ? match[1] : ''}
              code={String(children).replace(/\n$/, '')}
            />
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                {children}
              </table>
            </div>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

**Code Block Component with Copy Feature:**

File: `app/components/code-block.tsx`

```typescript
'use client';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface CodeBlockProps {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <button
        onClick={copyToClipboard}
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
```

**Testing checklist for formatting:**

- [ ] Markdown: headers, bold, italic, lists (ordered/unordered)
- [ ] Code blocks with syntax highlighting (JS, Python, Go, etc.)
- [ ] Inline code formatting
- [ ] Tables with proper responsive design
- [ ] LaTeX inline equations: `$x^2 + y^2 = z^2# Migration to Vercel Chat SDK

## Overview

Migrate from custom React + Cloudflare Workers setup to Vercel's Chat SDK (Next.js-based) with full feature parity including multi-provider AI support, streaming, and authentication.

**Key Technologies:**

- Next.js 15 with App Router
- Vercel AI SDK & Chat SDK ([chat-sdk.dev](https://chat-sdk.dev))
- Auth.js for authentication
- Vercel Postgres (or Neon) for data persistence
- AI SDK Gateway for unified provider access

**Architecture Decision:**

- **WebSocket Support**: While Chat SDK uses Server-Sent Events (SSE) by default, AI SDK 5 supports custom transport layers including WebSockets. We'll implement SSE initially (recommended by Vercel) and can add WebSocket as an enhancement if needed.
- **Authentication**: Use Auth.js (NextAuth) as it's natively integrated with Chat SDK, rather than Firebase Auth.

## Phase 1: Project Initialization

### 1.1 Clone and Set Up Chat SDK Template

Clone the official Chat SDK repository into the new `nextchatapp` folder:

```bash
git clone https://github.com/vercel/chat-sdk.git nextchatapp
cd nextchatapp
```

Install dependencies:

```bash
pnpm install
```

### 1.2 Configure Database

Set up Vercel Postgres or Neon PostgreSQL:

1. Create database instance (via Vercel dashboard or Neon)
2. Add to `.env.local`:
```
DATABASE_URL=postgresql://...
```


Run migrations:

```bash
pnpm db:push
```

### 1.3 Configure Authentication

Set up Auth.js in `.env.local`:

```
AUTH_SECRET=<generate-with-openssl-rand>
AUTH_URL=http://localhost:3000
```

Configure email provider or OAuth providers in `auth.config.ts`

### 1.4 Configure Vercel Blob Storage

For file uploads and multimodal support:

```
BLOB_READ_WRITE_TOKEN=<from-vercel-dashboard>
```

## Phase 2: AI Provider Configuration

### 2.1 Set Up AI SDK Gateway

Create custom provider configuration in `/lib/ai/models.ts` to support multiple providers:

**Providers to configure:**

- OpenAI (gpt-4, gpt-3.5-turbo, etc.)
- Anthropic (claude-3.5-sonnet, claude-3-opus, etc.)
- Google Gemini (gemini-pro, gemini-1.5-pro, etc.)
- OpenRouter (various models)

Add environment variables to `.env.local`:

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
OPENROUTER_API_KEY=...
AI_GATEWAY_API_KEY=... (optional, for AI SDK Gateway)
```

### 2.2 Create Multi-Provider Model Selector

Implement model selection UI similar to current setup:

- Categorize models by provider
- Show model capabilities (context length, features)
- Persist user's model selection

File: `app/components/model-selector.tsx`

### 2.3 Migrate Provider Factory Logic

Adapt the current provider factory pattern from `Chat_server_Worker/shared/providers/factory.js` to work with AI SDK's `customProvider` approach.

Reference: Current factory supports dynamic provider selection - replicate this in AI SDK Gateway configuration.

## Phase 3: Core Chat Features

### 3.0 Leverage Vercel AI SDK Components

**Primary AI SDK utilities to use:**

Install AI SDK packages:

```bash
pnpm add ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google @ai-sdk/openrouter
```

**Core hooks and functions:**

- `useChat()` - Primary hook for chat interfaces with built-in state management
- `useCompletion()` - For text completions
- `streamText()` - Server-side streaming
- `generateText()` - Server-side non-streaming generation
- `useAssistant()` - For assistant/agent workflows

**Built-in features:**

- Automatic request/response handling
- Built-in optimistic updates
- Automatic retry logic
- Token counting utilities
- Streaming data protocol

Reference: [AI SDK Core Documentation](https://sdk.vercel.ai/docs/ai-sdk-core)

### 3.1 Chat Interface Migration

Use **AI SDK's `useChat` hook** as the foundation, leveraging its built-in functionality:

**Primary implementation approach:**

```typescript
// app/components/chat.tsx
'use client';
import { useChat } from 'ai/react';

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    initialMessages: [],
    onResponse: (response) => {
      // Track performance metrics
    },
    onFinish: (message) => {
      // Handle completion
    },
  });
  
  return (
    // Chat UI using AI SDK's message handling
  );
}
```

**Components to build using AI SDK primitives:**

- Main chat interface using `useChat()` hook
- Message rendering with markdown, code highlighting (use AI SDK's message format)
- Chat input with multimodal support (leverage AI SDK's file handling)

**Features to integrate with AI SDK:**

- Streaming message display (AI SDK handles streaming automatically)
- Code syntax highlighting (integrate with AI SDK's message renderer)
- LaTeX/KaTeX rendering
- Token usage display (use AI SDK's usage data)
- Performance metrics (track via AI SDK callbacks)

- [ ] LaTeX block equations: `$\int_0^\infty e^{-x^2} dx$`
- [ ] Links (internal and external)
- [ ] Images (via markdown syntax)
- [ ] Blockquotes
- [ ] Horizontal rules
- [ ] Nested lists
- [ ] Strikethrough text
- [ ] Task lists with checkboxes
- [ ] Emoji rendering

### 3.4 Chat History & Persistence

Utilize Chat SDK's built-in PostgreSQL storage:

- Chat history per user
- Message persistence
- Share functionality (optional)

Leverage existing schema from Chat SDK's Drizzle ORM setup.

## Phase 4: Advanced Features

### 4.1 Model Categorization API

Migrate model categorization endpoint to Next.js API routes:

File: `app/api/models/route.ts`

- GET `/api/models` - List all available models
- GET `/api/models/providers` - List providers
- GET `/api/models/categories` - Categorized models

Adapt logic from `Chat_server_Worker/shared/controllers/models.js`

### 4.2 Performance Metrics

Implement performance tracking similar to current setup:

**Metrics to preserve:**

- Token usage per message
- Response latency
- Model performance comparison
- Cost tracking (if applicable)

Create components:

- `app/components/metrics-bar.tsx`
- `app/components/performance-metrics.tsx`

### 4.3 Multimodal Support

Chat SDK has built-in multimodal support via Vercel Blob:

- Image uploads
- File attachments
- Vision model support

Configure in model settings to support vision-capable models (GPT-4V, Claude 3, Gemini Vision)

### 4.4 Settings & Preferences

Migrate user preferences:

- Theme selection (dark/light)
- Default model selection
- Temperature, max tokens controls
- System prompt customization

Store in database with user profile.

## Phase 5: UI/UX Design (Modern Best Practices)

### 5.1 Modern Design Inspiration

**Inspiration from leading chat interfaces:**

Take design cues from modern, well-designed chat applications:

- **ChatGPT** - Clean message bubbles, smooth animations, clear typography
- **Claude.ai** - Minimalist design, excellent spacing, focus on content
- **Perplexity** - Sources panel, clean citations, professional layout
- **Linear** - Modern command palette, smooth interactions
- **Arc Browser** - Beautiful gradients, smooth transitions

**Design principles to follow:**

- Generous whitespace for readability
- Clear visual hierarchy (user vs AI messages)
- Subtle animations for state changes
- Glass morphism or modern card designs (optional)
- Smooth color transitions
- Professional typography (Inter, Geist, or similar modern fonts)

**Base on Chat SDK's foundation but enhance with:**

- Better message differentiation (user vs AI)
- Smooth scroll animations
- Modern gradient accents
- Polished micro-interactions
- Better visual feedback for actions

**Only light customization needed:**

- Brand colors (primary/accent colors in `app/globals.css`)
- Font selection (use modern system fonts or Google Fonts)
- Subtle animation enhancements

### 5.2 Enhanced Layout Features

Build upon Chat SDK's existing layout with additional features:

**Sidebar:**

- Chat history with search/filter
- Organized by date (Today, Yesterday, Last 7 days, etc.)
- Pin important conversations
- Delete/rename chats

**Model Selector:**

- Prominent model switcher in header or sidebar
- Quick access to favorite models
- Show model capabilities (context window, features)
- Visual indicators for model type (chat, vision, reasoning)

**Settings Panel:**

- Accessible from header/sidebar
- Model parameters (temperature, max tokens, top_p)
- System prompt customization
- API key management (if applicable)
- User preferences

**Header:**

- Clean navigation
- Model indicator
- User profile menu
- Theme toggle

Files to create/customize:

- `app/components/sidebar.tsx` - Enhanced with model selector
- `app/components/header.tsx` - Clean, modern header
- `app/components/model-selector.tsx` - Advanced model selection
- `app/components/settings-panel.tsx` - Comprehensive settings

### 5.3 Modern UX Patterns

Implement best-practice UX patterns:

**Loading States:**

- Skeleton loaders for better perceived performance
- Smooth streaming animations
- Progress indicators

**Feedback:**

- Toast notifications for actions (copy, delete, save)
- Error boundaries with helpful messages
- Inline validation

**Accessibility:**

- Keyboard navigation support
- ARIA labels for screen readers
- Focus management
- High contrast mode support

**Responsive Design:**

- Mobile-first approach
- Collapsible sidebar on mobile
- Touch-optimized controls
- Adaptive layouts for tablets

**Animations:**

- Smooth transitions using Framer Motion (if desired)
- Subtle hover effects
- Message entrance animations

## Phase 6: Testing & Deployment

### 6.1 Local Testing

Test all features locally:

```bash
pnpm dev
```

**Test checklist:**

- [ ] Authentication flow (sign up, login, logout)
- [ ] Multi-provider model selection
- [ ] Streaming responses from all providers
- [ ] Chat history persistence
- [ ] Multimodal inputs (images)
- [ ] Performance metrics display
- [ ] Theme switching
- [ ] Mobile responsiveness

### 6.2 Deploy to Vercel

```bash
vercel deploy
```

Configure environment variables in Vercel dashboard.

### 6.3 Database Migration (Production)

Set up production PostgreSQL instance and run migrations.

## Phase 7: Optional WebSocket Enhancement

**If SSE is insufficient, implement WebSocket transport:**

The AI SDK 5 supports custom transports. Implement WebSocket adapter:

File: `lib/ai/websocket-transport.ts`

```typescript
import { createCustomTransport } from 'ai';

export const websocketTransport = createCustomTransport({
  // Custom WebSocket implementation
  // Reference: https://vercel.com/blog/ai-sdk-5
});
```

Update `useChat` hook to use WebSocket transport:

```typescript
const { messages, input, handleInputChange, handleSubmit } = useChat({
  transport: websocketTransport,
});
```

**Note:** This is optional and should only be implemented if SSE doesn't meet performance requirements.

## References

- [Chat SDK Documentation](https://chat-sdk.dev/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [AI SDK Gateway](https://chat-sdk.dev/docs/customization/models-and-providers)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Auth.js](https://authjs.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)

## Migration Checklist Summary

**Setup:**

- [ ] Clone Chat SDK template to `nextchatapp`
- [ ] Configure PostgreSQL database
- [ ] Set up Auth.js authentication
- [ ] Configure Vercel Blob storage

**AI Integration:**

- [ ] Configure AI SDK Gateway with all providers
- [ ] Implement multi-provider model selector
- [ ] Set up streaming endpoints

**Features:**

- [ ] Migrate chat interface components
- [ ] Implement chat history & persistence
- [ ] Add performance metrics tracking
- [ ] Enable multimodal support
- [ ] Create model categorization API

**Polish:**

- [ ] Customize theme and branding
- [ ] Ensure responsive design
- [ ] Test all features thoroughly
- [ ] Deploy to Vercel

**Optional:**

- [ ] Implement WebSocket transport if needed

### To-dos

- [ ] Clone Chat SDK template and initialize nextchatapp project with dependencies
- [ ] Set up PostgreSQL (Vercel Postgres or Neon) and run database migrations
- [ ] Configure Auth.js for authentication with email/OAuth providers
- [ ] Configure AI SDK Gateway with OpenAI, Anthropic, Gemini, and OpenRouter providers
- [ ] Create multi-provider model selector component with categorization
- [ ] Migrate chat interface with streaming, markdown rendering, and code highlighting
- [ ] Implement chat history persistence using PostgreSQL
- [ ] Add performance metrics tracking (tokens, latency, cost)
- [ ] Configure multimodal support with Vercel Blob for images and files
- [ ] Create settings panel for theme, model preferences, and parameters
- [ ] Customize UI theme and branding to match existing design
- [ ] Test all features locally and deploy to Vercel