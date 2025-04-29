const fs = require('fs').promises;
const path = require('path');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(await walk(fullPath));
    } else if (/\.(tsx|jsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

(async () => {
  try {
    const files = await walk('src');
    const usage = [];
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      if (/import\s+.*\.(css|scss)["']/.test(content)) {
        usage.push(file);
      }
    }
    await fs.writeFile('plans/components-using-css.txt', usage.join('\n'), 'utf-8');
    console.log('Component CSS usage written to plans/components-using-css.txt');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})(); 