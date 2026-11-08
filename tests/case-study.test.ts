import { describe, expect, it } from 'vitest';
import { caseStudies, caseStudyPath, neighbours, paragraphs } from '../src/lib/case-study';
import { buildResume, type Content } from '../src/lib/resume';

const project = (id: string, order: number, over: Partial<Content['projects'][number]> = {}): Content['projects'][number] => ({
  id, name: id, order, featured: true, private: false, onCv: false, period: '', experience: '',
  description: 'd', highlights: [], tech: [], url: '', demo: '', image: '', color: '',
  problem: '', approach: '', challenge: '', outcome: '', gallery: [], ...over,
});

const resume = buildResume({
  profile: {
    name: 'Ada', label: 'iOS Developer', headline: 'Hi', image: '', email: 'a@b.co', phone: '', url: 'https://example.com/',
    availability: '', summary: 'S', location: { city: 'Cairo', countryCode: 'EG', region: '' }, stats: [], profiles: [],
  },
  skills: { technical: [], soft: [], languages: [], interests: [] },
  experience: [], volunteering: [], education: [], activities: [], testimonials: [], credentials: [], writing: [],
  projects: [
    project('plain', 1),
    project('nda', 2, { private: true, problem: 'Secret' }),
    project('story', 3, { problem: 'Why', approach: 'How', gallery: ['x.png'] }),
  ],
} as unknown as Content, '2026-01-01');

describe('caseStudies', () => {
  it('only includes public projects with a problem written', () => {
    expect(caseStudies(resume).map((p) => p.id)).toEqual(['story']);
  });
  it('never publishes a case study for private client work', () => {
    expect(resume.projects.find((p) => p.id === 'nda')?.caseStudy).toBeNull();
  });
  it('carries the write-up and gallery', () => {
    expect(caseStudies(resume)[0].caseStudy).toEqual({ problem: 'Why', approach: 'How', challenge: '', outcome: '', gallery: ['x.png'] });
  });
});

describe('paragraphs', () => {
  it('splits on blank lines and joins wrapped lines', () => {
    expect(paragraphs('One\nline.\n\n  Two.  \n\n\n')).toEqual(['One line.', 'Two.']);
  });
  it('returns nothing for empty text', () => {
    expect(paragraphs('')).toEqual([]);
  });
});

describe('neighbours', () => {
  it('wraps around both ends', () => {
    expect(neighbours(['a', 'b', 'c'], 0)).toEqual({ prev: 'c', next: 'b' });
    expect(neighbours(['a', 'b', 'c'], 2)).toEqual({ prev: 'b', next: 'a' });
  });
  it('has no neighbours for a single page', () => {
    expect(neighbours(['a'], 0)).toEqual({ prev: undefined, next: undefined });
  });
});

it('builds the page path', () => {
  expect(caseStudyPath('time-hero')).toBe('/projects/time-hero/');
});
