# CSS Audit Findings

This document details the audit results for global CSS files and CSS Modules across the project, including file paths and specific findings.

## Global CSS Audit Findings

- **src/styles/common/colors.css**
  - Already defines and uses CSS variables for all color values.
  - No hardcoded color or font-size literals found.

- **src/styles/common/buttons.css**
  - Root CSS variables defined: `--button-size: 36px`, `--button-icon-size: 20px`, and others for transitions, shadows, etc.
  - Detected hardcoded `2px` values in `.buttonIcon` for padding and border width—candidates for new CSS variables (e.g., `--space-xxs`, `--border-width-sm`).
  - All other dimensions and colors use variables.

- **src/styles/common/tokens.css**
  - Defines spacing scale (`--space-xs` through `--space-xl`) and typography scale using CSS variables.
  - No hardcoded values present.

- **src/styles/common/animations.css**
  - Contains keyframes with no values requiring variable substitution.

- **src/styles/common/utilities.css**
  - Imports animations and applies utility classes; no hardcoded values detected.

## CSS Modules Audit Findings

All CSS Module files were audited; below is the list of each file and confirmation that there are no unused classes or obsolete selectors.

- `src/components/auth/AuthButton/AuthButton.module.css`
- `src/components/auth/LoginModal.module.css`
- `src/components/layout/Layout/Layout.module.css`
- `src/components/layout/Sidebar/Sidebar.module.css`
- `src/components/common/GlobalLoadingIndicator/GlobalLoadingIndicator.module.css`
- `src/components/common/ImageOverlay/ImageOverlay.module.css`
- `src/components/common/LazyMarkdownRenderer/LazyMarkdownRenderer.module.css`
- `src/components/common/MoreActions/MoreActions.module.css`
- `src/components/common/Spinner/Spinner.module.css`
- `src/components/common/ThemeToggle/ThemeToggle.module.css`
- `src/components/common/ToastNotification/ToastNotification.module.css`
- `src/components/common/TypingIndicator/TypingIndicator.module.css`
- `src/components/chat/ChatInput/ChatInput.module.css`
- `src/components/chat/ChatInput/subcomponents/ChatInputActionRow/ChatInputActionRow.module.css`
- `src/components/chat/ChatInput/subcomponents/ChatInputTextArea/ChatInputTextArea.module.css`
- `src/components/chat/ChatInput/subcomponents/ImagePreviewList/ImagePreviewList.module.css`
- `src/components/chat/ChatMessage/ChatMessage.module.css`
- `src/components/chat/MessageList/MessageList.module.css`
- `src/components/chat/PerformanceMetrics/PerformanceMetrics.module.css`
- `src/components/chat/GlobalMetricsBar/GlobalMetricsBar.module.css`
- `src/components/models/ModelCategory/ModelCategory.module.css`
- `src/components/models/ModelDropdown/ModelDropdown.module.css`
- `src/components/models/ModelItem/ModelItem.module.css`
- `src/components/models/ModelSearch/ModelSearch.module.css`
- `src/components/models/ModelSelectorButton/ModelSelectorButton.module.css`
- `src/components/settings/SettingsGroup/SettingsGroup.module.css`
- `src/components/settings/SettingsSelect/SettingsSelect.module.css`
- `src/components/settings/SettingsSlider/SettingsSlider.module.css`
- `src/components/settings/SettingsToggle/SettingsToggle.module.css`
- `src/components/layout/MainContent/MainContent.module.css`

**Summary:** No unused classes or obsolete selectors were found in any of the audited CSS Module files. 