# React Conversion Plan: AI Chat Interface

## Styling Strategy

**Chosen Approach: CSS Modules + CSS Variables**

**Justification:**
- Maintains the existing CSS variables system for theming
- Provides component-scoped CSS to prevent style conflicts
- Better performance than CSS-in-JS solutions
- Simpler migration path from existing CSS
- Developer-friendly with clear separation of concerns
- Allows gradual migration without complete rewrite

## Component Structure & File Organization

```
src/
├── components/            # Reusable UI components
│   ├── common/            # Generic components
│   │   ├── Button/
│   │   ├── Spinner/
│   │   ├── ThemeToggle/
│   │   └── TypingIndicator/
│   ├── layout/            # Layout components
│   │   ├── Sidebar/
│   │   └── MainContent/
│   ├── chat/              # Chat-specific components
│   │   ├── ChatInput/
│   │   ├── ChatMessage/
│   │   ├── CodeBlock/
│   │   ├── MessageList/
│   │   └── PerformanceMetrics/
│   ├── models/            # Model selection components
│   │   ├── ModelDropdown/
│   │   ├── ModelItem/
│   │   ├── ModelCategory/
│   │   └── ModelSearch/
│   └── settings/          # Settings components
│       ├── SettingsPanel/
│       ├── SettingsSlider/
│       └── SettingsToggle/
├── contexts/              # React contexts
│   ├── ApiContext.js
│   ├── ChatContext.js
│   ├── ModelContext.js
│   ├── SettingsContext.js
│   └── ThemeContext.js
├── hooks/                 # Custom hooks
│   ├── useApiStatus.js
│   ├── useChatHistory.js
│   ├── useChatStreaming.js
│   ├── useLocalStorage.js
│   ├── useMediaQuery.js
│   ├── useModelSelection.js
│   └── useSettings.js
├── services/              # API and other services
│   ├── api.js
│   ├── chatService.js
│   └── modelService.js
├── utils/                 # Utility functions
│   ├── formatters.js      # Message formatting
│   ├── tokenCounter.js    # Token counting logic
│   └── performance.js     # Performance metrics
├── App.js                 # Main app component
├── index.js               # Entry point
└── index.css              # Global styles
```

## State Management Approach

### Core State Management Strategy:
- **Local Component State**: For UI-specific state (useState/useReducer)
- **Context API**: For shared application state
- **Custom Hooks**: For encapsulating stateful logic

### Context Breakdown:

1. **ThemeContext**
   - Current theme (light/dark)
   - Theme toggle function

2. **ApiContext**
   - API connection status
   - Status check function
   - Base URL

3. **ModelContext**
   - Available models (hierarchical)
   - Selected model
   - Model filtering/search state
   - Experimental toggle

4. **SettingsContext**
   - Chat settings (temperature, max_tokens, etc.)
   - Settings update functions

5. **ChatContext**
   - Chat history
   - Functions for sending/receiving messages
   - Streaming state
   - Performance metrics

## API Handling

### Service Layer Approach:
- Create abstracted service modules for all API interactions
- Implement robust error handling and retry logic
- Use custom hooks to connect services to components

### Key Services:
- **api.js**: Base API configuration, common headers, error handling
- **chatService.js**: Chat completion requests, streaming implementation
- **modelService.js**: Model fetching, caching, and processing

### Custom Hooks:
- **useApiStatus**: Periodic API status checking
- **useChatStreaming**: Streaming chat completions with incremental UI updates
- **useModelSelection**: Model fetching, caching, and selection logic

## Performance Optimizations

1. **Minimizing Re-renders:**
   - React.memo for pure components
   - useCallback for event handlers passed to child components
   - useMemo for expensive computations
   - Careful context splitting to prevent unnecessary re-renders

2. **Efficient Chat Message Rendering:**
   - Virtual list rendering for chat messages using react-window
   - Stable key props for efficient diffing
   - Optimistic UI updates

3. **Code Splitting:**
   - React.lazy and Suspense for:
     - SettingsPanel
     - ModelDropdown
     - Syntax highlighting library

4. **Streaming Optimizations:**
   - Incremental UI updates for streaming responses
   - Buffered rendering for very fast streams

5. **Resource Loading:**
   - Import only needed parts of libraries
   - Load non-critical resources asynchronously
   - Replace Marked with react-markdown (more efficient React integration)
   - Replace Highlight.js with react-syntax-highlighter (React-optimized)

6. **Caching Strategy:**
   - Maintain localStorage caching for models
   - Add memoization for parsed/processed data

## Conversion Tasks

### Core Infrastructure
- [x] Create React project structure
- [x] Set up CSS Modules configuration
- [x] Migrate global CSS and theme variables
- [x] Implement context providers

### Components & Features
- [x] Implement ThemeToggle and theme context
- [x] Implement ApiStatus component and API context
- [x] Implement SidebarToggle component
- [x] Create basic layout structure with Sidebar and MainContent
- [x] Create ChatInput component
- [x] Create PerformanceMetrics component
- [x] Create ChatControls component
- [x] Create ChatMessage component with code block rendering
- [x] Implement MessageList with virtualization
- [x] Create TypingIndicator component
- [x] Implement ModelDropdown with all filtering/searching capabilities
  - [x] ModelDropdown component
  - [x] ModelSearch component
  - [x] ModelCategory component
  - [x] ModelItem component
- [x] Create SettingsPanel with all controls
  - [x] SettingsGroup component
  - [x] SettingsSlider component
  - [x] SettingsSwitch component
  - [x] SettingsSelect component
- [ ] Implement streaming chat completions (backend integration part)
- [ ] Add download and reset chat functionality (already implemented in ChatContext)

### Final Steps
- [ ] Comprehensive testing across features
- [ ] Performance optimization review
- [ ] Accessibility improvements
- [ ] Documentation 