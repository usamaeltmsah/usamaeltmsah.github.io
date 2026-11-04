/**
 * ATS (applicant tracking system) checks for the CV PDF.
 * ATS parsers read the PDF's text layer in order, so we extract it the same way
 * (PDF.js) and verify that everything a recruiter's system needs comes out
 * complete, in the right order, and in plain characters.
 */

import { plainText } from '../src/lib/plain-text.ts';

export type JsonResume = {
  basics: { name: string; email: string; url: string; summary: string; profiles: { network: string; url: string }[] };
  work: { name: string; position: string; startDate: string; endDate: string; summary: string; highlights: string[] }[];
  education: { institution: string }[];
  skills: { keywords: string[] }[];
};

export type AtsInput = {
  /** Text of each page, in reading order. */
  pages: string[];
  /** The raw PDF, to inspect embedded fonts. */
  pdf: Uint8Array;
  resume: JsonResume;
  /** Highlights the CV shows per role (the CV may trim long lists). */
  highlightsPerRole?: number;
  /** Names of projects shown on the CV. */
  projects?: string[];
  maxPages?: number;
  maxBytes?: number;
};


/** Collapses whitespace so wrapped lines compare equal to the source text. */
export const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

const host = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthYear = (d: string) => {
  const [y, m] = d.split('-');
  return m ? `${MONTHS[+m - 1]} ${y}` : y;
};

/** Returns a list of problems; empty means the CV is ATS-friendly. */
export function checkAts({ pages, pdf, resume, highlightsPerRole = 3, projects = [], maxPages = 2, maxBytes = 2 * 1024 * 1024 }: AtsInput): string[] {
  const problems: string[] = [];
  const raw = pages.join('\n');
  const text = normalize(raw);
  const has = (s: string) => text.includes(normalize(s));
  const at = (s: string, from = 0) => text.indexOf(normalize(s), from);

  // File-level
  if (pages.length > maxPages) problems.push(`PDF has ${pages.length} pages; keep it to ${maxPages}.`);
  if (pdf.byteLength > maxBytes) problems.push(`PDF is ${Math.round(pdf.byteLength / 1024)} KB; many ATS reject files over ${Math.round(maxBytes / 1024)} KB.`);
  const binary = Buffer.from(pdf).toString('latin1');
  if (/\/Subtype\s*\/Type3/.test(binary)) problems.push('PDF embeds Type3 fonts, which many ATS cannot read. Use static (non-variable) fonts.');
  if (raw.replace(/\s/g, '').length < 1500) problems.push('Too little extractable text; the CV may be an image or use unreadable fonts.');

  // Character-level
  const bad = [...new Set(raw.match(/[�-ﬀ-ﬆ]/g) ?? [])];
  if (bad.length) problems.push(`Unreadable characters in the text layer: ${bad.map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase()}`).join(', ')} (ligatures or missing glyphs).`);

  // Contact details as plain text
  const b = resume.basics;
  for (const [label, value] of [['name', b.name], ['email', b.email], ['website', host(b.url)]] as const) {
    if (!has(value)) problems.push(`Contact ${label} "${value}" is not in the text.`);
  }
  const linkedin = b.profiles.find((p) => p.network === 'LinkedIn');
  if (linkedin && !has(host(linkedin.url))) problems.push(`LinkedIn URL "${host(linkedin.url)}" is not written out as text.`);

  // Standard section headings
  for (const heading of ['Summary', 'Experience', 'Education', 'Skills']) {
    if (!new RegExp(`(^|\\n)\\s*${heading}\\s*(\\n|$)`, 'i').test(raw)) problems.push(`Missing the standard "${heading}" heading on its own line.`);
  }

  // Summary must come out as one unbroken passage (no column interleaving)
  if (!has(plainText(b.summary))) problems.push('The summary is broken up in the text layer (columns may be interleaving).');

  // Each role: title, company and dates present; its text in order and before the next role
  // Anchor each role on its own heading ("Position · Company"); the company may also appear earlier, e.g. in the summary.
  const starts = resume.work.map((w) => { const h = at(`${w.position} · ${w.name}`); return h >= 0 ? h : at(w.name); });
  resume.work.forEach((w, i) => {
    const start = starts[i];
    if (start < 0) return void problems.push(`Company "${w.name}" is missing.`);
    if (!has(w.position)) problems.push(`Job title "${w.position}" (${w.name}) is missing.`);
    if (w.startDate && !has(monthYear(w.startDate)) && !has(w.startDate.slice(0, 4))) problems.push(`Start date of ${w.name} is missing.`);
    const next = starts.slice(i + 1).find((s) => s > start) ?? Infinity;
    const end = Math.min(next, text.length);
    const expected = [w.summary, ...w.highlights.slice(0, highlightsPerRole)].map(plainText);
    const isDetailed = has(plainText(w.summary));
    if (!isDetailed) return; // one-line "earlier experience" roles have no summary on the CV
    for (const line of expected) {
      const pos = at(line, start);
      if (pos < 0) problems.push(`"${line.slice(0, 50)}…" (${w.name}) is broken up or missing in the text layer.`);
      else if (pos > end) problems.push(`"${line.slice(0, 50)}…" is read after the next role, so an ATS would file it under the wrong job.`);
    }
  });

  for (const e of resume.education) if (!has(e.institution)) problems.push(`Education "${e.institution}" is missing.`);
  for (const p of projects) if (!has(p)) problems.push(`Project "${p}" is missing.`);
  const missingSkills = resume.skills.flatMap((s) => s.keywords).filter((k) => !has(plainText(k)));
  if (missingSkills.length) problems.push(`Skills not readable as text: ${missingSkills.join(', ')}.`);

  return problems;
}

/** Extracts each page's text in reading order with PDF.js. */
export async function extractPages(pdf: Uint8Array): Promise<string[]> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(pdf), useSystemFonts: false, verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : '')).join(''));
  }
  await doc.destroy();
  return pages;
}
