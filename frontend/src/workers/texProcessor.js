/* eslint-disable no-restricted-globals */

import { convertTeXToMathDollars } from '../utils/formatters';

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