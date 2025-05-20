const http = require('http');
const handler = require('serve-handler');
const path = require('path');
const fs = require('fs').promises;
const puppeteer = require('puppeteer');

(async () => {
  const buildDir = path.resolve(__dirname, 'dist');
  // Start static file server
  const server = http.createServer((request, response) => {
    return handler(request, response, { public: buildDir });
  });
  const port = 4173;
  await new Promise(resolve => server.listen(port, resolve));
  console.log(`🚀 Prerender server running at http://localhost:${port}`);

  // Launch headless browser
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const url = `http://localhost:${port}/`;
  console.log(`🔎 Navigating to ${url}`);
  await page.goto(url, { waitUntil: 'networkidle0' });

  // Capture HTML
  const html = await page.content();
  const indexPath = path.join(buildDir, 'index.html');
  await fs.writeFile(indexPath, html, 'utf8');
  console.log(`✅ Prerendered route '/' into ${indexPath}`);

  // Cleanup
  await browser.close();
  server.close();
})(); 