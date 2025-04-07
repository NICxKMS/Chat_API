# React to SvelteKit & Tailwind CSS Migration Plan

This document outlines the phased plan for migrating the existing React chat application to SvelteKit and Tailwind CSS.

## Phase 1: Project Setup & Core Structure

- [x] Initialize a new SvelteKit project using the appropriate template (e.g., Skeleton project with TypeScript support).
- [x] Integrate Tailwind CSS into the SvelteKit project following the official SvelteKit + Tailwind CSS integration guide. Configure `tailwind.config.cjs`.
- [x] Replicate the basic project structure. SvelteKit uses `src/lib` for components/modules and `src/routes` for page routing. Create initial directories like `src/lib/components`, `src/lib/contexts` (or `src/lib/stores`), `src/lib/utils`, `src/lib/firebase`.
- [x] Configure Firebase:
    - [x] Port the Firebase configuration logic from `Original/src/firebaseConfig.js` and `Original/firebasesdk.js` to a Svelte-friendly module (e.g., `src/lib/firebase/firebase.js`). Ensure environment variables (`.env`) are set up correctly for SvelteKit.
- [x] Set up the basic application layout:
    - [x] Create a root layout file (`src/routes/+layout.svelte`) to act as the main application shell, similar to `Original/src/components/layout/Layout.js`.
- [x] Implement Theme Handling:
    - [x] Port the theme logic from `Original/src/contexts/ThemeContext.js`. Use Svelte stores (`writable`) and potentially browser `localStorage` (similar to `useLocalStorage`) to manage and persist the theme (light/dark). Apply theme classes to the root HTML element in `src/app.html` or the root layout.
    - [x] Define base light/dark theme colors in `tailwind.config.cjs` based on the variables in `Original/src/index.css`.

## Phase 2: Component Migration (Core UI)

- [x] Identify core reusable UI components from `Original/src/components/common` and `Original/src/components/layout`.
- [x] Translate React components (`.jsx`/`.js`) to Svelte components (`.svelte`) within `src/lib/components/`.
    - [x] Convert JSX syntax to Svelte's HTML-like template syntax.
    - [x] Change `className` attributes to `class`.
    - [x] Adapt React state (`useState`, `useEffect`) and props handling to Svelte's reactive declarations (`let`, `export let`, `$:`).
    - [x] Replace React lifecycle methods (`componentDidMount`, `useEffect` with empty dependency array) with Svelte's `onMount`, and cleanup logic (`componentWillUnmount`, `useEffect` return function) with `onDestroy`.
    - [x] Convert React event handlers (`onClick={handler}`) to Svelte directives (`on:click={handler}`).
- [x] Apply Tailwind CSS classes directly within the Svelte components for styling, progressively replacing the need for the global styles defined in `Original/src/index.css`. Focus on replicating the visual appearance using Tailwind utilities.
- [ ] **(In Progress)** Re-introduce layout structure (Sidebar, MainContent, Floating Buttons, Modals) into `+layout.svelte`.

## Phase 3: Feature Migration (Chat, Models, Settings, Auth)

- [x] **Chat Feature:**
    - [ ] Migrate components from `Original/src/components/chat` to `src/lib/components/chat`.
    - [x] Port the core chat logic from `Original/src/hooks/useChatLogic.js` and `Original/src/contexts/ChatContext.js` to `src/lib/stores/chatStore.js`.
- [x] **Model Selection:**
    - [ ] Migrate components from `Original/src/components/models` to `src/lib/components/models` (Deferred due to linter errors).
    - [x] Port model management logic from `Original/src/contexts/ModelContext.js` to `src/lib/stores/modelStore.js` and `modelFilterStore.js`.
- [x] **Settings:**
    - [x] Migrate components from `Original/src/components/settings` to `src/lib/components/settings` (Partially done with `SettingsPanel`).
    - [x] Port settings logic from `Original/src/contexts/SettingsContext.js` to `src/lib/stores/settingsStore.js`.
