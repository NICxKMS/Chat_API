/**
 * Script to move TypeScript files to a separate ts/ directory
 * while preserving the original folder structure
 */
const fs = require('fs');
const path = require('path');

// Configuration
const sourceDir = 'src';
const targetDir = 'ts/src';
const fileExtensions = ['.ts', '.tsx', '.d.ts'];
const ignoreDirs = ['node_modules', 'dist', 'ts'];

/**
 * Check if a file is a TypeScript file
 * @param {string} filename - The filename to check
 * @returns {boolean} True if the file is a TypeScript file
 */
function isTypeScriptFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return fileExtensions.includes(ext);
}

/**
 * Create directory recursively if it doesn't exist
 * @param {string} dir - The directory path to create
 */
function createDirIfNotExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Process a directory recursively to move TypeScript files
 * @param {string} sourceDir - The source directory
 * @param {string} targetDir - The target directory
 */
function processDirectory(sourceDir, targetDir) {
  // Create target directory if it doesn't exist
  createDirIfNotExists(targetDir);
  
  // Read directory contents
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  
  entries.forEach(entry => {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip ignored directories
      if (ignoreDirs.includes(entry.name)) {
        return;
      }
      
      // Process subdirectory recursively
      processDirectory(sourcePath, targetPath);
    } else if (entry.isFile() && isTypeScriptFile(entry.name)) {
      console.log(`Moving: ${sourcePath} -> ${targetPath}`);
      
      // Copy file to target directory
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}

// Create the base target directory
createDirIfNotExists(targetDir);

// Start processing from the source directory
console.log(`Moving TypeScript files from ${sourceDir} to ${targetDir}...`);
processDirectory(sourceDir, targetDir);
console.log('Done!'); 