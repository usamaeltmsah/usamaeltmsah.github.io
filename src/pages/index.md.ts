import type { APIRoute } from 'astro';
import { resumeMarkdown } from '../lib/markdown';

export const GET: APIRoute = () =>
  new Response(resumeMarkdown(), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
