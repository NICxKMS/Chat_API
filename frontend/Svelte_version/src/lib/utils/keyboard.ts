/**
 * Keyboard shortcuts and accessibility utilities
 */

// Keyboard shortcut actions
export enum ShortcutAction {
  SEARCH = 'search',
  NEW_CHAT = 'new_chat',
  CLEAR_CHAT = 'clear_chat',
  FOCUS_INPUT = 'focus_input',
  SEND_MESSAGE = 'send_message',
  CANCEL_RESPONSE = 'cancel_response',
  TOGGLE_SETTINGS = 'toggle_settings',
  ESCAPE_CURRENT = 'escape_current',
  SCROLL_BOTTOM = 'scroll_bottom'
}

// Shortcut key combinations
export const SHORTCUTS = {
  [ShortcutAction.SEARCH]: { key: 'f', ctrlKey: true },
  [ShortcutAction.NEW_CHAT]: { key: 'n', ctrlKey: true },
  [ShortcutAction.CLEAR_CHAT]: { key: 'k', ctrlKey: true, shiftKey: true },
  [ShortcutAction.FOCUS_INPUT]: { key: 'i', ctrlKey: true },
  [ShortcutAction.SEND_MESSAGE]: { key: 'Enter', ctrlKey: false },
  [ShortcutAction.CANCEL_RESPONSE]: { key: 'Escape', ctrlKey: false },
  [ShortcutAction.TOGGLE_SETTINGS]: { key: ',', ctrlKey: true },
  [ShortcutAction.ESCAPE_CURRENT]: { key: 'Escape', ctrlKey: false },
  [ShortcutAction.SCROLL_BOTTOM]: { key: 'End', ctrlKey: false }
};

// Types
export interface Shortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}

/**
 * Check if a keyboard event matches a shortcut definition
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
  const ctrlMatch = Boolean(event.ctrlKey) === Boolean(shortcut.ctrlKey);
  const altMatch = Boolean(event.altKey) === Boolean(shortcut.altKey);
  const shiftMatch = Boolean(event.shiftKey) === Boolean(shortcut.shiftKey);
  const metaMatch = Boolean(event.metaKey) === Boolean(shortcut.metaKey);

  return keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch;
}

/**
 * Get the display text for a keyboard shortcut
 */
export function getShortcutDisplay(shortcut: Shortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey) parts.push('Ctrl');
  if (shortcut.altKey) parts.push('Alt');
  if (shortcut.shiftKey) parts.push('Shift');
  if (shortcut.metaKey) parts.push('⌘');

  // Format key - capitalize single keys
  let key = shortcut.key;
  if (key.length === 1) {
    key = key.toUpperCase();
  }

  parts.push(key);
  return parts.join('+');
}

/**
 * Create a keyboard shortcut handler
 */
export function createShortcutHandler(
  shortcuts: Record<string, Shortcut>,
  handlers: Record<string, () => void>
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    for (const [action, shortcut] of Object.entries(shortcuts)) {
      if (matchesShortcut(event, shortcut)) {
        if (handlers[action]) {
          event.preventDefault();
          handlers[action]();
          return;
        }
      }
    }
  };
}
