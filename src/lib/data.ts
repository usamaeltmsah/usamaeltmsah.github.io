import type { ImageMetadata } from 'astro';
import { getCollection } from 'astro:content';
import profileJson from '../content/profile.json';
import skillsJson from '../content/skills.json';
import { buildResume, type Resume } from './resume';
import { profileSchema, skillsSchema } from './schemas';
import { mergePosts, parseYouTubeFeed, summarizeGitHub, type GitHub, type Post, type Repo } from './feeds';

export { fmtDate, range } from './resume';
export type { Resume } from './resume';
export type { GitHub, Post } from './feeds';

const GH_USER = 'usamaeltmsah';
const DEVTO_USER = 'usamaeltmsah';
const YT_CHANNEL = 'UCKV_YQHNBqjjriKHUfe-2jg';
const TIMEOUT = 10_000;

const profileData = profileSchema.parse(profileJson);
export const SITE = profileData.url.replace(/\/$/, '');

let resumeCache: Promise<Resume> | undefined;
/** All CMS content assembled into one JSON Resume–shaped object. Cached per build. */
export function getResume(): Promise<Resume> {
  return (resumeCache ??= (async () => {
    const [experience, volunteering, education, projects, activities, testimonials, credentials, writing] = await Promise.all([
      getCollection('experience'), getCollection('volunteering'), getCollection('education'), getCollection('projects'),
      getCollection('activities'), getCollection('testimonials'), getCollection('credentials'), getCollection('writing'),
    ]);
    const data = <T>(entries: { data: T }[]) => entries.map((e) => e.data);
    const withId = <T>(entries: { id: string; data: T }[]) => entries.map((e) => ({ ...e.data, id: e.id }));
    return buildResume(
      {
        profile: profileData,
        skills: skillsSchema.parse(skillsJson),
        experience: withId(experience), volunteering: withId(volunteering), education: data(education),
        projects: withId(projects), activities: withId(activities), testimonials: withId(testimonials), credentials: data(credentials), writing: data(writing),
      },
      new Date().toISOString().slice(0, 10),
    );
  })());
}

/* Images live in src/assets/images so Astro can optimize them. The CMS stores
   whatever path it likes; we resolve by file name. */
const images = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/images/*.{png,jpg,jpeg,webp,avif,gif}',
  { eager: true },
);
export function img(name?: string): ImageMetadata | undefined {
  if (!name) return undefined;
  const base = name.split('/').pop();
  const found = images[`/src/assets/images/${base}`]?.default;
  if (!found) console.warn(`[data] image not found in src/assets/images: ${name}`);
  return found;
}

export const profileLink = (resume: Resume, network: string) =>
  resume.basics.profiles.find((p) => p.network.toLowerCase() === network.toLowerCase());

/** Fetches a URL; on failure logs a warning and returns null so the build can fall back. */
async function fetchOr<T>(url: string, parse: (r: Response) => Promise<T>, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await parse(res);
  } catch (e) {
    console.warn(`[data] ${url} failed: ${(e as Error).message}. Using fallback.`);
    return null;
  }
}

let ghCache: Promise<GitHub | null> | undefined;
export function github(): Promise<GitHub | null> {
  return (ghCache ??= (async () => {
    const h: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'portfolio-build' };
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (token) h.Authorization = `Bearer ${token}`;
    const json = (r: Response) => r.json();
    const [user, repos] = await Promise.all([
      fetchOr<{ public_repos: number; followers: number }>(`https://api.github.com/users/${GH_USER}`, json, h),
      fetchOr<Repo[]>(`https://api.github.com/users/${GH_USER}/repos?per_page=100&sort=pushed`, json, h),
    ]);
    if (!user || !repos) return null;
    return summarizeGitHub(user, repos, [GH_USER, `${GH_USER}.github.io`]);
  })());
}

export async function posts(): Promise<Post[]> {
  const [articles, feed, resume] = await Promise.all([
    fetchOr<{ title: string; url: string; published_at: string }[]>(
      `https://dev.to/api/articles?username=${DEVTO_USER}&per_page=6`, (r) => r.json(),
    ),
    fetchOr(`https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL}`, (r) => r.text()),
    getResume(),
  ]);
  const devto: Post[] = articles
    ? articles.map((a) => ({ title: a.title, url: a.url, date: a.published_at.slice(0, 10), source: 'dev.to' }))
    : resume.publications.map((p) => ({ title: p.name, url: p.url, date: p.releaseDate, source: 'dev.to' }));
  return mergePosts([devto, feed ? parseYouTubeFeed(feed) : []]);
}
