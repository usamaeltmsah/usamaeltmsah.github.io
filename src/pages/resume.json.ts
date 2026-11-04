import type { APIRoute } from 'astro';
import { resume, SITE } from '../lib/data';

/** JSON Resume (https://jsonresume.org/schema), with absolute image URLs. */
export const GET: APIRoute = () => {
  const { stats, ...rest } = resume;
  const data = {
    ...rest,
    basics: { ...resume.basics, image: `${SITE}/og.png` },
    projects: resume.projects.map(({ color, featured, ...p }) => p),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
