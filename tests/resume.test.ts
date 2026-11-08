import { describe, expect, it } from 'vitest';
import { buildResume, byRecency, fmtDate, range, toJsonResume, type Content } from '../src/lib/resume';

describe('fmtDate', () => {
  it.each([
    ['2021-03', 'Mar 2021'],
    ['2019', '2019'],
    ['2018-2019', '2018–2019'],
    ['', ''],
    [undefined, ''],
  ])('%s → %s', (input, out) => expect(fmtDate(input)).toBe(out));
});

describe('range', () => {
  it('marks a missing end as current', () => expect(range('2025-02', '')).toBe('Feb 2025 – Present'));
  it('collapses identical start and end', () => expect(range('2019-07', '2019-07')).toBe('Jul 2019'));
  it('formats a closed range', () => expect(range('2023-01', '2024-12')).toBe('Jan 2023 – Dec 2024'));
  it('handles a missing start', () => expect(range('', '2020')).toBe('2020'));
});

describe('byRecency', () => {
  it('puts current roles first, then newest start', () => {
    const items = [
      { startDate: '2020-01', endDate: '2020-04' },
      { startDate: '2022-06', endDate: '' },
      { startDate: '2023-01', endDate: '2024-12' },
      { startDate: '2025-02', endDate: '' },
    ];
    expect([...items].sort(byRecency).map((i) => i.startDate)).toEqual(['2025-02', '2022-06', '2023-01', '2020-01']);
  });
});

const job = (id: string, company: string, type: 'Full-time' | 'Freelance', startDate: string, endDate: string) =>
  ({ id, company, position: 'Dev', type, url: '', location: '', startDate, endDate, summary: 's', highlights: [] });
const project = (id: string, order: number, over: Partial<Content['projects'][number]> = {}): Content['projects'][number] => ({
  id, name: id.toUpperCase(), order, featured: false, private: false, onCv: false, period: '', experience: '',
  description: 'd', highlights: [], tech: [], url: '', demo: '', image: '', color: '',
  problem: '', approach: '', challenge: '', outcome: '', gallery: [], ...over,
});

const content: Content = {
  profile: {
    name: 'Ada', label: 'iOS Developer', headline: 'Hi', image: '', email: 'a@b.co', phone: '', url: 'https://example.com/',
    availability: '', summary: 'Summary', location: { city: 'Cairo', countryCode: 'EG', region: '' },
    stats: [{ value: '1', label: 'stat' }], profiles: [],
  },
  skills: { technical: [{ name: 'UI', keywords: ['SwiftUI'] }], soft: [{ name: 'Ownership', description: 'x' }], languages: [], interests: [] },
  experience: [job('old', 'Old Co', 'Full-time', '2019-01', '2020-01'), job('market', 'Upwork', 'Freelance', '2022-01', '')],
  volunteering: [{ id: 'club', organization: 'Club', role: 'Member', url: '', location: '', startDate: '2016-01', endDate: '2018-01', summary: 's', highlights: [], image: 'club.jpg' }],
  education: [],
  projects: [
    project('b', 2, { private: true, onCv: true, period: '2022-2025', experience: 'market', url: 'https://leak.example', tech: ['Swift'] }),
    project('a', 1, { featured: true, period: '2024', experience: 'old', url: 'https://a.example', image: 'a.png', color: '#123456' }),
  ],
  activities: [
    { id: 'hack', name: 'Hack', order: 1, role: 'Participant', date: '2025-07', description: 'd', url: '', image: '', experience: 'old', volunteering: '' },
    { id: 'talk', name: 'Talk', order: 2, role: 'Speaker', date: '', description: 'd', url: '', image: '', experience: '', volunteering: 'club' },
  ],
  testimonials: [
    { id: 'great', quote: 'Great work.', order: 1, source: 'Upwork', author: 'Upwork client', context: 'SwiftUI app', date: '2025-08', rating: 5, url: '', project: 'b', experience: 'market', onCv: true },
    { id: 'kind', quote: 'Kind words.', order: 2, source: 'LinkedIn', author: 'Former manager', context: '', date: '', rating: 0, url: '', project: '', experience: '', onCv: false },
  ],
  credentials: [
    { kind: 'Certificate', name: 'Old cert', issuer: 'X', date: '2020-01', url: '', summary: '' },
    { kind: 'Award', name: 'Top', issuer: 'Upwork', date: '', url: '', summary: 'great' },
    { kind: 'Certificate', name: 'New cert', issuer: 'Y', date: '2022-01', url: '', summary: '' },
  ],
  writing: [],
};

