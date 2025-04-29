const fs = require('fs').promises;
const path = require('path');

(async () => {
  try {
    const unusedContent = await fs.readFile('plans/unused-css-variables.txt', 'utf-8');
    const unused = new Set(unusedContent.split(/\r?\n/).filter(Boolean));
    const themePath = path.join('src', 'styles', 'theme.css');
    const themeContent = await fs.readFile(themePath, 'utf-8');
    const lines = themeContent.split(/\r?\n/);
    const filtered = lines.filter(line => {
      const match = line.match(/^\s*--([\w-]+)\s*:/);
      if (match) {
        return !unused.has(match[1]);
      }
      return true;
    });
    await fs.writeFile(themePath, filtered.join('\n'), 'utf-8');
    console.log(`Removed ${unused.size} unused CSS variables from ${themePath}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})(); 