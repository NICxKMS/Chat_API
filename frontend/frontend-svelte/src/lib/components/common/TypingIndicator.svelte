<div
  class="typing-indicator relative inline-flex items-center justify-center gap-1.5 px-4 py-2
         bg-message-assistant-bg border border-border-primary rounded-full shadow-md my-2"
  aria-label="AI is typing"
>
  <div class="dot"></div>
  <div class="dot"></div>
  <div class="dot"></div>
</div>

<style>
  .typing-indicator::before {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 16px; /* Adjust as needed */
    width: 12px;
    height: 12px;
    background-color: var(--color-message-assistant-bg);
    border-right: 1px solid var(--color-border-primary);
    border-bottom: 1px solid var(--color-border-primary);
    transform: rotate(45deg);
    /* Ensure transition matches background */
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    opacity: 0.7;
    animation: pulse 1.5s infinite ease-in-out;
    /* Base gradient (Light) */
    background: linear-gradient(135deg, rgb(var(--primary-rgb-light)), rgb(var(--secondary-rgb-light)));
    transition: background 0.2s ease; /* Smooth gradient transition */
  }

  .dot:nth-child(1) {
    animation-delay: 0s;
  }

  .dot:nth-child(2) {
    animation-delay: 0.3s;
    /* Gradient variation (Light) */
    background: linear-gradient(135deg, rgb(var(--secondary-rgb-light)), rgb(var(--accent-rgb-light)));
  }

  .dot:nth-child(3) {
    animation-delay: 0.6s;
     /* Gradient variation (Light) */
    background: linear-gradient(135deg, rgb(var(--accent-rgb-light)), rgb(var(--primary-rgb-light)));
  }

  /* Dark Mode Adjustments */
  .dark .typing-indicator::before {
    background-color: var(--color-message-assistant-bg);
    border-right-color: var(--color-border-primary);
    border-bottom-color: var(--color-border-primary);
  }

  .dark .dot {
    /* Base gradient (Dark) */
    background: linear-gradient(135deg, rgb(var(--primary-rgb-dark)), rgb(var(--secondary-rgb-dark)));
  }

  .dark .dot:nth-child(2) {
     /* Gradient variation (Dark) */
    background: linear-gradient(135deg, rgb(var(--secondary-rgb-dark)), rgb(var(--accent-rgb-dark)));
  }

  .dark .dot:nth-child(3) {
     /* Gradient variation (Dark) */
    background: linear-gradient(135deg, rgb(var(--accent-rgb-dark)), rgb(var(--primary-rgb-dark)));
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.4;
      transform: scale(0.7);
    }
    50% {
      opacity: 1;
      transform: scale(1.1);
    }
  }
</style> 