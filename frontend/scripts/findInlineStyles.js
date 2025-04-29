const fs = require('fs').promises;
const path = require('path');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(await walk(fullPath));
    } else if (/\.(tsx|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

(async () => {
  try {
    const files = await walk('src');
    const usages = [];
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (/style=\{\s*\{/.test(line) || /style=\"/.test(line)) {
          usages.push(`${file}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
    await fs.writeFile('plans/inline-style-usages.txt', usages.join('\n'), 'utf-8');
    console.log('Inline style usages written to plans/inline-style-usages.txt');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})(); 