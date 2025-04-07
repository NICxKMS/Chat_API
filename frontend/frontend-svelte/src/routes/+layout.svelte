<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { applyInitialTheme, theme } from '$lib/stores/themeStore.js'; // Import theme store itself
    import authStore from '$lib/stores/authStore.js';
    import modelStore from '$lib/stores/modelStore.js'; // Import model store
    import chatStore from '$lib/stores/chatStore.js'; // Import chatStore
    import keyboardShortcutsStore from '$lib/stores/keyboardShortcutsStore.js'; // Import keyboard shortcuts store
    import '../app.css';
  
    // Component Imports
    import Sidebar from '$lib/components/layout/Sidebar.svelte';
    // import MainContent from '$lib/components/layout/MainContent.svelte'; // Import later if needed for props
    import ThemeToggle from '$lib/components/common/ThemeToggle.svelte';
    import Spinner from '$lib/components/common/Spinner.svelte';
    import SettingsPanel from '$lib/components/settings/SettingsPanel.svelte';
    import LoginModal from '$lib/components/auth/LoginModal.svelte';
    import ModelDropdown from '$lib/components/models/ModelDropdown.svelte'; // Import model dropdown
    import KeyboardShortcutsHelp from '$lib/components/common/KeyboardShortcutsHelp.svelte'; // Import shortcuts help
  
    // Heroicons
    import { PlusIcon, Cog6ToothIcon, TrashIcon, ArrowDownTrayIcon, ArrowRightOnRectangleIcon, ArrowLeftOnRectangleIcon, ChevronUpDownIcon, CommandLineIcon } from 'heroicons-svelte/24/outline';
  
    // --- State ---
    let isDesktop = false;
    let isSidebarOpen = false;
    let isSettingsOpen = false; // State for settings panel
    let isModelSelectorOpen = false; // State for model selector modal
  
    // --- Lifecycle ---
    onMount(() => {
      if (!browser) return;
      
      applyInitialTheme();
      const mediaQuery = window.matchMedia('(min-width: 768px)');
      isDesktop = mediaQuery.matches;
      isSidebarOpen = isDesktop;
      
      const handleResize = (e) => {
        const desktopNow = e.matches;
        if (desktopNow !== isDesktop) {
          isDesktop = desktopNow;
          isSidebarOpen = isDesktop;
        }
      };
      
      mediaQuery.addEventListener('change', handleResize);

      // Initialize keyboard shortcuts
      const cleanup = keyboardShortcutsStore.initialize();

      // Handle custom events for keyboard shortcuts
      const handleToggleSettings = () => toggleSettings();
      const handleToggleModelSelector = () => toggleModelSelector();
      const handleCloseAllPanels = () => {
        isSettingsOpen = false;
        isModelSelectorOpen = false;
        keyboardShortcutsStore.closeHelp();
      };

      document.addEventListener('toggle-settings', handleToggleSettings);
      document.addEventListener('toggle-model-selector', handleToggleModelSelector);
      document.addEventListener('close-all-panels', handleCloseAllPanels);

      return () => {
        mediaQuery.removeEventListener('change', handleResize);
        if (cleanup) cleanup();
        document.removeEventListener('toggle-settings', handleToggleSettings);
        document.removeEventListener('toggle-model-selector', handleToggleModelSelector);
        document.removeEventListener('close-all-panels', handleCloseAllPanels);
      };
    });
  
    // --- Event Handlers ---
    const toggleSidebar = () => isSidebarOpen = !isSidebarOpen;
    const toggleSettings = () => isSettingsOpen = !isSettingsOpen;
    const toggleModelSelector = () => isModelSelectorOpen = !isModelSelectorOpen;
    const toggleKeyboardShortcutsHelp = () => keyboardShortcutsStore.toggleHelpVisibility();
    const handleNewChat = () => console.log("New Chat clicked!");
    const handleResetChat = () => console.warn("Reset Chat clicked - No implementation!");
    const handleDownloadChat = () => console.warn("Download Chat clicked - No implementation!");
  
    // --- Computed Classes / Reactive Declarations ---
    $: showMobileOverlay = !isDesktop && isSidebarOpen;
    $: isSidebarEffectivelyHidden = isDesktop && !isSidebarOpen;
    // Only compute full title in browser to avoid SSR errors
    $: modelButtonTitle = browser ? `Select Model (${$modelStore.selectedModel?.name || 'None'})` : 'Select Model';
  
    // Computed classes for Aside element
    $: asideClasses = 
      `absolute md:relative inset-y-0 left-0 z-40 flex-shrink-0 w-64 bg-sidebar-bg border-r border-border-primary transition-all duration-300 ease-in-out md:translate-x-0` +
      (isSidebarOpen ? ' translate-x-0' : ' -translate-x-full') +
      (isSidebarEffectivelyHidden ? ' md:w-20' : '');
  
    // Computed classes for Main Content element
    $: mainClasses = 
      `flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out relative` +
      (isSidebarEffectivelyHidden ? ' md:ml-[-11rem]' : '');
  
    // Common classes for FABs
    const fabClass = "group relative w-11 h-11 rounded-full bg-background/60 dark:bg-neutral-800/60 border border-border-secondary/50 backdrop-blur-sm flex items-center justify-center cursor-pointer text-foreground shadow-md transition-all duration-300 ease-in-out hover:shadow-lg hover:-translate-y-0.5 hover:text-primary-text active:scale-95 active:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed";
    const fabIconClass = "relative z-10 w-5 h-5 transition-colors duration-300 ease-in-out";
    const fabHoverBgClass = "absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out rounded-full";
  </script>
  
  <div class="relative flex h-screen overflow-hidden">
  
    <!-- Mobile Overlay -->
    {#if showMobileOverlay}
      <div
        class="fixed inset-0 z-30 bg-black/40 md:hidden"
        on:click={toggleSidebar}
        aria-hidden="true"
      ></div>
    {/if}
  
    <!-- Sidebar Container -->
    <aside class={asideClasses} aria-hidden={!isSidebarOpen && !isDesktop}>
      <Sidebar {isSidebarEffectivelyHidden} />
    </aside>
  
    <!-- Main Content Container -->
    <main class={mainClasses}>
      <!-- Model Selector Button (Positioned Top-Center within Main) - Client-side only -->
      {#if browser}
        <div class="absolute top-0 left-1/2 -translate-x-1/2 z-20 pt-2">
          <button
            on:click={toggleModelSelector}
            disabled={$modelStore.isLoadingModels}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium shadow-sm border border-border-primary bg-background hover:bg-foreground/5 transition-colors disabled:opacity-50"
            title={modelButtonTitle}
          >
            {$modelStore.selectedModel?.name || 'Select Model'}
            {#if $modelStore.isLoadingModels}
              <Spinner size="small" />
            {:else}
              <ChevronUpDownIcon class="w-4 h-4 text-foreground/50" />
            {/if}
          </button>
        </div>
      {/if}
  
      <!-- Main chat area, allow space for button above -->
      <div class="flex-1 overflow-y-auto pt-12">
        <slot />
      </div>
    </main>
  
    <!-- Floating Action Buttons -->
    {#if browser}
      <div class="fixed right-4 bottom-6 sm:right-6 sm:bottom-8 space-y-2">
        <!-- New Chat -->
        <button class={fabClass} on:click={chatStore.resetChat} title="Start a new chat" aria-label="Start a new chat">
          <span class={fabHoverBgClass} aria-hidden="true"></span>
          <PlusIcon class={fabIconClass} />
        </button>
        <!-- Download -->
        <button class={fabClass} on:click={chatStore.downloadChatHistory} title="Download chat history" aria-label="Download chat history">
          <span class={fabHoverBgClass} aria-hidden="true"></span>
          <ArrowDownTrayIcon class={fabIconClass} />
        </button>
        <!-- Clear Chat -->
        <button class={fabClass} on:click={chatStore.resetChat} title="Clear chat history" aria-label="Clear chat history">
          <span class={fabHoverBgClass} aria-hidden="true"></span>
          <TrashIcon class={fabIconClass} />
        </button>
        <!-- Theme Toggle -->
        <ThemeToggle />
        <!-- Keyboard Shortcuts -->
        <button
          class={fabClass}
          on:click={toggleKeyboardShortcutsHelp}
          title="Keyboard shortcuts"
          aria-label="View keyboard shortcuts"
        >
          <span class={fabHoverBgClass} aria-hidden="true"></span>
          <CommandLineIcon class={fabIconClass} />
        </button>
        <!-- Settings -->
        <button class={fabClass} on:click={toggleSettings} title="Settings" aria-label="Open settings panel">
          <span class={fabHoverBgClass} aria-hidden="true"></span>
          <Cog6ToothIcon class={fabIconClass} />
        </button>
      </div>
    {/if}
  
    <!-- Modals / Panels -->
    {#if browser}
      <SettingsPanel bind:isOpen={isSettingsOpen} onClose={toggleSettings} />
      <KeyboardShortcutsHelp />
  
      {#if isModelSelectorOpen}
        <div
          class="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          on:click={toggleModelSelector}
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          on:keydown={(e) => e.key === 'Escape' && toggleModelSelector()}
        >
          <div 
            class="w-full max-w-lg" 
            on:click|stopPropagation 
            role="document"
          >
            {#if $modelStore.isLoadingModels}
              <div class="flex justify-center p-8"><Spinner size="large" /></div>
            {:else}
              <ModelDropdown />
            {/if}
          </div>
        </div>
      {/if}
  
      {#if $authStore.isLoggingIn}
        <LoginModal onClose={$authStore.closeLoginModal} />
      {/if}
    {/if}
  </div>
  