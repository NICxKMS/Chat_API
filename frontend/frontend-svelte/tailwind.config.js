module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{html,js,svelte,ts}',
  ],
  theme: {
    extend: {
      colors: {
        // Define semantic names using CSS variables
        'background': 'var(--color-background)',
        'foreground': 'var(--color-foreground)',
        'foreground-secondary': 'var(--color-foreground-secondary)',
        'border-primary': 'var(--color-border-primary)',
        'border-secondary': 'var(--color-border-secondary)',
        'input-bg': 'var(--color-input-bg)',
        'card-bg': 'var(--color-card-bg)',
        'chat-bg': 'var(--color-chat-bg)',
        'sidebar-bg': 'var(--color-sidebar-bg)',
        'settings-bg': 'var(--color-settings-bg)',
        'code-bg': 'var(--color-code-bg)',

        'primary': {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          text: 'var(--color-primary-text)',
          bgUser: 'var(--color-primary-bgUser)',
          bgTag: 'var(--color-primary-bgTag)',
        },
        'secondary': 'var(--color-secondary)',
        'accent': 'var(--color-accent)',

        'message-assistant-bg': 'var(--color-message-assistant-bg)',

        // Functional colors (using Tailwind defaults or custom vars)
        'error': 'var(--color-error, #ef4444)',
        'success': 'var(--color-success, #22c55e)',
        'warning': 'var(--color-warning, #f97316)',
        'info': 'var(--color-info, #06b6d4)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
        mono: ['source-code-pro', 'Menlo', 'Monaco', 'Consolas', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
} 