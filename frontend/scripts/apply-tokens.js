#!/usr/bin/env node

// scripts/apply-tokens.js
// Applies semantic CSS tokens to all CSS/Module files by replacing raw values.

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const safeParser = require('postcss-safe-parser');
const glob = require('glob');

// Define property-specific mappings for tokens
const PROP_TOKEN_MAP = {
  // Spacing for margin/padding/gap
  'margin': {
    '4px': 'var(--spacing-xs)', '8px': 'var(--spacing-sm)', '12px': 'var(--spacing-md)', '16px': 'var(--spacing-lg)', '24px': 'var(--spacing-xl)', '32px': 'var(--spacing-xxl)',
  },
  'padding': 'margin',
  'gap': 'margin',
  'row-gap': 'margin',
  'column-gap': 'margin',
  'margin-top': 'margin',
  'margin-right': 'margin',
  'margin-bottom': 'margin',
  'margin-left': 'margin',
  'padding-top': 'margin',
  'padding-right': 'margin',
  'padding-bottom': 'margin',
  'padding-left': 'margin',
  // Border radius
  'border-radius': {
    '2px': 'var(--radius-xs)', '4px': 'var(--radius-sm)', '6px': 'var(--radius-md)', '8px': 'var(--radius-lg)', '12px': 'var(--radius-xl)', '16px': 'var(--radius-xxl)',
  },
  // Font size
  'font-size': {
    '0.75rem': 'var(--font-size-xs)', '0.875rem': 'var(--font-size-sm)', '1rem': 'var(--font-size-md)', '1.125rem': 'var(--font-size-lg)', '1.25rem': 'var(--font-size-xl)', '1.5rem': 'var(--font-size-xxl)',
  },
  // Line height
  'line-height': {
    '1rem': 'var(--line-height-xs)', '1.25rem': 'var(--line-height-sm)', '1.5rem': 'var(--line-height-md)', '1.75rem': 'var(--line-height-lg)', '2rem': 'var(--line-height-xl)', '2.25rem': 'var(--line-height-xxl)',
  },
  // Font weight
  'font-weight': {
    '200': 'var(--font-weight-xs)', '300': 'var(--font-weight-sm)', '400': 'var(--font-weight-md)', '500': 'var(--font-weight-lg)', '600': 'var(--font-weight-xl)', '700': 'var(--font-weight-xxl)',
  },
  // Letter spacing
  'letter-spacing': {
    '0em': 'var(--letter-spacing-xs)', '0.025em': 'var(--letter-spacing-sm)', '0.05em': 'var(--letter-spacing-md)', '0.1em': 'var(--letter-spacing-lg)', '0.15em': 'var(--letter-spacing-xl)', '0.2em': 'var(--letter-spacing-xxl)',
  },
  // Transition & animation durations and delays
  'transition-duration': {
    '150ms': 'var(--duration-xs)', '200ms': 'var(--duration-sm)', '300ms': 'var(--duration-md)', '500ms': 'var(--duration-lg)', '700ms': 'var(--duration-xl)', '1000ms': 'var(--duration-xxl)',
  },
  'transition-delay': 'transition-duration',
  'animation-delay': 'transition-duration',
  // Opacity
  'opacity': {
    '0.1': 'var(--opacity-xs)', '0.25': 'var(--opacity-sm)', '0.5': 'var(--opacity-md)', '0.75': 'var(--opacity-lg)', '0.9': 'var(--opacity-xl)', '1': 'var(--opacity-xxl)',
  },
  // Border width
  'border-width': {
    '1px': 'var(--border-width-xs)', '2px': 'var(--border-width-sm)', '3px': 'var(--border-width-md)', '4px': 'var(--border-width-lg)', '6px': 'var(--border-width-xl)', '8px': 'var(--border-width-xxl)',
  },
  // Box-shadow: leave as raw or define mapping for shadow values if needed
};

(async () => {
  const cssFiles = glob.sync('src/**/*.{css,module.css}', { absolute: true });

  for (const file of cssFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let root;
    try {
      root = postcss.parse(content, { from: file, parser: safeParser });
    } catch (err) {
      console.error(`Error parsing ${file}: ${err}`);
      continue;
    }

    let changed = false;

    root.walkDecls(decl => {
      const prop = decl.prop;
      let mapping = PROP_TOKEN_MAP[prop];
      // handle alias of mapping
      if (typeof mapping === 'string') mapping = PROP_TOKEN_MAP[mapping];
      if (mapping) {
        const parts = decl.value.split(/\s+/).map(token => mapping[token] || token);
        const newVal = parts.join(' ');
        if (newVal !== decl.value) {
          decl.value = newVal;
          changed = true;
        }
      }
    });

    if (changed) {
      const newCss = root.toString();
      fs.writeFileSync(file, newCss, 'utf8');
      console.log(`Updated tokens in: ${path.relative(process.cwd(), file)}`);
    }
  }

  console.log('Token application complete');
})(); 