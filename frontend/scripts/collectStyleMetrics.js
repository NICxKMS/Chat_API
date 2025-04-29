const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function walk(dir) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  let results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(await walk(fullPath));
    } else if (/\.(css|scss)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function processFile(file) {
  return new Promise((resolve, reject) => {
    let lines = 0;
    const selectors = [];
    const stream = fs.createReadStream(file, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    rl.on('line', (line) => {
      lines++;
      if (/^\s*[^@].+\{/.test(line)) {
        selectors.push(line.trim().replace(/\{$/, ''));
      }
    });
    rl.on('close', () => resolve({ lines, selectors }));
    rl.on('error', reject);
  });
}

(async () => {
  try {
    const files = await walk('src');
    let totalLines = 0;
    let selectors = [];
    for (const file of files) {
      const { lines, selectors: fileSelectors } = await processFile(file);
      totalLines += lines;
      selectors = selectors.concat(fileSelectors);
    }
    const uniqueSelectors = Array.from(new Set(selectors));
    const totalRules = selectors.length;
    const uniqueCount = uniqueSelectors.length;

    console.log(`Total CSS/Sass lines: ${totalLines}`);
    console.log(`Total selector instances: ${totalRules}`);
    console.log(`Unique selectors: ${uniqueCount}`);
    console.log(`Duplicate selector instances: ${totalRules - uniqueCount}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})(); 