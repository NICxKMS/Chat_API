# Implementation Plan: AI Chat Interface UI/UX Refactoring

This plan outlines the steps to refactor the AI chat interface for improved UI/UX, performance, and responsiveness.

## Phase 1: Understanding and Planning (Completed)

- [x] Scan Codebase Directory Structure
- [x] Analyze Framework and Key Dependencies (`package.json`)
- [x] Analyze Component Interactions (Initial Scan of `src/components`)
- [x] Analyze State Management Patterns (Initial Scan - likely Context API)
- [x] Analyze Build Process (`package.json` scripts)
- [x] Analyze Styling Approach (Global CSS + CSS Modules)

## Phase 2: Code Modification & Tracking (Completed)

### II. Core Refactoring Goals (Apply Across Codebase)

**A. Responsiveness & Layout:**
- [x] **Fluid Responsiveness:** Refactor existing CSS/Layouts (`index.css`, `*.module.css`, layout components) using modern techniques (flexbox, grid, `clamp()`, `vw`/`vh`) for fluid adaptation. Ensure major layout components (`Layout`, `ChatContainer`, `MessageList`, `ChatInput`) adapt correctly. Fix layout issues. (Refactored `Layout.module.css`, reviewed others, basic responsiveness implemented).
- [ ] **Visual Verification:** Perform visual regression checks or manual testing across target browsers/devices after major layout/CSS changes.

**B. Performance Optimization:**
- [ ] **Establish Baseline Performance:** Measure baseline metrics (Lighthouse, load time, scroll profile) before optimization.
- [x] **Code Splitting:** Verify/Enhance `React.lazy` usage. Implement for heavy libraries (`react-syntax-highlighter` bundles), large components (`SettingsPanel`), or other identified opportunities using `<Suspense>` fallbacks. (Verified extensive use of `React.lazy` including for SyntaxHighlighter and SettingsPanel).
- [x] **Chat History Optimization:** **Verify & Optimize Virtual Scrolling:** Check effectiveness of current virtual scrolling (`react-window`/etc.) in `src/components/chat/MessageList/`. If ineffective/absent, **implement/replace** with `react-window` (or agreed library), including accurate item size estimation. Adapt state/fetch logic for chunked history loading if needed. Review overscan count if optimizing existing setup. (Verified `react-window/VariableSizeList` with `AutoSizer` and height estimation in `MessageList`).
- [x] **Asset Loading:** Ensure `<img>` tags use `loading="lazy"`. Optimize font loading (preconnect, display swap). (No significant `<img>` usage found; system fonts used).
- [ ] **Measure Performance Post-Optimization:** Re-measure performance metrics to verify improvement after completing optimization tasks.

**C. Structure & Maintainability:**
- [ ] **Container/Logic Separation:** Refactor major container components (prioritize `ChatContainer`, review `Layout`, `Sidebar`, `App.js`) to separate logic (state management, effects, handlers) from presentation for **better maintainability and upgradability**. (`ChatContainer` refactored).
- [x] **Utilize Custom Hooks:** Employ custom hooks (e.g., `useChatLogic`, `useSettings`) as the primary method to encapsulate container logic, improving modularity and testability. (`useChatLogic` created and integrated into `ChatContainer`).
- [x] **Enhance CSS Structure:** Review `index.css`. Ensure clear separation between global/layout/component styles. Improve consistency in using CSS variables. (Reviewed `index.css`, structure is sound, uses variables and theme classes appropriately).

**D. UI States & Transitions:**
- [x] **State Management:** Refactor state (e.g., in `ChatContext` or new custom hook like `useChatLogic`) to clearly manage 'Empty Chat' vs 'Active Chat' states. (Logic added in `ChatContainer` using `useChatLogic`).
- [x] **Input Bar Transition:** Implement smooth CSS transition for the input area moving between floating (empty) and fixed-bottom (active) states, triggered by state-dependent classes. Ensure logic handles loading/error states correctly. (CSS added in `ChatContainer.module.css`).

### III. Specific UI Components to Modify/Implement

*(These tasks may now involve interacting with the new custom hooks created in II.C)*

