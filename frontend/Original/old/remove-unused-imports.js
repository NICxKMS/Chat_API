/**
 * Simple script to remove unused imports from JavaScript/TypeScript files
 * To use: node remove-unused-imports.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// Function to run VSCode's organize imports command
// This uses the 'code' CLI which should be in your PATH if VSCode is installed
function organizeImports(filePath) {
  try {
    console.log(`Processing: ${filePath}`);
    
    // For Windows, the path needs to be properly formatted
    const formattedPath = filePath.replace(/\\/g, '/');
    
    // Execute VS Code's "Organize Imports" command
    // --goto opens the file
    // --wait waits for the file to be closed
    // The command is sent via args
    const command = `code --goto "${formattedPath}" --wait ` +
                   `--command "editor.action.organizeImports" ` +
                   `--command "workbench.action.files.save" ` +
                   `--command "workbench.action.closeActiveEditor"`;
    
    // Execute the command
    execSync(command, { stdio: 'inherit' });
    
    return true;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return false;
  }
}

// Main process
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

let processed = 0;
files.forEach(file => {
  if (organizeImports(file)) {
    processed++;
  }
});

console.log(`Successfully processed ${processed} out of ${files.length} files.`); 