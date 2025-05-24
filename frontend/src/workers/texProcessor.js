/* eslint-disable no-restricted-globals */

// import { convertTeXToMathDollars } from '../utils/formatters';

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

// Worker listens for { id, content } and returns id alongside converted TeX
self.onmessage = (event) => {
  const { id, content } = event.data;
  try {
    const result = convertTeXToMathDollars(content);
    self.postMessage({ id, success: true, data: result });
  } catch (error) {
    self.postMessage({ id, success: false, error: error.message || 'Error processing TeX' });
  }
}; 