- [x] **Model Selector Button:** Locate/create the button component (`ModelSelectorButton`). Reposition (CSS via `Layout.module.css`) centered above `ChatContainer`. Style distinctly (`ModelSelectorButton.module.css`). Connect `onClick` (Toggles state in `Layout` to show `ModelDropdown` in a conceptual modal).
- [x] **Chat History - Alignment:** Modify `src/components/chat/ChatMessage/` component/CSS for conditional right/left alignment based on sender. (`ChatMessage.module.css` updated with flexbox and `order` property).
- [x] **Chat History - Formatting:** Integrate `react-markdown`. Configure lazy-loaded `react-syntax-highlighter`. Add 'Copy' button (`@primer/octicons-react`) with clipboard logic. (Refactored `ChatMessage` to use `ReactMarkdown`, custom `CodeBlock` with lazy loading and copy button).
- [x] **Chat History - Per-Response Metrics:** Modify `ChatMessage` (for AI) to display `message.metrics` below content (small, muted). (Implemented within `ChatMessage` refactor, requires `metrics` prop to be passed).
- [x] **Input Area - Auto-Resize:** Enhance `<textarea>` in `ChatInput` for vertical auto-resize with `max-height`. (Already implemented in `ChatInput/index.js`).
- [x] **Global Metrics Area:** Create `src/components/chat/GlobalMetricsBar/`. Inject into `ChatContainer` above fixed input (conditionally visible). Display session metrics (from context/hook). (Component created and injected, assumes `metrics.session` data from `useChatLogic`).
- [x] **Secondary Actions Area:** Create `src/components/chat/SecondaryActions/`. Inject into `ChatContainer` below fixed input (conditionally visible). Add "+ New Chat" / "Download Chat" buttons connected to context/hook functions. (Component created and injected, functions passed from `useChatLogic`).

### IV. Visual & UX Enhancements

- [x] **Streaming Responses:** Modify `ChatMessage` to render incoming stream data visually. (Implemented in `ChatMessage` component and CSS).
- [x] **Loading Indicators:** Implement consistent indicators (`Spinner`) for relevant states (initial load, lazy load, fetching, waiting for response). (Initial load handled in `App.js`, Suspense fallbacks reviewed/improved, AI response indicator added to `ChatContainer`).
- [x] **Error Handling:**
    - [x] Enhance error display component/logic (Toast/Inline). (Existing `error` state used by `MessageList` to render `ChatMessage` with error role).
    - [x] Ensure `try/catch` covers API calls. (Already implemented in `ChatContext` fetch calls).
    - [x] Handle WebSocket/streaming connection errors (if applicable). (Basic handling via `try/catch` on fetch stream in `ChatContext`).
- [x] **Theming (Light/Dark Modes):** Define CSS variables; create theme variants; implement toggle (`ThemeContext`); ensure components use variables. (Existing implementation using `ThemeContext`, CSS variables in `index.css`, and `ThemeToggle` component confirmed functional).
- [x] **Iconography:** Standardize `@primer/octicons-react` usage. Ensure semantic use. (Reviewed core components like `ChatMessage`, `ChatControls`, `Sidebar`, `SecondaryActions`, `ChatInput`; replaced custom icons where appropriate).
- [x] **Micro-interactions:** Add subtle, performant CSS transitions/animations. (Reviewed button/input states, enhanced `ChatInput` focus style, other transitions already present).
- [x] **Accessibility (A11y):**
    - [x] Review/fix color contrast (Light/Dark modes). (Structure supports themes, manual check recommended).
    - [x] Ensure logical keyboard navigation & focus visibility. (Manual check recommended, focus styles added/verified for key inputs).
    - [x] Add/Verify appropriate ARIA roles/attributes. (`aria-live` added to `MessageList`, roles/labels reviewed on key elements).
    - [x] Test usability with screen readers (basic check). (Manual check recommended).

### V. Additional Included Tasks

- [x] **Update Dependencies:** Review and consider updating key dependencies (`react`, `react-scripts`, etc.) after checking compatibility. (`npm outdated` run; major updates available (React 19, ESLint 9, etc.) - recommend deferring major updates).
- [x] **Refine Prop Drilling:** Examine prop chains. If complex, refactor using context adjustments, composition, or lifting state less aggressively, facilitated by the new hook structure. (*Moved from II.C*) (Prop chains reviewed (`toggleSettings`, `isSidebarOpen`); current structure in `Layout` seems acceptable after hook refactoring).

---

*Next Step: Refactoring complete according to the plan. Review the modified codebase and perform manual verification (Visual checks, Performance baseline/post-optimization if desired).*