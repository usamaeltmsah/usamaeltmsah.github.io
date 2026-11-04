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

const content: Content = {
  profile: {
    name: 'Ada', label: 'iOS Developer', headline: 'Hi', image: '', email: 'a@b.co', url: 'https://example.com/',
    availability: '', summary: 'Summary', location: { city: 'Cairo', countryCode: 'EG', region: '' },
    stats: [{ value: '1', label: 'stat' }], profiles: [],
  },
  skills: { technical: [{ name: 'UI', keywords: ['SwiftUI'] }], soft: [{ name: 'Ownership', description: 'x' }], languages: [], interests: [] },
  experience: [
    { company: 'Old', position: 'Dev', type: 'Full-time', url: '', location: '', startDate: '2019-01', endDate: '2020-01', summary: 's', highlights: [] },
    { company: 'Club', position: 'Member', type: 'Volunteer', url: '', location: '', startDate: '2016-01', endDate: '2018-01', summary: 's', highlights: [] },
    { company: 'Now', position: 'Dev', type: 'Freelance', url: '', location: '', startDate: '2022-01', endDate: '', summary: 's', highlights: [] },
  ],
  education: [],
  projects: [
    { name: 'B', order: 2, featured: false, description: 'd', highlights: [], tech: ['Swift'], url: '', demo: '', image: '', color: '' },
    { name: 'A', order: 1, featured: true, description: 'd', highlights: [], tech: [], url: '', demo: '', image: 'a.png', color: '#123456' },
  ],
  activities: [{ name: 'Hack', order: 1, role: 'Participant', date: '2025-07', description: 'd', url: '', image: '' }],
  credentials: [
    { kind: 'Certificate', name: 'Old cert', issuer: 'X', date: '2020-01', url: '', summary: '' },
    { kind: 'Award', name: 'Top', issuer: 'Upwork', date: '', url: '', summary: 'great' },
    { kind: 'Certificate', name: 'New cert', issuer: 'Y', date: '2022-01', url: '', summary: '' },
  ],
  writing: [],
};

describe('buildResume', () => {
  const r = buildResume(content, '2026-01-01');

  it('splits volunteering out of work and sorts work by recency', () => {
    expect(r.work.map((w) => w.name)).toEqual(['Now', 'Old']);
    expect(r.volunteer.map((v) => v.organization)).toEqual(['Club']);
  });
  it('splits credentials into awards and newest-first certificates', () => {
    expect(r.awards.map((a) => a.title)).toEqual(['Top']);
    expect(r.certificates.map((c) => c.name)).toEqual(['New cert', 'Old cert']);
  });
  it('orders projects by the CMS order and defaults the color', () => {
    expect(r.projects.map((p) => p.name)).toEqual(['A', 'B']);
    expect(r.projects[1].color).toBe('#64748b');
  });
  it('derives the canonical URL from the profile URL', () => {
    expect(r.meta).toEqual({ canonical: 'https://example.com/resume.json', version: 'v1.0.0', lastModified: '2026-01-01' });
  });
});

describe('toJsonResume', () => {
  const json = toJsonResume(buildResume(content, '2026-01-01'));

  it('drops presentation-only fields', () => {
    expect(json).not.toHaveProperty('stats');
    expect(json.projects[0]).not.toHaveProperty('featured');
    expect(json.projects[0]).not.toHaveProperty('color');
  });
  it('keeps the extra sections and uses an absolute image URL', () => {
    expect(json.softSkills).toHaveLength(1);
    expect(json.activities).toHaveLength(1);
    expect(json.basics.image).toBe('https://example.com/og.png');
  });
});
