import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://usamaeltmsah.github.io',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'always', format: 'directory' },
  integrations: [sitemap({ filter: (page) => !page.includes('/admin') })],
  image: { responsiveStyles: false },
  // Three.js (~530 kB, 135 kB gzipped) is one lazy chunk loaded only near the Experience section
  vite: { build: { chunkSizeWarningLimit: 600 } },
});
