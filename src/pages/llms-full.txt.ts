import type { APIRoute } from 'astro';
import { resumeMarkdown } from '../lib/markdown';

export const GET: APIRoute = () =>
  new Response(resumeMarkdown(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
