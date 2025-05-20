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

/**
 * Converts LaTeX-style math delimiters to Markdown-style dollar delimiters ($...$ and $$...$$).
 * Optimized for performance on larger inputs using a single regex pass.
 * Handles common LaTeX formats like \(...\) and \[...\], plus a custom block format [/.../].
 * Avoids conversion within ```code fences```.
 * Replaces block delimiters with $$...$$ exactly in place, preserving original outer indentation
 * and the exact whitespace/newline structure around the content for Markdown parser compatibility.
 * Removes text trailing the closing block delimiters (\] or /]).
 *
 * @param {string} text The input text possibly containing LaTeX math.
 * @returns {string} Text with math delimiters converted for Markdown processors like KaTeX/MathJax.
 */
export const convertTeXToMathDollars = (text) => {
  // Early exit for empty or non-string input
  if (typeof text !== 'string' || text === '') {
    return '';
  }

  // --- Regex Component Definitions ---
  // Note: Escaping is doubled because these strings are passed to the RegExp constructor.

  // Group 1: Code block (```...```)
  const codeBlock = '(```[\\s\\S]*?```)';

  // Group 2: Indent for \[...], Group 3: Content for \[...], Group 4: Trailing text for \[...\]
  // eslint-disable-next-line no-useless-escape
  const blockTex = '^(\\s*)\\\\\\\[([\\s\\S]*?)\\\\\\](.*)'; // Matches \[ content \]

  // Group 5: Indent for [/...], Group 6: Content for [/...], Group 7: Trailing text for [/...]
  const blockCustom = '^(\\s*)\\[\\\\/([\\s\\S]*?)\\\\/](.*)'; // Matches [/ content /]

  // Group 8: Content for \(...) (handles surrounding whitespace)
  const inlineTex = '\\\\\\(\\s*(.*?)\\s*\\\\\\)'; // Matches \( content \)

  // --- Combined Regex ---
  // Joins patterns with '|' (OR) for a single pass. 'gm' flags are crucial.
  const combinedRegex = new RegExp(
    `${codeBlock}|${blockTex}|${blockCustom}|${inlineTex}`,
    'gm'
  );

  // --- Single Replace Operation ---
  let result = text.replace(combinedRegex, (
    match, // The entire matched string (unused but required by replace)
    // Captured Groups (undefined if the corresponding pattern part didn't match):
    g1_code,        // Group 1: Code block content
    g2_bTexIndent,  // Group 2: Indentation before \[
    g3_bTexContent, // Group 3: Content inside \[...]
    g4_bTexTrail,   // Group 4: Trailing text after \]
    g5_bCustIndent, // Group 5: Indentation before [/
    g6_bCustContent,// Group 6: Content inside [/...]
    g7_bCustTrail,  // Group 7: Trailing text after /]
    g8_inlineContent// Group 8: Content inside \(...) including surrounding space captured by \s*
  ) => {
    // Case 1: Code block matched - return unmodified
    if (g1_code !== undefined) {
      return g1_code;
    }

    // Case 2: Standard block math \[...] matched - perform in-place replacement
    if (g2_bTexIndent !== undefined) {
      // Return: preserved indent + $$ + exact content + $$ (trailing text g4 is discarded)
      return `${g2_bTexIndent}$$${g3_bTexContent}$$`;
    }

    // Case 3: Custom block math [/...] matched - perform in-place replacement
    if (g5_bCustIndent !== undefined) {
      // Return: preserved indent + $$ + exact content + $$ (trailing text g7 is discarded)
      return `${g5_bCustIndent}$$${g6_bCustContent}$$`;
    }

    // Case 4: Inline math \(...) matched - trim content
    if (g8_inlineContent !== undefined) {
      // Return: $ + trimmed content + $
      return `$${g8_inlineContent.trim()}$`;
    }

    // Fallback (should not happen with a correct regex, but safe practice)
    return match;
  });

  // --- Final Cleanup ---
  // Optional: Reduce excessive newlines (run last).
  // This step is separate as it cleans up potentially pre-existing blank lines
  // and doesn't depend on the specific match type from the main regex.
  // Running it twice is a simple, usually sufficient way to handle sequences > 4 newlines.
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
};