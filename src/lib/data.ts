import type { ImageMetadata } from 'astro';
import resume from '../data/resume.json';

export { resume };
export type Resume = typeof resume;

const GH_USER = 'usamaeltmsah';
const DEVTO_USER = 'usamaeltmsah';
const YT_CHANNEL = 'UCKV_YQHNBqjjriKHUfe-2jg';

/* Images live in src/assets/images so Astro can optimize them. The CMS stores
   whatever path it likes; we resolve by file name. */
const images = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/images/*.{png,jpg,jpeg,webp,avif,gif}',
  { eager: true },
);
export function img(name?: string): ImageMetadata | undefined {
  if (!name) return undefined;
  const base = name.split('/').pop();
  return images[`/src/assets/images/${base}`]?.default;
}

export const profile = (network: string) =>
  resume.basics.profiles.find((p) => p.network.toLowerCase() === network.toLowerCase());

/** "2021-03" -> "Mar 2021", "2019" -> "2019", "" -> "" */
export function fmtDate(d?: string) {
  if (!d) return '';
  const [y, m] = d.split('-');
  if (!m || !/^(0[1-9]|1[0-2])$/.test(m)) return d.replace('-', '–');
  return new Date(+y, +m - 1).toLocaleString('en', { month: 'short' }) + ' ' + y;
}
export function range(start?: string, end?: string, current = 'Present') {
  const s = fmtDate(start);
  if (!s) return end ? fmtDate(end) : '';
  if (end === start) return s;
  return `${s} – ${end ? fmtDate(end) : current}`;
}

async function getJSON<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return (await res.json()) as T;
  } catch (e) {
    console.warn('[data] fetch failed:', (e as Error).message);
    return null;
  }
}

type Repo = {
  name: string; description: string | null; html_url: string; language: string | null;
  stargazers_count: number; forks_count: number; fork: boolean; pushed_at: string; archived: boolean;
};

export type GitHub = {
  repos: number; followers: number; stars: number;
  languages: { name: string; count: number; pct: number }[];
  recent: { name: string; description: string; url: string; language: string; pushed: string }[];
};

let ghCache: Promise<GitHub | null> | undefined;
export function github() {
  return (ghCache ??= (async () => {
    const h: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'portfolio-build' };
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (token) h.Authorization = `Bearer ${token}`;
    const [user, repos] = await Promise.all([
      getJSON<{ public_repos: number; followers: number }>(`https://api.github.com/users/${GH_USER}`, h),
      getJSON<Repo[]>(`https://api.github.com/users/${GH_USER}/repos?per_page=100&sort=pushed`, h),
    ]);
    if (!user || !repos) return null;
    const own = repos.filter((r) => !r.fork);
    const counts = new Map<string, number>();
    for (const r of own) if (r.language) counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
    const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
    const languages = [...counts.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }));
    return {
      repos: user.public_repos,
      followers: user.followers,
      stars: own.reduce((a, r) => a + r.stargazers_count, 0),
      languages,
      recent: own.filter((r) => !r.archived && r.name !== GH_USER && r.name !== `${GH_USER}.github.io`).slice(0, 6).map((r) => ({
        name: r.name, description: r.description ?? '', url: r.html_url,
        language: r.language ?? '', pushed: r.pushed_at.slice(0, 10),
      })),
    };
  })());
}

export type Post = { title: string; url: string; date: string; source: 'dev.to' | 'YouTube'; image?: string };

export async function posts(): Promise<Post[]> {
  const [articles, yt] = await Promise.all([
    getJSON<{ title: string; url: string; published_at: string; cover_image: string | null }[]>(
      `https://dev.to/api/articles?username=${DEVTO_USER}&per_page=6`,
    ),
    fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL}`, { signal: AbortSignal.timeout(10000) })
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => ''),
  ]);
  const out: Post[] = (articles ?? []).map((a) => ({
    title: a.title, url: a.url, date: a.published_at.slice(0, 10), source: 'dev.to' as const,
  }));
  for (const m of yt.matchAll(/<entry>[\s\S]*?<yt:videoId>(.*?)<\/yt:videoId>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<published>(.*?)<\/published>/g)) {
    out.push({
      title: m[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lpar;/g, '(').replace(/&rpar;/g, ')'),
      url: `https://www.youtube.com/watch?v=${m[1]}`, date: m[3].slice(0, 10), source: 'YouTube',
    });
  }
  if (!out.length) {
    for (const p of resume.publications) out.push({ title: p.name, url: p.url, date: p.releaseDate, source: 'dev.to' });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
}

export const SITE = resume.basics.url.replace(/\/$/, '');
