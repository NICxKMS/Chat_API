/**
 * Formats URLs in text into clickable links
 * @param {string} text - Input text that may contain URLs
 * @returns {string} - Text with URLs wrapped in <a> tags
 */
export const formatUrls = (text) => {
  if (!text) return '';
  
  // URL regex pattern
  const urlPattern = /https?:\/\/[^\s]+/g;
  
  // Replace URLs with anchor tags
  return text.replace(urlPattern, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
};

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} text - Input text that may contain HTML characters
 * @returns {string} - Text with HTML characters escaped
 */
export const escapeHtml = (text) => {
  if (!text) return '';
  
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
};

/**
 * Processes a string of text to identify and format code blocks
 * @param {string} content - Input text which may contain code blocks delimited by ```
 * @returns {string} - Formatted HTML with code blocks properly wrapped
 */
export const processCodeBlocks = (content) => {
  if (!content) return '';
  
  const codeBlockRegex = /```(\w*)([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  
  // Find all code blocks
  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textBefore = content.substring(lastIndex, match.index);
      parts.push(wrapTextInParagraphs(textBefore));
    }
    
    // Get language and code
    const language = match[1].trim();
    const code = match[2].trim();
    
    // Add formatted code block
    parts.push(
      `<pre><code class="language-${language || 'plaintext'}">${code}</code></pre>`
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after last code block
  if (lastIndex < content.length) {
    const textAfter = content.substring(lastIndex);
    parts.push(wrapTextInParagraphs(textAfter));
  }
  
  return parts.join('');
};

/**
 * Wraps text in paragraph tags, respecting existing paragraph breaks
 * @param {string} text - Input text to be wrapped in paragraphs
 * @returns {string} - Text wrapped in paragraph tags
 */
export const wrapTextInParagraphs = (text) => {
  if (!text) return '';
  
  // Use a single-pass approach with string concatenation
  let result = '';
  let currentParagraph = '';
  let consecutiveBreaks = 0;
  
  // Process each character to identify paragraph breaks
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      consecutiveBreaks++;
      
      // Add <br> for single breaks
      if (consecutiveBreaks === 1) {
        currentParagraph += '<br>';
      }
      // Start a new paragraph for double breaks
      else if (consecutiveBreaks === 2) {
        // Close the current paragraph if not empty
        if (currentParagraph) {
          result += `<p>${currentParagraph}</p>`;
          currentParagraph = '';
        }
        consecutiveBreaks = 0;
      }
    } else {
      // Reset consecutive breaks counter for non-newline characters
      consecutiveBreaks = 0;
      currentParagraph += text[i];
    }
  }
  
  // Add the last paragraph if there's any content left
  if (currentParagraph) {
    result += `<p>${currentParagraph}</p>`;
  }
  
  // If no paragraphs were created, wrap the entire text
  if (!result && text) {
    result = `<p>${text}</p>`;
  }
  
  return result;
};

/**
 * Complete message content formatting pipeline
 * @param {string} content - Raw message content
 * @returns {string} - Fully formatted HTML
 */
export const formatMessageContent = (content) => {
  if (!content) return '';
  
  // Process in a single pass through the content
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  
  // URL regex pattern
  const urlPattern = /https?:\/\/[^\s]+/g;
  const codeBlockRegex = /```(\w*)([\s\S]*?)```/g;
  
  const parts = [];
  let lastIndex = 0;
  let match;
  
  // Find all code blocks
  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Process text before code block: escape HTML and format URLs
    if (match.index > lastIndex) {
      const textBefore = content.substring(lastIndex, match.index);
      const escapedText = textBefore.replace(/[&<>"']/g, (char) => htmlEntities[char]);
      const formattedText = escapedText.replace(urlPattern, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
      });
      parts.push(wrapTextInParagraphs(formattedText));
    }
    
    // Get language and code
    const language = match[1].trim();
    const code = match[2].trim();
    
    // Add formatted code block (code content is already inside pre/code tags, no need to escape)
    parts.push(
      `<pre><code class="language-${language || 'plaintext'}">${code}</code></pre>`
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Process remaining text after last code block
  if (lastIndex < content.length) {
    const textAfter = content.substring(lastIndex);
    const escapedText = textAfter.replace(/[&<>"']/g, (char) => htmlEntities[char]);
    const formattedText = escapedText.replace(urlPattern, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    parts.push(wrapTextInParagraphs(formattedText));
  }
  
  return parts.join('');
}; 