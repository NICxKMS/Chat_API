# Codebase Optimization Checklist

This document tracks potential areas for optimization identified during code analysis.

## Utils (`src/utils/`)

### `formatters.js`

- [x] **Performance (`formatMessageContent`):** Consider combining `escapeHtml`, `formatUrls`, and `processCodeBlocks` into a single pass to reduce intermediate string creation and improve performance if message formatting becomes a bottleneck.
- [x] **Memory (`processCodeBlocks`, `wrapTextInParagraphs`):** Explore single-pass string building instead of using `split` and intermediate arrays for potentially better memory efficiency with large inputs. 

## Hooks (`src/hooks/`)

### `useLocalStorage.js`

- [x] **Reusability/Performance (`useLocalStorage`):** The `useEffect` dependency on `initialValue` might cause unnecessary reads/state updates if `initialValue` is an unstable reference (e.g., object/array literal). Consider optimizing dependencies or memoizing `initialValue` where the hook is used.
- [x] **Reusability/State Management (`useLocalStorageWrite`):** This hook doesn't tie into React's state/render cycle. If shared reactivity to localStorage changes is needed, consider using context or a dedicated state management library instead of direct writes via this hook.

### `useMediaQuery.js`

- [x] **Performance/Efficiency (Minor):** For frequently used, static queries (like common breakpoints), consider a shared context or service to manage `matchMedia` listeners centrally, reducing redundant listeners created by multiple hook instances.
- [x] **Reusability/Maintainability:** Define breakpoint values (e.g., '640px') in a single source of truth (constants, theme config) and reference them in `useIsMobile`, `useIsTablet`, `useIsDesktop`, and `useBreakpoints` to avoid redundancy and improve maintainability. 

## Contexts (`src/contexts/`)

### `ThemeContext.js`

- [x] **Rendering Efficiency:** The context value object is created on every render. Memoize the `value` passed to `ThemeContext.Provider` using `useMemo` with `[theme]` as a dependency to prevent unnecessary re-renders in consuming components. 

### `SettingsContext.js`

- [x] **Rendering Efficiency (Context Value):** Memoize the `value` object passed to `SettingsContext.Provider` using `useMemo` with appropriate dependencies (`settings` and memoized callbacks) to prevent unnecessary re-renders.
- [x] **Rendering Efficiency (State Structure):** The single `settings` state object causes all consumers to re-render on any setting change. If performance is impacted, consider splitting the context or using selectors to allow components to subscribe only to specific settings.
- [x] **Maintainability (`shouldRestrictTemperature`):** The `startsWith('o')` logic for restricting temperature is potentially brittle. Consider using a more explicit flag or property on the model object itself for better robustness. 

### `ApiContext.js`

- [x] **Rendering Efficiency (Context Value):** Memoize the `value` passed to `ApiContext.Provider` using `useMemo` with appropriate dependencies (`apiStatus`, `checkApiStatus`, `apiUrl`) to prevent unnecessary re-renders.
- [x] **Performance (Polling):** The current polling mechanism (`setInterval`) for status checks might be inefficient. Evaluate if WebSockets, SSE, or on-demand checks are more suitable based on requirements.
- [x] **Configuration:** The `STATUS_CHECK_INTERVAL` is hardcoded. Consider making this configurable if needed. 

### `ModelContext.js`

- [x] **Rendering Efficiency (Context Value):** Memoize the `value` passed to `ModelContext.Provider` using `useMemo` with appropriate dependencies. Memoize `toggleExperimentalModels` using `useCallback`.
- [x] **Rendering Efficiency (State Structure):** The context manages extensive state. If components re-render excessively due to unrelated state changes, consider splitting the context or using selectors.
- [x] **Performance/Memory (`processModels`):** Processing the hierarchical model data can be resource-intensive for very large datasets. Monitor performance/memory on initial load/cache miss.
- [x] **Maintainability (`processModels`):** The model processing logic is tightly coupled to the API response structure. API changes will require refactoring. Consider adding more structural validation.
- [x] **Dependency (`fetchModels`):** Remove `selectedModel` from `fetchModels` `useCallback` dependencies for stricter accuracy, as the fetch itself doesn't depend on it.

### `ChatContext.js`

- [x] **Rendering Efficiency (Context Value):** Memoize the `value` passed to `ChatContext.Provider` using `useMemo` with appropriate dependencies.
- [x] **Rendering Efficiency (State Structure):** Frequent updates to `metrics` during streaming will cause all context consumers to re-render. Consider splitting metrics state or using selectors if this impacts performance.
- [x] **Callback Dependencies (`sendMessage`, `sendMessageStreaming`):** Including `chatHistory` in dependencies is necessary but changes the function reference on every message. Be mindful if passing these callbacks as props to memoized components.
- [x] **Token Count Estimation (`extractTokenCount`):** The fallback token count estimation is imprecise. Rely on API-provided counts for accurate metrics where possible.
- [x] **Memory (`chatHistory`):** Storing the entire chat history in state can lead to high memory usage for long chats. Consider persistence strategies (localStorage/IndexedDB) for older messages or UI virtualization if needed.
- [x] **Streaming Chunk Processing:** Ensure robust handling of potentially malformed or partial JSON chunks in the streaming response loop. 

## Common Components (`src/components/common/`)

### `Spinner/index.js`

- [x] **Rendering Efficiency (Memoization):** Wrap the `Spinner` component with `React.memo` to prevent unnecessary re-renders, as it's a purely presentational component dependent only on its props. 

## Model Filtering/Searching

### Model Processing and Filtering

- [x] **Performance (Model Search):** The hierarchical structure (`hierarchical_groups`) requires deep traversal for searches. Consider maintaining a flat index of models alongside the hierarchical structure for O(1) lookups by model ID.
- [x] **Memory (Model Caching):** Cache processed model data in memory after initial load to avoid re-processing the hierarchical structure on every filter/search operation.
- [x] **Search Optimization (Capabilities):** The `capabilities` array is searched frequently. Consider converting it to a Set or bitmask for O(1) capability checks instead of array includes().
- [x] **Filtering Performance:** Current filtering likely traverses the entire tree. Consider implementing a more efficient filtering strategy:
  - Pre-compute filter results for common filter combinations
  - Use memoization for filter results
  - Implement pagination or virtualization for large model lists
- [x] **Model Lookup (ID-based):** Add a Map/object for O(1) model lookups by ID instead of traversing the tree structure each time.
- [x] **Property-based Filtering:** The `properties` array defines filterable attributes. Consider creating optimized lookup structures for each property to speed up filtering operations.
- [x] **Hierarchical Navigation:** The nested structure makes it expensive to find parent/child relationships. Consider adding parent references or a separate relationship map for faster navigation.
- [x] **Default Model Selection:** The `is_default` flag requires tree traversal. Cache the default model reference after initial load for instant access.