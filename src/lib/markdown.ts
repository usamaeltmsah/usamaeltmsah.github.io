import { range, type Resume } from './resume';

const link = (t: string, u: string) => (u ? `[${t}](${u})` : t);

/** The whole resume as clean markdown, for agents and the llms-full.txt file. */
export function resumeMarkdown(resume: Resume) {
  const b = resume.basics;
  const SITE = b.url.replace(/\/$/, '');
  const out: string[] = [];
  out.push(`# ${b.name}: ${b.label}`, '', `${b.location.city}, Egypt · ${b.availability} · ${b.email}`, '', b.summary, '');
  out.push('## Highlights', ...resume.stats.map((s) => `- ${s.value} ${s.label}`), '');
  out.push('## Experience');
  for (const w of resume.work) {
    out.push(`- **${w.position}, ${w.name}**${range(w.startDate, w.endDate) ? ` (${range(w.startDate, w.endDate)})` : ''}: ${w.summary}`);
    for (const h of w.highlights) out.push(`  - ${h}`);
  }
  
  out.push('', '## Volunteering', ...resume.volunteer.map((v) => `- **${v.position}, ${v.organization}** (${range(v.startDate, v.endDate)}): ${v.summary}`));
  out.push('', '## Education', ...resume.education.map((e) => `- ${e.studyType}, ${e.institution} (${range(e.startDate, e.endDate)})`), '');
  out.push('## Projects', ...resume.projects.map((p) => `- **${link(p.name, p.url)}**${p.at ? ` ${p.at}` : ''}${p.private ? ' (private client work)' : ''} (${p.keywords.join(', ')}): ${p.description}`), '');
  out.push('## Activities', ...resume.activities.map((a) => `- **${link(a.name, a.url)}** (${a.role}${a.date ? `, ${a.date}` : ''}): ${a.description}`), '');
  if (resume.awards.length || resume.certificates.length) {
    out.push('## Awards & certificates', ...resume.awards.map((a) => `- ${a.title}, ${a.awarder}: ${a.summary}`), ...resume.certificates.map((c) => `- ${link(c.name, c.url)}, ${c.issuer}`), '');
  }
  out.push('## Skills', ...resume.skills.map((s) => `- ${s.name}: ${s.keywords.join(', ')}`), '');
  out.push('## Soft skills', ...resume.softSkills.map((s) => `- **${s.name}**: ${s.description}`), '');
  out.push('## Languages', resume.languages.map((l) => `${l.language} (${l.fluency})`).join(', '), '');
  out.push('## Links', ...b.profiles.map((p) => `- ${p.network}: ${p.url}`), '');
  out.push('## Downloads', `- CV (PDF): ${SITE}/cv.pdf`, `- Resume (JSON Resume): ${SITE}/resume.json`, `- Printable CV: ${SITE}/cv/`, '');
  return out.join('\n');
}
