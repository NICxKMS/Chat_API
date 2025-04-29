const fs = require('fs').promises;
const path = require('path');
const postcss = require('postcss');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(await walk(fullPath));
    } else if (/\.(css|scss)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

(async () => {
  try {
    const files = await walk('src/styles');
    const ruleMap = new Map();
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      const root = postcss.parse(content, { from: file });
      root.walkRules(rule => {
        const decls = rule.nodes
          .filter(n => n.type === 'decl')
          .map(n => `${n.prop.trim()}:${n.value.trim()}`)
          .sort();
        if (decls.length === 0) return;
        const key = decls.join(';');
        const locations = ruleMap.get(key) || [];
        locations.push({ file, selector: rule.selector });
        ruleMap.set(key, locations);
      });
    }

    const duplicates = [];
    for (const [declarations, locations] of ruleMap) {
      if (locations.length > 1) duplicates.push({ declarations, locations });
    }

    let output = `Found ${duplicates.length} duplicate rule groups:\n\n`;
    duplicates.forEach((dup, idx) => {
      output += `Group ${idx + 1}:\n`;
      output += `Declarations: ${dup.declarations}\n`;
      dup.locations.forEach(loc => {
        output += `  - ${loc.file}: ${loc.selector}\n`;
      });
      output += `\n`;
    });

    await fs.writeFile('plans/duplicate-css-rules.txt', output, 'utf8');
    console.log(`Duplicate CSS rule groups written to plans/duplicate-css-rules.txt`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})(); 