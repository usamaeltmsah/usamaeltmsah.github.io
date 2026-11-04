import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { lazyEntry } from './scripts/lazy-entry.ts';

export default defineConfig({
  site: 'https://usamaeltmsah.github.io',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'always', format: 'directory' },
  integrations: [
    sitemap({ filter: (page) => !page.includes('/admin') }),
    // The Experience phone stack (with Three.js) loads only near its section, via an inline loader
    lazyEntry({ entry: 'src/scripts/phone-stack/entry.ts', placeholder: '/__PHONE_STACK_ENTRY__' }),
  ],
  image: { responsiveStyles: false },
  // Three.js (~530 kB, 135 kB gzipped) is one lazy chunk loaded only near the Experience section
  vite: { build: { chunkSizeWarningLimit: 600 } },
});
