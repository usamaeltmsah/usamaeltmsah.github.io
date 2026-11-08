import { describe, expect, it } from 'vitest';
import { buildResume, type Content } from '../src/lib/resume';
import { buildTimeline, duration } from '../src/lib/timeline';

const NOW = new Date(Date.UTC(2026, 10, 4)); // Nov 2026

describe('duration', () => {
  it('counts both end months, like LinkedIn', () => expect(duration('2018-09', '2019-04', NOW)).toBe('8 mos'));
  it('runs an ongoing role to this month', () => expect(duration('2025-02', '', NOW)).toBe('1 yr 10 mos'));
  it('drops a zero part', () => expect(duration('2020-01', '2021-12', NOW)).toBe('2 yrs'));
  it('is one month at least', () => expect(duration('2019-07', '2019-07', NOW)).toBe('1 mo'));
  it('stays blank for year-only dates', () => expect(duration('2016', '2020', NOW)).toBe(''));
});

const job = (id: string, company: string, type: 'Full-time' | 'Freelance', startDate: string, endDate: string, summary = '') =>
  ({ id, company, position: 'iOS Developer', type, url: '', location: '', startDate, endDate, summary, highlights: [] });
const project = (id: string, experience: string, over: Partial<Content['projects'][number]> = {}): Content['projects'][number] => ({
  id, name: id.toUpperCase(), order: 1, featured: false, private: false, onCv: false, period: '2024', experience,
  description: 'An app.', highlights: [], tech: [], url: '', demo: '', image: '', color: '',
  problem: '', approach: '', challenge: '', outcome: '', gallery: [], ...over,
});

const content: Content = {
  profile: {
    name: 'Ada', label: 'iOS Developer', headline: '', image: '', email: 'a@b.co', phone: '', url: 'https://example.com/',
    availability: '', summary: '', location: { city: 'Cairo', countryCode: 'EG', region: '' }, stats: [], profiles: [],
  },
  skills: {
    technical: [
      { name: 'Languages', keywords: ['Swift', 'Python', 'C/C++'] },
      { name: 'UI', keywords: ['SwiftUI', 'UIKit', 'React Native (growing)'] },
      { name: 'Hardware', keywords: ['Arduino'] },
    ],
    soft: [], languages: [], interests: [],
  },
  experience: [
    job('corp', 'Corp (Corporate Solutions)', 'Full-time', '2025-02', '', 'Building apps with React Native.'),
    job('market', 'Market', 'Freelance', '2022-06', ''),
    job('old', 'Old Co', 'Full-time', '2019-01', '2020-06'),
  ],
  volunteering: [
    { id: 'club', organization: 'Club', role: 'Trainer', url: '', location: '', startDate: '2018-09', endDate: '2019-04', summary: 'Taught Arduino.', highlights: [], image: 'club.jpg' },
  ],
  education: [
    { institution: 'Uni', degree: 'B.Sc.', area: 'Computer Science', url: '', startDate: '2016', endDate: '2020', score: '', courses: ['Algorithms'] },
  ],
  projects: [
    project('shop', 'market', { tech: ['UIKit'], description: 'A Swift shop.' }),
    project('side', '', { tech: ['Python'], period: '2022-2023' }),
  ],
  activities: [
    { id: 'hack', name: 'Hack', order: 1, role: 'Participant', date: '2025-07', description: 'd', url: '', image: 'hack.jpg', experience: 'corp', volunteering: '' },
  ],
  testimonials: [], credentials: [], writing: [],
};

describe('buildTimeline', () => {
  const t = buildTimeline(buildResume(content, '2026-11-04'), NOW);
  const role = (id: string) => t.roles.find((r) => r.id === id)!;

  it('puts current roles first, then newest, across jobs, volunteering and education', () => {
    expect(t.roles.map((r) => r.id)).toEqual(['corp', 'market', 'old', 'club', 'education-0']);
  });

  it('labels each role for the phone', () => {
    expect(role('corp')).toMatchObject({ org: 'Corp', kind: 'Full-time', current: true, year: 2025, dates: 'Feb 2025 – Present', duration: '1 yr 10 mos', image: 'hack.jpg' });
    expect(role('club')).toMatchObject({ kind: 'Volunteering', current: false, dates: 'Sep 2018 – Apr 2019', duration: '8 mos', image: 'club.jpg' });
    expect(role('education-0')).toMatchObject({ kind: 'Education', title: 'B.Sc.', org: 'Uni', summary: 'Computer Science', duration: '', courses: ['Algorithms'] });
  });

  it('lists only projects done in that role', () => {
    expect(role('market').projects).toEqual(['shop']);
    expect(role('corp').projects).toEqual([]);
    expect(role('old').projects).toEqual([]); // "side" ran in other years and belongs to no job
  });

  it('takes skills from the role and its own projects only', () => {
    expect(role('market').skills).toEqual([{ name: 'Languages', keywords: ['Swift'] }, { name: 'UI', keywords: ['UIKit'] }]);
    expect(role('corp').skills).toEqual([{ name: 'UI', keywords: ['React Native (growing)'] }]);
    expect(role('club').skills).toEqual([{ name: 'Hardware', keywords: ['Arduino'] }]);
    expect(role('old').skills).toEqual([]);
  });

  it('does not count a word inside another word as a skill', () => {
    // "SwiftUI" must not make "Swift" match, and "C/C++" must not throw on regex characters
    const r = buildResume({ ...content, experience: [job('x', 'X', 'Full-time', '2020-01', '2020-02', 'Shipped SwiftUI screens.')], projects: [], activities: [] }, '2026-11-04');
    expect(buildTimeline(r, NOW).roles[0].skills).toEqual([{ name: 'UI', keywords: ['SwiftUI'] }]);
  });

  it('carries only public links for private projects', () => {
    const r = buildResume({ ...content, projects: [project('secret', 'market', { private: true, url: 'https://leak.example' })] }, '2026-11-04');
    expect(buildTimeline(r, NOW).projects[0]).toMatchObject({ private: true, url: '' });
  });
});
