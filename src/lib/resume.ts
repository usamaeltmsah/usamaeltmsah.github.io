import type { Activity, Credential, Education, Experience, Profile, Project, Skills, Volunteering, Writing } from './schemas';

/** An entry plus its id: the file name without .json, which relations point to. */
export type Entry<T> = T & { id: string };

export type Content = {
  profile: Profile;
  skills: Skills;
  experience: Entry<Experience>[];
  volunteering: Entry<Volunteering>[];
  education: Education[];
  projects: Entry<Project>[];
  activities: Entry<Activity>[];
  credentials: Credential[];
  writing: Writing[];
};

/** Looks up related entries by id; a dangling link is an error, never a silent blank. */
function linker<T extends { id: string }>(items: T[], collection: string) {
  const byId = new Map(items.map((i) => [i.id, i]));
  return (id: string, from: string): T | undefined => {
    if (!id) return undefined;
    const hit = byId.get(id);
    if (!hit) {
      throw new Error(`${from} links to ${collection} "${id}", which doesn't exist. Pick another entry in the CMS, or restore the deleted one.`);
    }
    return hit;
  };
}

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
  const job = linker(c.experience, 'experience');
  const volunteering = linker(c.volunteering, 'volunteering');
  const projects = [...c.projects].sort(byOrder);
  const activities = [...c.activities].sort(byOrder);
  const projectsAt = (id: string) => projects.filter((x) => x.experience === id).map((x) => ({ id: x.id, name: x.name }));
  const activitiesAt = (field: 'experience' | 'volunteering', id: string) =>
    activities.filter((a) => a[field] === id).map((a) => ({ id: a.id, name: a.name }));
  /** "at Nugttah" for employers, "via Upwork" for freelance platforms. */
  const atJob = (j?: Entry<Experience>) => (j ? `${j.type === 'Freelance' ? 'via' : 'at'} ${j.company}` : '');

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
    work: jobs.map((j) => ({
      id: j.id, name: j.company, position: j.position, type: j.type, url: j.url, location: j.location,
      startDate: j.startDate, endDate: j.endDate, summary: j.summary, highlights: j.highlights,
      projects: projectsAt(j.id), activities: activitiesAt('experience', j.id),
    })),
    volunteer: [...c.volunteering].sort(byRecency).map((v) => ({
      id: v.id, organization: v.organization, position: v.role, url: v.url, location: v.location,
      startDate: v.startDate, endDate: v.endDate, summary: v.summary, highlights: v.highlights,
      image: v.image, activities: activitiesAt('volunteering', v.id),
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
    projects: projects.map((x) => {
      const j = job(x.experience, `Project "${x.name}"`);
      return {
      id: x.id, name: x.name, entity: j?.company ?? '', at: atJob(j),
      featured: x.featured, private: x.private, onCv: x.onCv, period: x.period,
      description: x.description, highlights: x.highlights, keywords: x.tech,
      url: x.private ? '' : x.url, demo: x.private ? '' : x.demo, image: x.image, color: x.color || '#64748b',
      };
    }),
    activities: activities.map(({ order: _order, experience, volunteering: vol, ...a }) => {
      const j = job(experience, `Activity "${a.name}"`);
      const v = volunteering(vol, `Activity "${a.name}"`);
      return { ...a, at: j ? atJob(j) : v ? `with ${v.organization}` : '' };
    }),
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
    work: r.work.map(({ id: _id, projects: _p, activities: _a, ...w }) => w),
    volunteer: r.volunteer.map(({ id: _id, image: _i, activities: _a, ...v }) => v),
    activities: r.activities.map(({ id: _id, at: _at, ...a }) => a),
    projects: r.projects.map(({ id: _id, at: _at, featured: _f, color: _c, onCv: _cv, private: isPrivate, period, ...x }) => {
      const [startDate = '', endDate = ''] = period.match(/^\d{4}-\d{4}$/) ? period.split('-') : [period];
      return { ...x, startDate, endDate, type: isPrivate ? 'client work' : 'personal' };
    }),
  };
}