describe('buildResume', () => {
  const r = buildResume(content, '2026-01-01');

  it('sorts work by recency and keeps volunteering separate', () => {
    expect(r.work.map((w) => w.name)).toEqual(['Upwork', 'Old Co']);
    expect(r.volunteer).toMatchObject([{ id: 'club', organization: 'Club', position: 'Member', image: 'club.jpg' }]);
  });
  it('splits credentials into awards and newest-first certificates', () => {
    expect(r.awards.map((a) => a.title)).toEqual(['Top']);
    expect(r.certificates.map((c) => c.name)).toEqual(['New cert', 'Old cert']);
  });
  it('orders projects by the CMS order and defaults the color', () => {
    expect(r.projects.map((p) => p.id)).toEqual(['a', 'b']);
    expect(r.projects[1].color).toBe('#64748b');
  });
  it('never exposes links for private projects', () => {
    expect(r.projects[1]).toMatchObject({ private: true, url: '', demo: '' });
    expect(r.projects[0].url).toBe('https://a.example');
  });
  it('derives the canonical URL from the profile URL', () => {
    expect(r.meta).toEqual({ canonical: 'https://example.com/resume.json', version: 'v1.0.0', lastModified: '2026-01-01' });
  });
});

describe('relations', () => {
  const r = buildResume(content, '2026-01-01');

  it('labels projects and activities with the linked role', () => {
    expect(r.projects.map((p) => [p.entity, p.at])).toEqual([['Old Co', 'at Old Co'], ['Upwork', 'via Upwork']]);
    expect(r.activities.map((a) => a.at)).toEqual(['at Old Co', 'with Club']);
  });
  it('lists linked projects and activities on each role', () => {
    const old = r.work.find((w) => w.id === 'old')!;
    expect(old.projects).toEqual([{ id: 'a', name: 'A' }]);
    expect(old.activities).toEqual([{ id: 'hack', name: 'Hack' }]);
    expect(r.volunteer[0].activities).toEqual([{ id: 'talk', name: 'Talk' }]);
  });
  it('follows a role when it is edited, because links are by id', () => {
    const renamed = buildResume({ ...content, experience: [job('old', 'Renamed Co', 'Full-time', '2019-01', '2020-01'), content.experience[1]] }, 'x');
    expect(renamed.projects[0].at).toBe('at Renamed Co');
  });
  it('attaches reviews to projects and resolves testimonial links', () => {
    expect(r.projects.find((p) => p.id === 'b')!.reviews).toEqual([{ id: 'great', rating: 5 }]);
    expect(r.testimonials[0]).toMatchObject({ projectName: 'B', at: 'via Upwork' });
    expect(r.testimonials[1]).toMatchObject({ projectName: '', at: '' });
  });
  it('fails loudly when a testimonial links to a deleted project', () => {
    const broken = { ...content, testimonials: [{ ...content.testimonials[0], project: 'gone' }] };
    expect(() => buildResume(broken, 'x')).toThrow(/links to projects "gone"/);
  });
  it('fails loudly on a link to a missing entry', () => {
    const broken = { ...content, projects: [project('x', 1, { experience: 'deleted-role' })] };
    expect(() => buildResume(broken, 'x')).toThrow('Project "X" links to experience "deleted-role", which doesn\'t exist');
  });
});

describe('toJsonResume', () => {
  const json = toJsonResume(buildResume(content, '2026-01-01'));

  it('drops presentation-only fields', () => {
    expect(json).not.toHaveProperty('stats');
    expect(json.projects[0]).not.toHaveProperty('featured');
    expect(json.projects[0]).not.toHaveProperty('color');
    expect(json.projects[0]).not.toHaveProperty('onCv');
    expect(json.projects[0]).not.toHaveProperty('caseStudy');
    expect(json.work[0]).not.toHaveProperty('id');
    expect(json.volunteer[0]).not.toHaveProperty('image');
  });
  it('maps project periods to JSON Resume dates, entity and type', () => {
    expect(json.projects[0]).toMatchObject({ startDate: '2024', endDate: '', type: 'personal', entity: 'Old Co' });
    expect(json.projects[1]).toMatchObject({ startDate: '2022', endDate: '2025', type: 'client work', entity: 'Upwork' });
  });
  it('publishes testimonials as JSON Resume references', () => {
    expect(json).not.toHaveProperty('testimonials');
    expect(json.references).toEqual([
      { name: 'Upwork client, SwiftUI app, 2025', reference: 'Great work.' },
      { name: 'Former manager', reference: 'Kind words.' },
    ]);
  });
  it('keeps the extra sections and uses an absolute image URL', () => {
    expect(json.softSkills).toHaveLength(1);
    expect(json.activities).toHaveLength(2);
    expect(json.basics.image).toBe('https://example.com/og.png');
  });
});
