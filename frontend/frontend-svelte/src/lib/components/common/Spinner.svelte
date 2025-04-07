<script>
  /**
   * Size of the spinner.
   * @type {'small' | 'medium' | 'large'}
   */
  export let size = 'medium';

  /**
   * Optional custom color for the spinner border.
   * Should be a valid CSS color value (e.g., '#ff0000', 'rgb(255,0,0)').
   * If not provided, it uses the primary color defined in CSS variables.
   * @type {string | null | undefined}
   */
  export let color = undefined; // Use undefined for optional prop

  // Map size prop to Tailwind classes
  $: sizeClasses = {
    small: 'w-6 h-6',
    medium: 'w-12 h-12',
    large: 'w-18 h-18' // Equivalent to 72px
  }[size] || 'w-12 h-12'; // Default to medium

  // Style attribute for custom color
  $: spinnerStyle = color ? `border-top-color: ${color};` : '';

</script>

<div
  class="spinner-container inline-flex justify-center items-center p-2 {sizeClasses}"
  role="status"
  aria-label="Loading..."
>
  <div class="spinner relative rounded-full w-full h-full" style={spinnerStyle}></div>
</div>

<style>
  .spinner::before,
  .spinner::after {
    content: '';
    position: absolute;
    border-radius: 50%;
    inset: 0; /* Short for top, right, bottom, left = 0 */
  }

  /* Animated gradient border */
  .spinner::before {
    /* Use CSS variables for theme-aware colors */
    background: conic-gradient(
      transparent 0%,
      rgba(var(--primary-rgb-light), 0.1) 50%, /* Base color for light */
      transparent 100%
    );
    /* Ensure animation uses GPU */
    animation: rotate 1.5s linear infinite;
    will-change: transform;
    opacity: 1; /* Default opacity */
  }

  /* Inner circle matching background */
  .spinner::after {
    width: 85%;
    height: 85%;
    top: 7.5%;
    left: 7.5%;
    background: var(--color-background); /* Theme-aware background */
    border-radius: 50%;
  }

  /* Adjust opacity in dark mode */
  .dark .spinner::before {
     /* Use dark primary color */
     background: conic-gradient(
      transparent 0%,
      rgba(var(--primary-rgb-dark), 0.15) 50%, /* Dark primary color with slight alpha */
      transparent 100%
    );
    opacity: 0.8; /* Original dark mode opacity */
  }

  /* Rotation animation */
  @keyframes rotate {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style> 