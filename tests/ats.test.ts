import { describe, expect, it } from 'vitest';
import { checkAts, normalize, type JsonResume } from '../scripts/ats.ts';

const resume: JsonResume = {
  basics: {
    name: 'Ada Lovelace', email: 'ada@example.com', url: 'https://ada.example/', summary: 'Seasoned iOS developer.',
    profiles: [{ network: 'LinkedIn', url: 'https://www.linkedin.com/in/ada/' }],
  },
  work: [
    { name: 'Acme', position: 'iOS Developer', startDate: '2024-02', endDate: '', summary: 'Builds the Acme app on iOS.', highlights: ['Shipped offline mode', 'Cut crashes by half'] },
    { name: 'Beta Labs', position: 'Intern', startDate: '2020-01', endDate: '2020-03', summary: 'Wrote tests for Beta.', highlights: [] },
  ],
  education: [{ institution: 'Cairo University' }],
  skills: [{ keywords: ['Swift', 'SwiftUI'] }],
};

const filler = 'Lorem ipsum dolor sit amet. '.repeat(60);
const good = `Ada Lovelace
ada@example.com ada.example linkedin.com/in/ada
Summary
Seasoned iOS developer.
Experience
iOS Developer · Acme
Feb 2024 – Present
Builds the Acme app on iOS.
Shipped offline mode
Cut crashes by half
Intern · Beta Labs
Jan 2020 – Mar 2020
Wrote tests for Beta.
Education
Cairo University
Skills
Swift, SwiftUI
${filler}`;
const pdf = new TextEncoder().encode('%PDF-1.7 << /Type /Font /Subtype /Type0 >>');
const run = (pages: string[], over: Partial<Parameters<typeof checkAts>[0]> = {}) => checkAts({ pages, pdf, resume, ...over });

describe('checkAts', () => {
  it('passes a clean, single-reading-order CV', () => expect(run([good])).toEqual([]));

  it('catches bullets read after the next job (absolutely positioned bullets)', () => {
    const moved = good.replace('Shipped offline mode\n', '') + '\nShipped offline mode';
    expect(run([moved]).join('\n')).toMatch(/Shipped offline mode.*wrong job|read after the next role/);
  });

  it('catches letter-spaced headings that ATS read as single letters', () => {
    expect(run([good.replace('Experience\n', 'E X P E R I E N C E\n')])).toContain('Missing the standard "Experience" heading on its own line.');
  });

  it('catches a summary interleaved with sidebar text (two columns read across)', () => {
    expect(run([good.replace('Seasoned iOS developer.', 'Seasoned iOS\nLanguages: Swift\ndeveloper.')])).toContain(
      'The summary is broken up in the text layer (columns may be interleaving).',
    );
  });

  it('catches Type3 fonts, ligatures and missing glyphs', () => {
    const type3 = new TextEncoder().encode('<< /Type /Font /Subtype /Type3 >>');
    expect(run([good], { pdf: type3 }).join()).toMatch(/Type3/);
    expect(run([good.replace('offline', 'oﬄine')]).join()).toMatch(/U\+FB04/);
    expect(run([good + '�']).join()).toMatch(/U\+FFFD/);
  });

  it('requires contact URLs written out as text', () => {
    expect(run([good.replace('linkedin.com/in/ada', 'LinkedIn')])).toContain('LinkedIn URL "linkedin.com/in/ada" is not written out as text.');
  });

  it('enforces page count and file size', () => {
    expect(run([good, '', ''])).toContain('PDF has 3 pages; keep it to 2.');
    expect(run([good], { pdf: new Uint8Array(3 * 1024 * 1024) }).join()).toMatch(/KB; many ATS reject/);
  });

  it('reports missing projects and skills', () => {
    expect(run([good], { projects: ['Safari Darkula'] })).toContain('Project "Safari Darkula" is missing.');
    expect(run([good.replace('Swift, SwiftUI', 'Swift')]).join()).toMatch(/Skills not readable as text: SwiftUI/);
  });

  it('normalizes wrapped lines', () => expect(normalize(' A\n  b\tC ')).toBe('a b c'));
});
