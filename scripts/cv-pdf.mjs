// Renders dist/cv/index.html to dist/cv.pdf with headless Chrome.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import puppeteer from 'puppeteer-core';

const executablePath = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].find((p) => p && existsSync(p));
if (!executablePath) {
  console.warn('[cv-pdf] No Chrome found; set CHROME_PATH. Skipping PDF.');
  process.exit(0);
}

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  let file = join('dist', decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
}).listen(0);
const { port } = server.address();

try {
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/cv/`, { waitUntil: 'networkidle0' });
  await page.emulateMediaType('print');
  await page.pdf({ path: 'dist/cv.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log('[cv-pdf] wrote dist/cv.pdf');
} finally {
  server.close();
}
