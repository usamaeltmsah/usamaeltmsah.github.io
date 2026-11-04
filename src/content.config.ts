import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { folders } from './lib/schemas';

const json = (dir: keyof typeof folders) => glob({ pattern: '*.json', base: `./src/content/${dir}` });

export const collections = {
  experience: defineCollection({ loader: json('experience'), schema: folders.experience }),
  volunteering: defineCollection({ loader: json('volunteering'), schema: folders.volunteering }),
  education: defineCollection({ loader: json('education'), schema: folders.education }),
  projects: defineCollection({ loader: json('projects'), schema: folders.projects }),
  activities: defineCollection({ loader: json('activities'), schema: folders.activities }),
  credentials: defineCollection({ loader: json('credentials'), schema: folders.credentials }),
  writing: defineCollection({ loader: json('writing'), schema: folders.writing }),
};
