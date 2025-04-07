/**
 * A Svelte action for automatically resizing textareas based on content
 * @param {HTMLTextAreaElement} node - The textarea element
 * @returns {object} - Svelte action object
 */
export default function autosizeTextarea(node) {
  // Skip if the node is not a textarea
  if (node.tagName.toLowerCase() !== 'textarea') {
    return {};
  }

  // Function to adjust height
  const resize = () => {
    node.style.height = '0';
    node.style.height = node.scrollHeight + 'px';
  };

  // Initial resize
  resize();

  // Listen for input events
  node.addEventListener('input', resize);
  
  // Resize on window resize too
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(node);

  return {
    // Clean up event listeners when the element is destroyed
    destroy() {
      node.removeEventListener('input', resize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    }
  };
} 