const fs = require('fs').promises;
const path = require('path');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

(async () => {
  try {
    const themePath = path.join('src', 'styles', 'theme.css');
    const themeContent = await fs.readFile(themePath, 'utf-8');
    const varNames = [...themeContent.matchAll(/^\s*--([\w-]+)\s*:/gm)].map(m => m[1]);
    const allFiles = (await walk('src')).filter(f => /\.(css|scss|js|jsx|ts|tsx)$/.test(f));
    const unused = [];
    for (const varName of varNames) {
      let found = false;
      const regex1 = new RegExp(`--${varName}\b`);
      const regex2 = new RegExp(`var\(--${varName}\)`);
      for (const file of allFiles) {
        const content = await fs.readFile(file, 'utf-8');
        if (regex1.test(content) || regex2.test(content)) {
          found = true;
          break;
        }
      }
      if (!found) unused.push(varName);
    }
    await fs.writeFile('plans/unused-css-variables.new.txt', unused.join('\n'), 'utf-8');
    console.log('Unused CSS variables written to plans/unused-css-variables.txt');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})(); 