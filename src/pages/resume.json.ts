import type { APIRoute } from 'astro';
import { getResume } from '../lib/data';
import { toJsonResume } from '../lib/resume';

/** JSON Resume (https://jsonresume.org/schema), assembled from the CMS collections. */
export const GET: APIRoute = async () =>
  new Response(JSON.stringify(toJsonResume(await getResume()), null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
