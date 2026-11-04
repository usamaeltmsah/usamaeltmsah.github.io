import { describe, expect, it } from 'vitest';
import { mergePosts, parseYouTubeFeed, summarizeGitHub, type Repo } from '../src/lib/feeds';

const repo = (name: string, over: Partial<Repo> = {}): Repo => ({
  name, description: null, html_url: `https://github.com/u/${name}`, language: 'Swift',
  stargazers_count: 0, fork: false, pushed_at: '2025-01-01T00:00:00Z', archived: false, ...over,
});

describe('summarizeGitHub', () => {
  const repos = [
    repo('a', { stargazers_count: 2, pushed_at: '2025-03-01T00:00:00Z' }),
    repo('b', { language: 'Ruby', stargazers_count: 1 }),
    repo('forked', { fork: true, stargazers_count: 50 }),
    repo('old', { archived: true, language: null }),
    repo('u.github.io', { pushed_at: '2026-01-01T00:00:00Z' }),
  ];
  const gh = summarizeGitHub({ public_repos: 5, followers: 3 }, repos, ['u.github.io']);

  it('ignores forks for stars and languages', () => {
    expect(gh.stars).toBe(3);
    expect(gh.languages).toEqual([
      { name: 'Swift', count: 2, pct: 67 },
      { name: 'Ruby', count: 1, pct: 33 },
    ]);
  });
  it('lists recent repos without archived or hidden ones, newest first', () => {
    expect(gh.recent.map((r) => r.name)).toEqual(['a', 'b']);
    expect(gh.recent[0]).toMatchObject({ description: '', pushed: '2025-03-01' });
  });
});

describe('parseYouTubeFeed', () => {
  const xml = `<feed><title>Channel</title>
    <entry><yt:videoId>abc</yt:videoId><title>Tic &amp; Tac &lpar;AI&rpar;</title><published>2020-04-29T10:00:00+00:00</published></entry>
    <entry><yt:videoId>def</yt:videoId><title>Second</title><published>2021-01-01T00:00:00+00:00</published></entry>
    <entry><title>No id</title></entry></feed>`;

  it('extracts videos and decodes entities', () => {
    expect(parseYouTubeFeed(xml)).toEqual([
      { title: 'Tic & Tac (AI)', url: 'https://www.youtube.com/watch?v=abc', date: '2020-04-29', source: 'YouTube' },
      { title: 'Second', url: 'https://www.youtube.com/watch?v=def', date: '2021-01-01', source: 'YouTube' },
    ]);
  });
  it('returns nothing for an empty feed', () => expect(parseYouTubeFeed('')).toEqual([]));
});

describe('mergePosts', () => {
  it('sorts newest first and limits the count', () => {
    const p = (date: string) => ({ title: date, url: '', date, source: 'dev.to' as const });
    expect(mergePosts([[p('2020-01-01'), p('2023-01-01')], [p('2021-01-01')]], 2).map((x) => x.date)).toEqual(['2023-01-01', '2021-01-01']);
  });
});
