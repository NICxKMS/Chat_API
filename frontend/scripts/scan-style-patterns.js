#!/usr/bin/env node

// scripts/scan-style-patterns.js
// This script scans CSS and CSS module files for repeated style patterns
// and generates a report grouping occurrences by property and value.

const glob = require('glob');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const safeParser = require('postcss-safe-parser');

const SRC_DIR = path.resolve(__dirname, '../src');
const OUTPUT_FILE = path.resolve(__dirname, '../plans/duplicate-style-patterns.txt');

(async () => {
  const patterns = {};

  // Find all .css and .module.css files under src
  const cssFiles = glob.sync('**/*.{css,module.css}', { cwd: SRC_DIR, absolute: true });

  for (const filePath of cssFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    let root;
    try {
      root = postcss.parse(content, { from: filePath, parser: safeParser });
    } catch (err) {
      console.error(`Failed to parse ${filePath}:`, err.message);
      continue;
    }

    root.walkDecls(decl => {
      const prop = decl.prop;
      const val = decl.value;
      const relFile = path.relative(process.cwd(), filePath);
      const line = decl.source.start.line;

      if (!patterns[prop]) patterns[prop] = {};
      if (!patterns[prop][val]) patterns[prop][val] = [];
      patterns[prop][val].push({ file: relFile, line });
    });
  }

  // Write report
  const lines = ['# Duplicate Style Patterns Report', ''];
  Object.entries(patterns).forEach(([prop, values]) => {
    lines.push(`## Property: ${prop}`, '');
    Object.entries(values).forEach(([val, occ]) => {
      lines.push(`### Value: ${val} (${occ.length} occurrences)`);
      occ.forEach(({ file, line }) => {
        lines.push(`- ${file}:${line}`);
      });
      lines.push('');
    });
  });

  fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf8');
  console.log(`Styles report written to ${OUTPUT_FILE}`);
})(); 