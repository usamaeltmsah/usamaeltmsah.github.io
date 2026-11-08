// Screenshots each dist/share/<id>/ card to dist/share/<id>.png (1200×630) for link previews,
// then removes the card pages so only the images are published.
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { chromePath, serveDist } from './headless.ts';

const dir = join('dist', 'share');
const ids = existsSync(dir) ? readdirSync(dir).filter((f) => existsSync(join(dir, f, 'index.html'))) : [];
const executablePath = chromePath();

if (!executablePath) {
  // Without Chrome the cards can't render. Fail in CI; locally fall back to the site image so no preview breaks.
  if (process.env.CI) throw new Error('[share-images] No Chrome found; set CHROME_PATH.');
  console.warn('[share-images] No Chrome found; using og.png for every case study.');
  for (const id of ids) copyFileSync(join('dist', 'og.png'), join(dir, `${id}.png`));
} else if (ids.length) {
  const { origin, server } = serveDist();
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630 });
    for (const id of ids) {
      await page.goto(`${origin}/share/${id}/`, { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: join(dir, `${id}.png`) as `${string}.png` });
    }
  } finally {
    await browser.close();
    server.close();
  }
}
for (const id of ids) rmSync(join(dir, id), { recursive: true });

// Every page that points at a share image must have one, or its link previews come up blank.
const missing = readdirSync('dist', { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.html'))
  .flatMap((f) => [...readFileSync(join('dist', f), 'utf8').matchAll(/property="og:image" content="[^"]*?(\/share\/[^"]+)"/g)].map((m) => m[1]))
  .filter((img) => !existsSync(join('dist', img)));
if (missing.length) throw new Error(`[share-images] pages link to missing images: ${missing.join(', ')}`);
console.log(`[share-images] wrote ${ids.length} image(s) to dist/share/`);
