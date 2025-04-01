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
  
  // Replace single line breaks with <br>
  const withLineBreaks = text.replace(/\n/g, '<br>');
  
  // Split on doubled line breaks (<br><br>) to create paragraphs
  const paragraphs = withLineBreaks.split(/<br><br>/g);
  
  // Wrap each paragraph in <p> tags
  return paragraphs
    .map(p => `<p>${p}</p>`)
    .join('');
};

/**
 * Complete message content formatting pipeline
 * @param {string} content - Raw message content
 * @returns {string} - Fully formatted HTML
 */
export const formatMessageContent = (content) => {
  if (!content) return '';
  
  // Process in sequence: escape HTML, format URLs, process code blocks
  let processedContent = escapeHtml(content);
  processedContent = formatUrls(processedContent);
  processedContent = processCodeBlocks(processedContent);
  
  return processedContent;
}; 