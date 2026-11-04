import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://usamaeltmsah.github.io',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'always', format: 'directory' },
  integrations: [sitemap({ filter: (page) => !page.includes('/admin') })],
  image: { responsiveStyles: false },
});
