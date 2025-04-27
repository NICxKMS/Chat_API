---
title: Codebase Optimization & Refactoring Plan
author: AI Assistant
created: 2024-06-15
last_updated: 2024-06-15
---

# Codebase Optimization & Refactoring Plan

## Table of Contents
- [Phase 2: Optimize ChatMessage Rendering](#phase-2-optimize-chatmessage-rendering)
- [Phase 3: Refactor messageHelpers](#phase-3-refactor-messagehelpers)
- [Phase 4: Simplify useChatLogic](#phase-4-simplify-usechatlogic)
- [Phase 5: Consolidate Dynamic Imports & Preloading](#phase-5-consolidate-dynamic-imports--preloading)
- [Phase 6: Split Context Providers](#phase-6-split-context-providers)
- [Phase 7: Memoize Inline Maps & Callbacks](#phase-7-memoize-inline-maps--callbacks)
- [Phase 8: Enable Lazy Image Loading](#phase-8-enable-lazy-image-loading)
- [Phase 9: Debounce/Throttle ChatInput](#phase-9-debounce-throttle-chatinput)
- [Phase 10: Clean Up Logs & Dead Code](#phase-10-clean-up-logs--dead-code)
- [Phase 11: Refine Custom Hooks](#phase-11-refine-custom-hooks)
- [Phase 1: Virtualize MessageList](#phase-1-virtualize-messagelist)

---

## Phase 2: Optimize ChatMessage Rendering
- [x] Convert non-assistant TeX conversions to `useMemo` instead of `useState` + `useEffect`.
- [x] Guard worker setup so only assistant messages spawn a Web Worker listener.
- [x] Verify that the lazy-loaded `StreamingMessage` is only loaded when needed.
- [x] Audit dependency arrays for icon and button `useMemo`/`useCallback` hooks.
- [ ] In `src/components/chat/ChatMessage/index.js`, change non-assistant content conversion to:
  ```js
  const processedMessage = useMemo(() => convertTeXToMathDollars(message.content), [message.content, message.role]);
  ```
- [ ] Update the `useEffect` to early-return for `message.role !== 'assistant'`, removing listener setup for those cases.
- [ ] Confirm that `StreamingMessage` (lazy import) only loads when `isStreaming === true`; add a test that non-streaming assistant messages do not trigger its network fetch.
- [ ] Check `useMemo` for `icon`, `messageClass`, `copyButtonJsx`, and `editButtonJsx` to ensure dependency arrays exactly match used props (no extra deps).

## Phase 3: Refactor messageHelpers
- [x] Replace `forEach` in `processMessageContent` with a single `reduce` pass.
- [x] Consolidate image/text accumulation into one array allocation.
- [x] Add unit tests to confirm identical output.
- [x] In `src/utils/messageHelpers.js`, refactor:
  ```js
  return content.reduce((acc, part) => { /* push into acc.images or acc.texts */ }, { images: [], texts: [] });
  ```
- [x] Join `acc.texts` into `acc.text` and return `{ images, text }` at end of reduce.
- [x] Implement Jest tests for empty, array, and string inputs, comparing before/after outputs.

## Phase 4: Simplify useChatLogic
- [x] Merge multiple `findIndex` fallbacks into a single predicate check.
- [x] Skip mapping rich-content array for plain string payloads.
- [x] Remove redundant logging or gate it behind a debug flag.
- [x] In `src/hooks/useChatLogic.js`, replace the three sequential `findIndex` calls with one:
  ```js
  const editIndex = chatHistory.findIndex(msg =>
    [msg.uniqueId, msg.id, msg.timestamp].includes(editMsgId) ||
    (typeof msg.content === 'string' && msg.content === editedMessage.content)
  );
  ```
- [x] Wrap the `console.error` and `console.log` calls under `if (process.env.NODE_ENV === 'development')`.
- [x] For plain string messages, bypass the `message.map` array transform path.

## Phase 5: Consolidate Dynamic Imports & Preloading
- [ ] Deduplicate the lists for lazy imports and `PRELOAD_IMPORTS` arrays.
- [x] Remove the duplicate `preloadAsync` helper function.
- [x] Inline or simplify `requestIdleCallback` logic for heavy chunks.
- [ ] Test phased loading and measure startup performance.
- [ ] In `src/App.js`, extract an array `const LAZY_COMPONENTS = [ Layout, LoginModal, ... ]` and reuse for both lazy and `PRELOAD_IMPORTS.essential`.
- [x] Delete the `preloadAsync` helper (lines 14–16) and replace its usage with a direct `Promise.all(...)`.
- [x] Simplify `idlePreload` to:
  ```js
  requestIdleCallback(() => { PRELOAD_IMPORTS.heavy.forEach((fn, i) => fn()); });
  ```
- [ ] Measure and record bundle load times before/after in `bundle-report.txt`.

## Phase 6: Split Context Providers
- [ ] Identify frequently updating context values that cause unnecessary rerenders.
- [ ] Split large contexts (e.g., ChatState, StreamingContext) into smaller scoped providers.
- [ ] Update consumer hooks to use new selectors/contexts.
- [ ] Benchmark component rerenders before and after split.
- [ ] Open `src/contexts/ChatStateContext.js` and extract `metrics` into a dedicated `MetricsContext` provider.
- [ ] In `src/contexts/StreamingContext.js` (around line 316), move socket/event logic into a separate `StreamingEventsContext`.
- [ ] Create new hooks `useMetrics` and `useStreamingEvents` that only subscribe to those slices.
- [ ] Add refill tests or profiling in React DevTools to confirm fewer renders in chat components.

## Phase 7: Memoize Inline Maps & Callbacks
- [ ] Audit large lists rendered via `.map` in settings, models, and layout components.
- [ ] Wrap repeated JSX lists in `useMemo` or extract pure subcomponents with `React.memo`.
- [ ] Verify props stability and avoid needless recomputation.
- [ ] For `src/components/models/ModelDropdown/index.js`, wrap the `Object.keys(capabilities).map` output in `useMemo` keyed by `capabilities`.
- [ ] In `src/components/settings/SettingsPanel.js`, memoize the `activeSettings.map` and `tabs.map` render lists.
- [ ] Extract the `Sidebar` items in `src/components/layout/Sidebar/index.js` into a pure `SidebarItem` component with `memo`.
- [ ] In `src/components/chat/ChatContainer/index.js`, remove the duplicate scroll useEffect blocks and consolidate them into a single handler, preserving scroll-to-bottom logic.

## Phase 8: Enable Lazy Image Loading
- [ ] Add `loading="lazy"` to all non-critical `<img>` tags.
- [ ] Confirm no layout shifts or UX regressions.
- [ ] Test on slow networks to ensure deferred loading.
- [ ] Update `<img>` in `MessageList/index.js` (lines ~44–50) to `<img loading="lazy" ... />`.
- [ ] In `src/components/chat/ChatMessage/index.js`, ensure any `<img>` in processed streaming messages includes `loading="lazy"`.
- [ ] Audit other components (e.g. `ImageOverlay`, `ModelItem`) for lazy loading attributes.

## Phase 9: Debounce/Throttle ChatInput
- [ ] Identify heavy operations in `ChatInput` (e.g., file reading, parsing).
- [ ] Implement throttling or debouncing on rapid user interactions.
- [ ] Offload expensive parsing to a Web Worker if needed.
- [ ] Measure input responsiveness after changes.
- [ ] In `src/components/chat/ChatInput/index.js`, wrap the `handleFileChange` processing in a `throttle` (imported from `lodash.throttle`).
- [ ] Debounce text input state updates (`onChange`) by 200ms using `useDebouncedCallback` or equivalent.
- [ ] Consider moving `readFileAsBase64` calls into a worker thread for images >1MB.

## Phase 10: Clean Up Logs & Dead Code
- [ ] Remove or guard all `console.log` calls in production code.
- [ ] Delete unused imports and auxiliary helper functions.
- [ ] Run linter and ensure zero unused warnings.
- [ ] Use `grep -R "console\.log" src/` to locate and wrap each call with `if (process.env.NODE_ENV === 'development')`.
- [ ] Run `npm run lint` and fix or remove any reported dead code or unused variables.
- [ ] Commit changes and update `bundle-report.txt` with before/after footprint.

## Phase 11: Refine Custom Hooks
- [ ] Debounce localStorage writes in `useLocalStorage` (src/hooks/useLocalStorage.js) using `lodash.debounce`.
- [ ] Optimize `useCacheToggle` (src/hooks/useCacheToggle.js) to only update storage when the toggle value truly changes.
- [ ] Batch and throttle state updates in `useMediaQuery` (src/hooks/useMediaQuery.js) to reduce re-render storms on window resize.
- [ ] Memoize breakpoint constants in `useBreakpoints` (src/hooks/useMediaQuery.js) to avoid re-creating the object on every render.
- [ ] Write unit tests for each custom hook (`useLocalStorage`, `useCacheToggle`, `useMediaQuery`, `useBreakpoints`) to assert stable outputs and performance characteristics.

## Phase 1: Virtualize MessageList
- [ ] Evaluate and select a virtualization library (e.g., react-virtuoso or react-window).
- [ ] Replace the array-based `.map` in `MessageList` with a windowed list component.
- [ ] Ensure overlay image handling still works with virtualization.
- [ ] Test scrolling performance with large message histories.
- [ ] Add `react-virtuoso` to package.json (e.g. `npm install react-virtuoso@^2.0.0`).
- [ ] In `src/components/chat/MessageList/index.js`, replace the `finalMessages.map` block with `<Virtuoso data={finalMessages} itemContent={(index, message) => (...)}/>`, forwarding `handleImageClick`.
- [ ] Wrap the message list container in a virtualized wrapper (e.g. add `styles.messageListVirtual` CSS) to maintain existing layout.
- [ ] Write or update unit/integration tests to assert that `ImageOverlay` still opens on clicking any rendered `<img>` inside the virtual list.
- [ ] Perform manual smoke test: generate 1000+ dummy messages, scroll top to bottom, and verify no frame drops.

*Next Steps*: Begin Phase 2 and update this checklist as each task completes. Feedback or adjustments can be noted as inline comments here.