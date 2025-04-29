const fs = require('fs').promises;
const path = require('path');

(async () => {
  try {
    const unusedContent = await fs.readFile('plans/unused-css-variables.txt', 'utf-8');
    const unused = new Set(unusedContent.split(/\r?\n/).filter(Boolean));
    const colorsPath = path.join('src', 'styles', 'common', 'colors.css');
    const content = await fs.readFile(colorsPath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const filtered = lines.filter(line => {
      const match = line.match(/^\s*--([\w-]+)\s*:/);
      if (match) {
        return !unused.has(match[1]);
      }
      return true;
    });
    await fs.writeFile(colorsPath, filtered.join('\n'), 'utf-8');
    console.log(`Removed ${unused.size} unused CSS variables from ${colorsPath}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})(); 