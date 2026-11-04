import type { APIRoute } from 'astro';
import { resume } from '../lib/data';

export const GET: APIRoute = () =>
  new Response(JSON.stringify({
    name: `${resume.basics.name} | ${resume.basics.label}`, short_name: resume.basics.name,
    start_url: '/', display: 'standalone', background_color: '#0a0b0f', theme_color: '#0a0b0f',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
  }), { headers: { 'Content-Type': 'application/manifest+json' } });