- [x] **Authentication:**
    - [x] Migrate components from `Original/src/components/auth` to `src/lib/components/auth` (Partially done with `LoginModal`).
    - [x] Port authentication logic from `Original/src/contexts/AuthContext.js` to `src/lib/stores/authStore.js`.
- [ ] **API Communication:**
    - [x] Abstract API call logic (Integrated within stores, using `VITE_API_BASE_URL`).
- [ ] **Utilities & Hooks:**
    - [ ] Port utility functions from `Original/src/utils/formatters.js` to `src/lib/utils/formatters.js` (Skipped - Handled by `marked` library).
    - [x] Adapt custom hooks (`useMediaQuery.js`, `useLocalStorage.js`) to Svelte patterns (`useLocalStorage` logic adapted in `modelFilterStore`, `useMediaQuery` adapted in `+layout.svelte`).

## Phase 4: Styling Refinement & Theming

- [ ] Thoroughly review all migrated components and ensure Tailwind styles accurately replicate the original application's layout and design across different screen sizes.
- [ ] Verify that the theme switching (light/dark mode) implemented in Phase 1 works correctly across all components. Ensure Tailwind's `dark:` variant is used effectively based on the theme store.
- [ ] Refine responsive design using Tailwind's breakpoint utilities (`sm:`, `md:`, `lg:`, etc.).
- [ ] Migrate any remaining essential styles or complex CSS logic from `Original/src/index.css` that couldn't be directly replaced by Tailwind utilities. Consider using Tailwind's theme extension capabilities in `tailwind.config.cjs` or `@apply` directive in Svelte style blocks if necessary, but prioritize utility classes.

## Phase 5: API Integration & State Management Finalization

- [ ] Rigorously test all functionalities involving API interactions (sending messages, fetching models, authentication, etc.).
- [ ] Verify that the Svelte stores (or other state management solutions chosen) correctly replicate the behavior and data flow previously handled by React Contexts.
- [ ] Ensure reactivity works as expected – UI updates automatically when underlying state changes. Debug any state synchronization issues.

## Phase 6: Testing & Optimization

- [ ] **Testing:**
    - [ ] Set up a testing environment for SvelteKit (e.g., Vitest for unit/component tests, Playwright for end-to-end tests).
    - [ ] Migrate existing test logic from `Original/src/setupTests.js` and component tests where feasible, adapting them to the Svelte environment and testing library syntax.
    - [ ] Write new tests for critical Svelte components and user flows. Aim for good test coverage.
    - [ ] Perform thorough manual cross-browser and cross-device testing.
- [ ] **Optimization:**
    - [ ] Analyze the application's performance using browser developer tools (Lighthouse, Performance tab). Focus on initial load time (TBT, LCP, FCP), bundle size, and runtime performance. SvelteKit's pre-rendering and code-splitting should provide a good baseline.
    - [ ] Identify and address any performance bottlenecks. Lazy load components or data where appropriate if not already handled by SvelteKit.
    - [ ] Optimize resource usage (memory, CPU).
- [ ] **Linting & Formatting:**
    - [ ] Set up ESLint with the appropriate Svelte plugins (`eslint-plugin-svelte`).
    - [ ] Configure Prettier for code formatting consistency across `.svelte`, `.js`, `.ts` files.
    - [ ] Run linters and formatters to ensure code quality and adherence to standards. Fix any reported issues.

## Phase 7: Final Review & Documentation

- [ ] Conduct a final code review of the entire migrated SvelteKit application.
- [ ] Update the `README.md` file to reflect the new SvelteKit stack, including setup, development, build, and deployment instructions.
- [ ] Remove any leftover React-specific code, configuration files, and dependencies (`react`, `react-dom`, `react-scripts`, etc.) from `package.json`. Run `npm prune` or equivalent.
- [ ] Ensure the production build process (`npm run build`) works correctly and generates an optimized output.
- [ ] Final deployment check (if applicable). 