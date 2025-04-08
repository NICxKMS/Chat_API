/**
 * Formats URLs in text into clickable links
 * @param {string} text - Input text that may contain URLs
 * @returns {string} - Text with URLs wrapped in <a> tags
 */
export const formatUrls = (text) => {
  if (!text) return '';
  
  // URL regex pattern - improved to handle more URL formats
  const urlPattern = /(https?:\/\/[^\s'")<>]+)(?=[.,:;!?]*(\s|$|<))/g;
  
  // Replace URLs with anchor tags
  return text.replace(urlPattern, (url) => {
    const cleanUrl = url.replace(/[.,;:!?]+$/, ''); // Clean trailing punctuation
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`;
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
 * with improved language detection and formatting
 * @param {string} content - Input text which may contain code blocks delimited by ```
 * @returns {string} - Formatted HTML with code blocks properly wrapped
 */
export const processCodeBlocks = (content) => {
  if (!content) return '';
  
  const codeBlockRegex = /```([\w-]*)\n?([\s\S]*?)```/g;
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
    const language = match[1].trim() || 'plaintext';
    const code = match[2].trim();
    
    // Normalize language identifier
    const normalizedLanguage = normalizeLanguageId(language);
    
    // Add formatted code block
    parts.push(
      `<pre><code class="language-${normalizedLanguage}">${escapeHtml(code)}</code></pre>`
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
 * Normalizes language identifiers for syntax highlighting
 * @param {string} lang - Raw language identifier from markdown
 * @returns {string} - Normalized language identifier
 */
export const normalizeLanguageId = (lang) => {
  // Handle common aliases and normalize language IDs
  const languageMap = {
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'jsx',
    'tsx': 'tsx',
    'py': 'python',
    'rb': 'ruby',
    'sh': 'bash',
    'bash': 'bash',
    'shell': 'bash',
    'zsh': 'bash',
    'c': 'c',
    'cpp': 'cpp',
    'cs': 'csharp',
    'java': 'java',
    'go': 'go',
    'rust': 'rust',
    'php': 'php',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sql': 'sql',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'md': 'markdown',
    'tex': 'latex',
    'kotlin': 'kotlin',
    'swift': 'swift',
    'plaintext': 'plaintext',
    'txt': 'plaintext',
    '': 'plaintext'
  };
  
  return languageMap[lang.toLowerCase()] || lang.toLowerCase() || 'plaintext';
};

/**
 * Wraps text in paragraph tags, respecting existing paragraph breaks
 * with support for markdown formatting
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
 * Detects and formats Markdown tables in text
 * @param {string} text - Text that may contain Markdown tables
 * @returns {string} - Text with tables converted to HTML
 */
export const formatMarkdownTables = (text) => {
  if (!text) return '';
  
  // Regex to match markdown tables
  const tableRegex = /(\|[^\n]+\|\n)((?:\|[ :]*[-:]+[ :]*)+\|)(\n(?:\|[^\n]+\|\n?)*)/g;
  
  return text.replace(tableRegex, (match, headerRow, separatorRow, bodyRows) => {
    // Process the header row
    const headers = headerRow.trim().split('|').slice(1, -1).map(cell => cell.trim());
    
    // Process the alignment row (determines column alignment)
    const alignments = separatorRow.trim().split('|').slice(1, -1).map(cell => {
      const trimmed = cell.trim();
      if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
      if (trimmed.endsWith(':')) return 'right';
      return 'left';
    });
    
    // Process the body rows
    const rows = bodyRows.trim().split('\n').map(row => 
      row.trim().split('|').slice(1, -1).map(cell => cell.trim())
    );
    
    // Build the HTML table
    let tableHtml = '<div class="table-wrapper"><table>';
    
    // Add header
    tableHtml += '<thead><tr>';
    headers.forEach((header, index) => {
      const align = alignments[index] || 'left';
      tableHtml += `<th style="text-align: ${align}">${escapeHtml(header)}</th>`;
    });
    tableHtml += '</tr></thead>';
    
    // Add body
    tableHtml += '<tbody>';
    rows.forEach(row => {
      tableHtml += '<tr>';
      row.forEach((cell, index) => {
        const align = alignments[index] || 'left';
        tableHtml += `<td style="text-align: ${align}">${escapeHtml(cell)}</td>`;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table></div>';
    
    return tableHtml;
  });
};

/**
 * Complete message content formatting pipeline with enhanced markdown support
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
  const urlPattern = /(https?:\/\/[^\s'")<>]+)(?=[.,:;!?]*(\s|$|<))/g;
  const codeBlockRegex = /```([\w-]*)\n?([\s\S]*?)```/g;
  
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
        const cleanUrl = url.replace(/[.,;:!?]+$/, ''); // Clean trailing punctuation
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`;
      });
      parts.push(wrapTextInParagraphs(formattedText));
    }
    
    // Get language and code
    const language = match[1].trim() || 'plaintext';
    const code = match[2].trim();
    
    // Normalize language identifier
    const normalizedLanguage = normalizeLanguageId(language);
    
    // Add formatted code block with escaped code
    parts.push(
      `<pre><code class="language-${normalizedLanguage}">${escapeHtml(code)}</code></pre>`
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Process remaining text after last code block
  if (lastIndex < content.length) {
    const textAfter = content.substring(lastIndex);
    const escapedText = textAfter.replace(/[&<>"']/g, (char) => htmlEntities[char]);
    const formattedText = escapedText.replace(urlPattern, (url) => {
      const cleanUrl = url.replace(/[.,;:!?]+$/, ''); // Clean trailing punctuation
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`;
    });
    
    // Format tables in the remaining text
    const textWithTables = formatMarkdownTables(formattedText);
    
    parts.push(wrapTextInParagraphs(textWithTables));
  }
  
  return parts.join('');
}; 