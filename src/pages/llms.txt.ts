import type { APIRoute } from 'astro';
import { resume, SITE } from '../lib/data';

export const GET: APIRoute = () => {
  const b = resume.basics;
  const body = `# ${b.name}

> ${b.label} in ${b.location.city}, Egypt. ${b.summary} ${b.availability}.

Key facts: ${resume.stats.map((s) => `${s.value} ${s.label}`).join('; ')}.

## Site
- [Portfolio](${SITE}/): the full portfolio page
- [Portfolio as Markdown](${SITE}/index.md): the same content as clean markdown
- [Full context](${SITE}/llms-full.txt): experience, projects, activities and skills in detail
- [Printable CV](${SITE}/cv/): HTML curriculum vitae
- [CV PDF](${SITE}/cv.pdf): downloadable PDF
- [resume.json](${SITE}/resume.json): machine-readable resume in the JSON Resume schema

## Profiles
${b.profiles.map((p) => `- [${p.network}](${p.url})`).join('\n')}

## Contact
- Email: ${b.email}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
