/**
 * Script to remove unused imports using eslint-plugin-unused-imports directly
 * To use: node remove-unused-imports-eslint.js
 */

const { ESLint } = require('eslint');
const fs = require('fs');
const path = require('path');

async function main() {
  // Create ESLint instance with our configuration
  const eslint = new ESLint({
    fix: true,
    useEslintrc: false,
    overrideConfig: {
      root: true,
      env: {
        browser: true,
        es2021: true,
        node: true
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      extends: [],
      plugins: ['unused-imports'],
      rules: {
        // Only use the unused-imports rules
        'unused-imports/no-unused-imports': 'error',
        'unused-imports/no-unused-vars': [
          'warn',
          { 
            'vars': 'all', 
            'varsIgnorePattern': '^_', 
            'args': 'after-used', 
            'argsIgnorePattern': '^_' 
          }
        ]
      }
    }
  });

  // Get all JS/JSX/TS/TSX files in the src directory
  function getFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        getFiles(filePath, fileList);
      } else {
        if (/\.(js|jsx|ts|tsx)$/.test(file)) {
          fileList.push(filePath);
        }
      }
    });
    
    return fileList;
  }

  try {
    const srcDir = path.join(__dirname, 'src');
    if (!fs.existsSync(srcDir)) {
      console.error('src directory not found!');
      process.exit(1);
    }

    const files = getFiles(srcDir);

    if (files.length === 0) {
      console.log('No JavaScript/TypeScript files found in src directory.');
      process.exit(0);
    }

    console.log(`Found ${files.length} files to process.`);
    
    // Lint and fix files
    console.log('Linting and fixing files...');
    const results = await eslint.lintFiles(files);
    
    // Apply fixes
    await ESLint.outputFixes(results);
    
    // Log results
    let fixedCount = 0;
    results.forEach(result => {
      if (result.output) {
        fixedCount++;
        console.log(`Fixed: ${result.filePath}`);
      }
    });
    
    console.log(`Successfully fixed ${fixedCount} out of ${files.length} files.`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();