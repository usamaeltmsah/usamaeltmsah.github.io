import { z } from 'astro/zod';

/** "", "2024", "2024-03" */
const date = z.string().regex(/^$|^\d{4}(-(0[1-9]|1[0-2]))?$/, 'Use YYYY or YYYY-MM').default('');
/** Activities also allow a year range such as "2018-2019". */
const looseDate = z.string().regex(/^$|^\d{4}(-(0[1-9]|1[0-2]))?$|^\d{4}-\d{4}$/, 'Use YYYY, YYYY-MM or YYYY-YYYY').default('');
const url = z.union([z.literal(''), z.url()]).default('');
const text = z.string().trim().min(1);
const list = z.array(text).default([]);
/** A link to another entry by its file name (slug), e.g. "nugttah". Empty means no link. */
const ref = z.string().regex(/^$|^[a-z0-9-]+$/, 'Pick an entry in the CMS').default('');

export const profileSchema = z.object({
  name: text,
  label: text,
  headline: text,
  image: z.string().default(''),
  email: z.email(),
  url: z.url(),
  availability: z.string().default(''),
  summary: text,
  location: z.object({ city: text, countryCode: z.string().length(2), region: z.string().default('') }),
  stats: z.array(z.object({ value: text, label: text })).max(4),
  profiles: z.array(z.object({ network: text, username: z.string().default(''), url: z.url() })),
});

export const skillsSchema = z.object({
  technical: z.array(z.object({ name: text, keywords: list })),
  soft: z.array(z.object({ name: text, description: text })),
  languages: z.array(z.object({ language: text, fluency: text })),
  interests: z.array(z.object({ name: text, keywords: list })),
});

export const experienceTypes = ['Full-time', 'Part-time', 'Freelance', 'Contract', 'Internship'] as const;

export const experienceSchema = z.object({
  company: text,
  position: text,
  type: z.enum(experienceTypes),
  url,
  location: z.string().default(''),
  startDate: date,
  endDate: date,
  summary: text,
  highlights: list,
});

export const volunteeringSchema = z.object({
  organization: text,
  role: text,
  url,
  location: z.string().default(''),
  startDate: date,
  endDate: date,
  summary: text,
  highlights: list,
  image: z.string().default(''),
});

export const educationSchema = z.object({
  institution: text,
  degree: text,
  area: z.string().default(''),
  url,
  startDate: date,
  endDate: date,
  score: z.string().default(''),
  courses: list,
});

export const projectSchema = z.object({
  name: text,
  /** Managed by the CMS drag-and-drop; new entries sort last until reordered. */
  order: z.number().int().positive().default(999),
  featured: z.boolean().default(false),
  /** Client or employer work: no links, shown with a "Private" label and described without client details. */
  private: z.boolean().default(false),
  /** Include in the 2-page CV (keep it to the 6 or so strongest). */
  onCv: z.boolean().default(false),
  period: looseDate,
  /** The role this project was built in (experience slug). */
  experience: ref,
  description: text,
  highlights: list,
  tech: list,
  url,
  demo: url,
  image: z.string().default(''),
  color: z.string().regex(/^$|^#[0-9a-fA-F]{6}$/, 'Use a hex color like #2563eb').default(''),
});

export const activitySchema = z.object({
  name: text,
  /** Managed by the CMS drag-and-drop; new entries sort last until reordered. */
  order: z.number().int().positive().default(999),
  role: text,
  date: looseDate,
  /** Optional link to the job or volunteering role this activity happened in. */
  experience: ref,
  volunteering: ref,
  description: text,
  url,
  image: z.string().default(''),
});

export const testimonialSources = ['Upwork', 'LinkedIn', 'Email', 'Other'] as const;

export const testimonialSchema = z.object({
  /** The client's words, exactly as written. */
  quote: text,
  /** Managed by the CMS drag-and-drop. */
  order: z.number().int().positive().default(999),
  source: z.enum(testimonialSources),
  /** How the author is shown. Keep clients anonymous unless they agreed to be named. */
  author: text,
  /** What the work was, e.g. "SwiftUI mobile app". */
  context: z.string().default(''),
  date,
  rating: z.number().int().min(0).max(5).default(0),
  /** Where the review can be verified, e.g. the Upwork profile or LinkedIn recommendations. */
  url,
  project: ref,
  experience: ref,
  onCv: z.boolean().default(false),
});

export const credentialKinds = ['Certificate', 'Award'] as const;

export const credentialSchema = z.object({
  kind: z.enum(credentialKinds),
  name: text,
  issuer: text,
  date,
  url,
  summary: z.string().default(''),
});

export const writingSchema = z.object({
  title: text,
  publisher: text,
  date: z.string().regex(/^$|^\d{4}-\d{2}(-\d{2})?$/, 'Use YYYY-MM-DD'),
  url: z.url(),
  summary: z.string().default(''),
});

export type Profile = z.infer<typeof profileSchema>;
export type Skills = z.infer<typeof skillsSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Volunteering = z.infer<typeof volunteeringSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type Testimonial = z.infer<typeof testimonialSchema>;
export type Credential = z.infer<typeof credentialSchema>;
export type Writing = z.infer<typeof writingSchema>;

/** Folder collections: directory under src/content → schema. Shared by Astro, the CMS test and the content test. */
export const folders = {
  experience: experienceSchema,
  volunteering: volunteeringSchema,
  education: educationSchema,
  projects: projectSchema,
  activities: activitySchema,
  testimonials: testimonialSchema,
  credentials: credentialSchema,
  writing: writingSchema,
} as const;

/** Relation fields: [collection, field] → target collection. Checked by tests and at build time. */
export const relations = [
  { from: 'projects', field: 'experience', to: 'experience' },
  { from: 'activities', field: 'experience', to: 'experience' },
  { from: 'activities', field: 'volunteering', to: 'volunteering' },
  { from: 'testimonials', field: 'project', to: 'projects' },
  { from: 'testimonials', field: 'experience', to: 'experience' },
] as const;

/** Single-file entries under src/content. */
export const singletons = {
  profile: profileSchema,
  skills: skillsSchema,
} as const;
