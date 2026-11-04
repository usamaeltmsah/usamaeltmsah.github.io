// Renders dist/cv/index.html to dist/cv.pdf with headless Chrome, fitted to 2 A4 pages.
import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { extname, join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { checkAts, extractPages } from './ats.ts';
import { fitToPages } from './pdf-fit.ts';

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

const profile = JSON.parse(readFileSync('src/content/profile.json', 'utf8')) as { name: string; url: string };
const site = profile.url.replace(/^https?:\/\//, '').replace(/\/$/, '');

const types: Record<string, string> = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
};
const server = createServer((req, res) => {
  let file = join('dist', decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
}).listen(0);
const { port } = server.address() as AddressInfo;

const footer = `<div style="width:100%;padding:0 12mm;display:flex;justify-content:space-between;font:7px Arial,sans-serif;color:#8a90a0">
  <span>${profile.name} · CV · ${site}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/cv/`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMediaType('print');
  const { pdf, pages, scale } = await fitToPages((s) =>
    page.pdf({
      format: 'A4', printBackground: true, preferCSSPageSize: true, scale: s,
      displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: footer,
    }),
  );
  writeFileSync('dist/cv.pdf', pdf);
  console.log(`[cv-pdf] wrote dist/cv.pdf: ${pages} page(s) at ${Math.round(scale * 100)}% scale`);

  // Read the PDF back the way an ATS does and fail the build if anything is lost or out of order.
  const projectDir = 'src/content/projects';
  const cvProjects = readdirSync(projectDir)
    .map((f) => JSON.parse(readFileSync(join(projectDir, f), 'utf8')) as { name: string; onCv?: boolean })
    .filter((p) => p.onCv).map((p) => p.name);
  const problems = checkAts({
    pages: await extractPages(pdf), pdf,
    resume: JSON.parse(readFileSync('dist/resume.json', 'utf8')),
    projects: cvProjects,
  });
  if (problems.length) {
    throw new Error(`CV is not ATS-friendly:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  }
  console.log('[cv-pdf] ATS check passed: text layer complete, in order, standard headings, no Type3 fonts');
} finally {
  await browser.close();
  server.close();
}
