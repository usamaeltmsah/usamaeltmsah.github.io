import type { Resume } from './resume';

type Project = Resume['projects'][number];
export type CaseStudyProject = Project & { caseStudy: NonNullable<Project['caseStudy']> };

export const caseStudyPath = (id: string) => `/projects/${id}/`;
/** The link-preview image, rendered after the build by scripts/share-images.ts. */
export const shareImagePath = (id: string) => `/share/${id}.png`;

/** Projects that have a case study page, in the CMS order. */
export const caseStudies = (r: Resume): CaseStudyProject[] =>
  r.projects.filter((p): p is CaseStudyProject => p.caseStudy !== null);

/** Splits CMS text on blank lines; single line breaks stay inside a paragraph. */
export const paragraphs = (text: string) =>
  text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);

/** The previous and next case studies, wrapping around, so every page links onward. */
export function neighbours<T>(list: T[], index: number): { prev: T | undefined; next: T | undefined } {
  if (list.length < 2) return { prev: undefined, next: undefined };
  return { prev: list[(index - 1 + list.length) % list.length], next: list[(index + 1) % list.length] };
}
