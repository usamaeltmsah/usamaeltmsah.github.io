import type { APIRoute } from 'astro';
import { getResume } from '../lib/data';
import { resumeMarkdown } from '../lib/markdown';

export const GET: APIRoute = async () =>
  new Response(resumeMarkdown(await getResume()), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
