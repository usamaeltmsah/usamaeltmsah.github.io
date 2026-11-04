import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

/** Swaps every `placeholder` in `html` for `url`; returns null when the page doesn't use it. */
export function injectEntry(html: string, placeholder: string, url: string): string | null {
  return html.includes(placeholder) ? html.split(placeholder).join(url) : null;
}

/**
 * Builds `entry` as its own hashed client chunk that no page loads by itself, then writes
 * its URL wherever a page prints `placeholder`. Astro only inlines scripts without dynamic
 * imports, so this is how an inline loader can fetch a lazy bundle without a script
 * request at page load. In dev, pages should point at the source file instead.
 */
export function lazyEntry({ entry, placeholder }: { entry: string; placeholder: string }): AstroIntegration {
  let fileName = '';
  return {
    name: 'lazy-entry',
    hooks: {
      'astro:config:setup': ({ updateConfig, config }) => {
        const id = fileURLToPath(new URL(entry, config.root));
        let ref = '';
        updateConfig({
          vite: {
            plugins: [{
              name: 'lazy-entry',
              apply: 'build',
              applyToEnvironment: (env) => env.name === 'client',
              buildStart() { ref = this.emitFile({ type: 'chunk', id, name: 'lazy-entry' }); },
              generateBundle() { fileName = this.getFileName(ref); },
            }],
          },
        });
      },
      'astro:build:done': async ({ dir, logger }) => {
        if (!fileName) throw new Error(`lazy-entry: ${entry} was not built, so ${placeholder} can't be filled in`);
        const root = fileURLToPath(dir);
        const pages = (await readdir(root, { recursive: true })).filter((f) => f.endsWith('.html'));
        let used = 0;
        for (const page of pages) {
          const path = join(root, page);
          const html = injectEntry(await readFile(path, 'utf8'), placeholder, `/${fileName}`);
          if (html !== null) { await writeFile(path, html); used++; }
        }
        if (!used) throw new Error(`lazy-entry: no page prints ${placeholder}; remove the integration or the placeholder`);
        logger.info(`/${fileName} wired into ${used} page(s)`);
      },
    },
  };
}
