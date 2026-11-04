import { byRecency, range, type Resume } from './resume';
import type { experienceTypes } from './schemas';

export type Kind = (typeof experienceTypes)[number] | 'Volunteering' | 'Education';

export type TimelineProject = {
  id: string; name: string; period: string; description: string; highlights: string[];
  tech: string[]; url: string; demo: string; image: string; color: string; private: boolean;
};

export type TimelineRole = {
  id: string; title: string; org: string; kind: Kind; current: boolean;
  /** Year shown on the rail. */
  year: number;
  /** "Feb 2025 – Present" and "1 yr 10 mos" (blank when the dates have no months). */
  dates: string; duration: string;
  summary: string; highlights: string[]; image: string; courses: string[];
  /** Ids of projects done in this role, and only those. */
  projects: string[];
  /** Skills this role and its own projects show, grouped like the skills list. */
  skills: { name: string; keywords: string[] }[];
};

export type Timeline = { roles: TimelineRole[]; projects: TimelineProject[] };

type Month = { y: number; m: number };
const month = (d: string): Month | null => {
  const hit = d.match(/^(\d{4})-(\d{2})$/);
  return hit ? { y: +hit[1], m: +hit[2] } : null;
};

/** Inclusive length, LinkedIn style: Feb 2025 – Nov 2026 is "1 yr 10 mos". Blank without months. */
export function duration(start: string, end: string, now: Date): string {
  const a = month(start);
  const b = end ? month(end) : { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1 };
  if (!a || !b) return '';
  const total = Math.max(1, (b.y - a.y) * 12 + b.m - a.m + 1);
  const y = Math.floor(total / 12), mo = total % 12;
  return [y && `${y} yr${y > 1 ? 's' : ''}`, mo && `${mo} mo${mo > 1 ? 's' : ''}`].filter(Boolean).join(' ');
}

/** "VOIS (Vodafone Intelligent Solutions)" → "VOIS": the short name fits the phone header. */
const shortName = (s: string) => s.replace(/\s*\(.*\)$/, '');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Skills a role shows: a skill counts when the role's own text or coursework names it,
 * or one of the role's projects names it or lists it as tech. Nothing comes from other roles.
 */
export function skillsFor(text: string[], projects: TimelineProject[], groups: Resume['skills']) {
  const corpus = [...text, ...projects.flatMap((p) => [p.description, ...p.highlights])].join(' ');
  const tech = new Set(projects.flatMap((p) => p.tech));
  return groups
    .map((g) => ({
      name: g.name,
      keywords: g.keywords.filter((k) => {
        const bare = k.replace(/\s*\(.*\)$/, ''); // "React Native (growing)" matches "React Native"
        return tech.has(bare) || new RegExp(`(^|[^\\w])${escape(bare)}($|[^\\w])`, 'i').test(corpus);
      }),
    }))
    .filter((g) => g.keywords.length > 0);
}

/** Jobs, volunteering and education as one list for the phone stack: current roles first, then newest. */
export function buildTimeline(r: Resume, now: Date): Timeline {
  const projects: TimelineProject[] = r.projects.map((p) => ({
    id: p.id, name: p.name, period: p.period, description: p.description, highlights: p.highlights,
    tech: p.keywords, url: p.url, demo: p.demo, image: p.image, color: p.color, private: p.private,
  }));
  const byId = new Map(projects.map((p) => [p.id, p]));
  const activityImage = (ids: { id: string }[]) =>
    ids.map((a) => r.activities.find((x) => x.id === a.id)?.image).find(Boolean) ?? '';

  type Draft = Omit<TimelineRole, 'year' | 'dates' | 'duration' | 'skills' | 'current'> & { startDate: string; endDate: string };
  const drafts: Draft[] = [
    ...r.work.map((w) => ({
      id: w.id, title: w.position, org: shortName(w.name), kind: w.type as Kind, startDate: w.startDate, endDate: w.endDate,
      summary: w.summary, highlights: w.highlights, image: activityImage(w.activities), courses: [],
      projects: w.projects.map((p) => p.id),
    })),
    ...r.volunteer.map((v) => ({
      id: v.id, title: v.position, org: shortName(v.organization), kind: 'Volunteering' as const, startDate: v.startDate, endDate: v.endDate,
      summary: v.summary, highlights: v.highlights, image: v.image || activityImage(v.activities), courses: [], projects: [],
    })),
    ...r.education.map((e, i) => ({
      id: `education-${i}`, title: e.studyType, org: shortName(e.institution), kind: 'Education' as const, startDate: e.startDate, endDate: e.endDate,
      summary: [e.area, e.score].filter(Boolean).join(' · '), highlights: [], image: '', courses: e.courses, projects: [],
    })),
  ];

  const roles = drafts.sort(byRecency).map(({ startDate, endDate, ...d }): TimelineRole => {
    const own = d.projects.map((id) => byId.get(id)).filter((p): p is TimelineProject => Boolean(p));
    return {
      ...d,
      highlights: d.highlights.slice(0, 3),
      current: endDate === '',
      year: +startDate.slice(0, 4),
      dates: range(startDate, endDate),
      duration: duration(startDate, endDate, now),
      skills: skillsFor([d.title, d.summary, ...d.highlights, ...d.courses], own, r.skills),
    };
  });
  return { roles, projects };
}
