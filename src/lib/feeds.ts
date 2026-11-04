/** Pure parsers for the build-time feeds, kept separate from fetching so they can be tested. */

export type Repo = {
  name: string; description: string | null; html_url: string; language: string | null;
  stargazers_count: number; fork: boolean; pushed_at: string; archived: boolean;
};

export type GitHub = {
  repos: number; followers: number; stars: number;
  languages: { name: string; count: number; pct: number }[];
  recent: { name: string; description: string; url: string; language: string; pushed: string }[];
};

export type Post = { title: string; url: string; date: string; source: 'dev.to' | 'YouTube' };

/** Summarizes a user's repos: totals, top languages by repo count, and recently pushed repos. */
export function summarizeGitHub(
  user: { public_repos: number; followers: number },
  repos: Repo[],
  hide: string[] = [],
): GitHub {
  const own = repos.filter((r) => !r.fork);
  const counts = new Map<string, number>();
  for (const r of own) if (r.language) counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  return {
    repos: user.public_repos,
    followers: user.followers,
    stars: own.reduce((a, r) => a + r.stargazers_count, 0),
    languages: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) })),
    recent: own
      .filter((r) => !r.archived && !hide.includes(r.name))
      .sort((a, b) => b.pushed_at.localeCompare(a.pushed_at))
      .slice(0, 6)
      .map((r) => ({
        name: r.name, description: r.description ?? '', url: r.html_url,
        language: r.language ?? '', pushed: r.pushed_at.slice(0, 10),
      })),
  };
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&lpar;': '(', '&rpar;': ')' };
const decode = (s: string) => s.replace(/&(amp|quot|#39|apos|lt|gt|lpar|rpar);/g, (m) => ENTITIES[m] ?? m);

/** Extracts videos from a YouTube channel Atom feed. */
export function parseYouTubeFeed(xml: string): Post[] {
  const out: Post[] = [];
  for (const entry of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const body = entry[1];
    const id = body.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
    const title = body.match(/<title>(.*?)<\/title>/)?.[1];
    const published = body.match(/<published>(.*?)<\/published>/)?.[1];
    if (!id || !title) continue;
    out.push({ title: decode(title), url: `https://www.youtube.com/watch?v=${id}`, date: published?.slice(0, 10) ?? '', source: 'YouTube' });
  }
  return out;
}

/** Newest first, at most `limit` items. */
export function mergePosts(lists: Post[][], limit = 6): Post[] {
  return lists.flat().sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
