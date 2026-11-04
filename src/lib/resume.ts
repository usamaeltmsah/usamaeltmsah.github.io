import type { Activity, Credential, Education, Experience, Profile, Project, Skills, Writing } from './schemas';

export type Content = {
  profile: Profile;
  skills: Skills;
  experience: Experience[];
  education: Education[];
  projects: Project[];
  activities: Activity[];
  credentials: Credential[];
  writing: Writing[];
};

const MONTH = /^(0[1-9]|1[0-2])$/;

/** "2021-03" → "Mar 2021", "2019" → "2019", "2018-2019" → "2018–2019", "" → "" */
export function fmtDate(d?: string): string {
  if (!d) return '';
  const [y, m] = d.split('-');
  if (!m || !MONTH.test(m)) return d.replace('-', '–');
  return new Date(Date.UTC(+y, +m - 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' }) + ' ' + y;
}

/** Formats a start/end pair; a missing end means the role is current. */
export function range(start?: string, end?: string, current = 'Present'): string {
  const s = fmtDate(start);
  if (!s) return end ? fmtDate(end) : '';
  if (end === start) return s;
  return `${s} – ${end ? fmtDate(end) : current}`;
}

/** Current roles first, then most recent start date first. */
export function byRecency<T extends { startDate: string; endDate: string }>(a: T, b: T): number {
  const aCurrent = a.startDate !== '' && a.endDate === '';
  const bCurrent = b.startDate !== '' && b.endDate === '';
  if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
  return b.startDate.localeCompare(a.startDate);
}

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;
const byDateDesc = <T extends { date: string }>(a: T, b: T) => b.date.localeCompare(a.date);

/**
 * Assembles the CMS entries into one object shaped like JSON Resume
 * (https://jsonresume.org/schema) plus the extra fields the site uses.
 */
export function buildResume(c: Content, lastModified: string) {
  const p = c.profile;
  const jobs = [...c.experience].sort(byRecency);
  const credentials = [...c.credentials].sort(byDateDesc);

  return {
    basics: {
      name: p.name,
      label: p.label,
      headline: p.headline,
      image: p.image,
      email: p.email,
      url: p.url,
      summary: p.summary,
      availability: p.availability,
      location: p.location,
      profiles: p.profiles,
    },
    stats: p.stats,
    work: jobs.filter((j) => j.type !== 'Volunteer').map((j) => ({
      name: j.company, position: j.position, type: j.type, url: j.url, location: j.location,
      startDate: j.startDate, endDate: j.endDate, summary: j.summary, highlights: j.highlights,
    })),
    volunteer: jobs.filter((j) => j.type === 'Volunteer').map((j) => ({
      organization: j.company, position: j.position, url: j.url, location: j.location,
      startDate: j.startDate, endDate: j.endDate, summary: j.summary, highlights: j.highlights,
    })),
    education: [...c.education].sort(byRecency).map((e) => ({
      institution: e.institution, url: e.url, area: e.area, studyType: e.degree,
      startDate: e.startDate, endDate: e.endDate, score: e.score, courses: e.courses,
    })),
    awards: credentials.filter((x) => x.kind === 'Award').map((a) => ({
      title: a.name, date: a.date, awarder: a.issuer, summary: a.summary, url: a.url,
    })),
    certificates: credentials.filter((x) => x.kind === 'Certificate').map((x) => ({
      name: x.name, date: x.date, issuer: x.issuer, url: x.url,
    })),
    publications: [...c.writing].sort(byDateDesc).map((w) => ({
      name: w.title, publisher: w.publisher, releaseDate: w.date, url: w.url, summary: w.summary,
    })),
    skills: c.skills.technical.map((s) => ({ name: s.name, level: '', keywords: s.keywords })),
    softSkills: c.skills.soft,
    languages: c.skills.languages,
    interests: c.skills.interests,
    references: [] as { name: string; reference: string }[],
    projects: [...c.projects].sort(byOrder).map((x) => ({
      name: x.name, featured: x.featured, description: x.description, highlights: x.highlights,
      keywords: x.tech, url: x.url, demo: x.demo, image: x.image, color: x.color || '#64748b',
    })),
    activities: [...c.activities].sort(byOrder).map(({ order: _order, ...a }) => a),
    meta: { canonical: new URL('resume.json', p.url).href, version: 'v1.0.0', lastModified },
  };
}

export type Resume = ReturnType<typeof buildResume>;

/**
 * The public JSON Resume document. Keeps the extra sections (softSkills, activities,
 * work[].type), which the schema allows, and drops presentation-only fields.
 */
export function toJsonResume(r: Resume) {
  const { stats: _stats, ...rest } = r;
  return {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    ...rest,
    basics: { ...rest.basics, image: new URL('og.png', r.basics.url).href },
    projects: r.projects.map(({ featured: _f, color: _c, ...x }) => x),
  };
}
