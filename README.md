# Usama Fouad: Portfolio

Personal portfolio of Usama Fouad, iOS Developer. It's a static [Astro](https://astro.build) site built from small JSON content files, editable through a git-based CMS, and deployed to GitHub Pages.

**Live:** https://usamaeltmsah.github.io/

## Where everything is

| What | URL |
| --- | --- |
| Portfolio | https://usamaeltmsah.github.io/ |
| Printable CV (HTML) | https://usamaeltmsah.github.io/cv/ |
| CV as PDF | https://usamaeltmsah.github.io/cv.pdf |
| Resume as JSON ([JSON Resume](https://jsonresume.org/schema) schema) | https://usamaeltmsah.github.io/resume.json |
| CMS (edit content) | https://usamaeltmsah.github.io/admin/ |
| For AI agents | [`/llms.txt`](https://usamaeltmsah.github.io/llms.txt), [`/llms-full.txt`](https://usamaeltmsah.github.io/llms-full.txt), [`/index.md`](https://usamaeltmsah.github.io/index.md) |
| Sitemap | https://usamaeltmsah.github.io/sitemap-index.xml |
| Deploy runs | [GitHub Actions](https://github.com/usamaeltmsah/usamaeltmsah.github.io/actions) |

## How it works

```
src/content/            ──► validated (Zod) ──► buildResume() ──► /             portfolio
  profile.json                                                ──► /cv/          printable CV
  skills.json                                                 ──► /cv.pdf       PDF
  experience/*.json                                           ──► /resume.json  JSON Resume
  projects/*.json  …                                          ──► /llms.txt, /llms-full.txt, /index.md
      ▲
  CMS at /admin (each save = a commit to main)
```

- **Static content:** everything about you lives in [`src/content/`](src/content). There are two single files (profile, skills) and one small JSON file per role, project, activity, certificate and article. Change any of them, and the site, CV, PDF, JSON download and agent files all update.
- **Dynamic content:** GitHub stats and recent repos, dev.to articles and YouTube videos are fetched at build time ([`src/lib/data.ts`](src/lib/data.ts)). If an API is down, the build logs a warning and continues: the GitHub section is hidden, and the feed falls back to the **Writing** entries.
- **Deploys:** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs the tests, then builds and deploys. It runs on every push to `main`, once a day at 03:17 UTC to refresh the live data, and on demand from the Actions tab (**Run workflow**). If the tests fail, nothing is deployed.

## Editing content

### The CMS

The sidebar is organized like your CV:

| Section | What's in it | Organized by |
| --- | --- | --- |
| **Profile** | Name, title, headline, photo, summary, availability, hero stats, social links | Single page |
| **Skills & languages** | Technical skill groups, soft skills, spoken languages, interests | Single page |
| **Experience** | One entry per job (Full-time, Part-time, Freelance, Contract, Internship) | Newest first; group by type; filter current or past roles |
| **Volunteering** | One entry per volunteer role, with an optional photo | Newest first; photo thumbnails |
| **Education** | One entry per school | |
| **Projects** | One entry per project, with a screenshot thumbnail | Drag and drop to set the order; filter featured, on CV, client work |
| **Activities** | Hackathons, conferences, challenges, communities | Drag and drop to set the order; photo thumbnails |
| **Client feedback** | Reviews from Upwork, LinkedIn recommendations or email, linked to a project and role | Drag and drop to set the order; group by source; filter on CV |
| **Certificates & awards** | One entry per credential | Newest first; group by kind or issuer |
| **Writing** | Articles (used when dev.to is unreachable, and in `resume.json`) | Newest first |

Every field has a hint, and dates are validated as you type (`YYYY-MM`). Leave **End** empty for a current role.

### Linked entries

Projects and activities are linked to the role they belong to, so you only describe each role once:

- A project's **Built at (role)** picks an Experience entry. The site shows "at Nugttah" or "via Upwork" on the project, and that role lists the project as a link. Rename or edit the role, and every linked project follows.
- On the Experience phones, a role's **Projects** tab lists only projects built in that role, and its **Skills** tab lists only skills its summary, highlights or those projects name. To give a role skills, name the technologies in its summary or highlights. A tab with nothing to show is hidden.
- An activity's **Related job** or **Related volunteering** works the same way, for example the Copilot hackathon → VOIS.
- Links are stored by the entry's file name. If you delete a role that something still links to, the build stops with a message naming the broken link, so nothing goes live half-updated. Re-link the entry in the CMS, or restore the role.

### Client feedback

Paste the client's words exactly as written into **Client feedback**, pick the **Source** and link the **Related project**. The site shows it under "What clients say", in your drag-and-drop order, and the linked project gets a "★ Client review" link back to it. Tick **Show on CV** on two short quotes for the CV. The feedback is also published as `references` in `resume.json`.

- Keep clients anonymous ("Upwork client" plus what the work was) unless they agreed to be named. LinkedIn recommendations are already public, so you can use the person's name and title there.
- Only use reviews from engagements longer than a month, the same rule as client projects.

### Private client projects

Tick **Private client work** on a project to show it under **Client work** on the site and with a "Client work" label on the CV, with no links. Describe what you built, not who you built it for: no client or app names, no confidential numbers, no screenshots. Only list engagements that lasted more than a month, and never mention earnings or rates (a test blocks money amounts in all content).

### The CV

`/cv/` and `/cv.pdf` are designed for exactly **two A4 pages**:

- Page 1: header, impact stats, profile, and experience. Full-time and freelance roles are shown in full; internships and part-time roles appear as one line each under "Earlier experience".
- Page 2: selected projects (those with **Show on CV** ticked, about 6), activities (the first 4 by your drag-and-drop order), certificates, volunteering, languages and interests.

**ATS-friendly by construction.** After rendering, the build reads the PDF back the way an applicant tracking system does (with PDF.js) and fails the deploy if any of these break:

- every job title, company, date, summary and highlight is in the text, in order, under the right role (no bullets drifting to the end of the page, no columns interleaving the summary);
- standard section headings (Summary, Experience, Education, Skills, Projects, Certifications), each on its own line;
- contact details as plain text: name, email, website and the full LinkedIn URL;
- fonts embedded as real text fonts (no Type3), no ligature or broken glyphs, all skills readable;
- at most 2 pages and under 2 MB.

To keep it that way, the CV avoids letter-spacing, positioned bullets, non-Latin scripts and symbols such as ★ and → (they are written out as "4.8/5" and "to"). The rules live in [`scripts/ats.ts`](scripts/ats.ts), with tests in `tests/ats.test.ts`. If a CMS edit breaks one, the Actions log lists exactly what to fix.

The PDF step also checks the page count. If edits push it past two pages, it shrinks the layout a little (down to 85%). If it still doesn't fit, the deploy fails with a message telling you what to trim. The CV uses the bundled Inter font, so it looks the same everywhere it's built.

### Signing in

1. Create a GitHub **fine-grained personal access token**: [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
   - Repository access: **Only select repositories** → `usamaeltmsah.github.io`
   - Permissions: **Contents → Read and write**
2. Open https://usamaeltmsah.github.io/admin/ and choose **Sign In Using Access Token**. **Sign In with GitHub** won't work, because it needs an OAuth server that GitHub Pages can't host.
3. Edit and **Save**. Each save is a commit such as `content: update projects safari-darkula`. The site, CV, PDF and JSON update about a minute later.

To edit without a token, run the site locally (see [Local development](#local-development)), open http://localhost:4321/admin/ in Chrome or Edge, choose **Work with Local Repository**, and select this folder. Then commit and push yourself.

Uploaded images go to `src/assets/images/` and are automatically resized and converted to WebP.

### Editing the files directly

| File | Notes |
| --- | --- |
| `src/content/profile.json` | `headline`: the word "polished" gets the gradient. `stats`: at most 4. |
| `src/content/skills.json` | `technical`, `soft` (name + evidence), `languages`, `interests` |
| `src/content/experience/<company>.json` | `type` is one of `Full-time`, `Part-time`, `Freelance`, `Contract`, `Internship` |
| `src/content/volunteering/<organization>.json` | `role`, dates, `summary`, `highlights`, optional `image` |
| `src/content/projects/<name>.json` | `order` sets the position; `featured` shows it large in a phone frame; `private` hides links; `onCv` puts it on the CV; `experience` links to a role by file name (e.g. `"nugttah"`) |
| `src/content/activities/<name>.json` | `order` sets the position; `date` can be `YYYY`, `YYYY-MM` or `YYYY-YYYY`; optional `experience` or `volunteering` link |
| `src/content/testimonials/<name>.json` | `quote` verbatim; `source` is `Upwork`, `LinkedIn`, `Email` or `Other`; `rating` 0–5 (0 hides stars); optional `project` and `experience` links; `onCv` |
| `src/content/credentials/<name>.json` | `kind` is `Certificate` or `Award` |
| `src/content/education/`, `src/content/writing/` | One file per school or article |

The rules for every field live in [`src/lib/schemas.ts`](src/lib/schemas.ts). Images are referenced as `/src/assets/images/<file>`, and the file must exist. Run `npm test` before pushing; it reports exactly which file and field is wrong.

## Local development

Requires Node.js 22.23.4 or later.

```bash
npm install
npm run dev          # http://localhost:4321 with hot reload (CMS at /admin/)
npm test             # Vitest: content, CMS config, data helpers
npm run build        # tests + site + dist/cv.pdf
npm run build:site   # site only, skips tests and the PDF
npx astro preview    # serve dist/
```

The PDF step uses headless Chrome through `puppeteer-core`. It looks for Chrome, Edge or Chromium in the usual install locations, or you can set `CHROME_PATH`. If none is found, the step is skipped with a warning.

Set `GITHUB_TOKEN` when building locally to avoid GitHub API rate limits.

## Tests

The Vitest suite in [`tests/`](tests) guards both the content and the CMS:

- **`content.test.ts`:** every content file matches its Zod schema, every referenced image exists, and every link points to an existing entry.
- **`cms-config.test.ts`:** `public/admin/config.yml` is valid against Sveltia CMS's official JSON Schema and uses only built-in widgets. Every CMS field exists in the Zod schema, every required schema field is editable in the CMS, and `index.html` loads the same Sveltia version the tests validate against.
- **`resume.test.ts`, `feeds.test.ts`:** date formatting, sorting, resume assembly, links between entries, and the GitHub and YouTube parsers.
- **`timeline.test.ts`:** the Experience phone stack's data: order, dates and durations, and that each role lists only its own projects and skills.
- **`pdf-fit.test.ts`:** page counting and the 2-page auto-fit for the CV PDF.
- **`ats.test.ts`:** the ATS rules themselves, including the failure cases they must catch.

When upgrading Sveltia, bump the version in both `package.json` and `public/admin/index.html` (and the `$schema` line in `config.yml`). The tests will flag a mismatch.

## Project structure

```
src/
  content/                # all content (one JSON file per entry)
    profile.json, skills.json
    experience/ volunteering/ education/ projects/ activities/ testimonials/ credentials/ writing/
  content.config.ts       # Astro collections for the folders above
  assets/images/          # photos and screenshots (optimized at build)
  lib/schemas.ts          # Zod schemas: the single definition of every field
  lib/resume.ts           # pure: entries → JSON Resume, date formatting, sorting
  lib/feeds.ts            # pure: GitHub summary, YouTube feed parsing
  lib/data.ts             # loads collections, fetches feeds, resolves images
  lib/markdown.ts         # resume → markdown (index.md, llms-full.txt)
  lib/timeline.ts         # pure: resume → roles for the Experience phone stack
  scripts/phone-stack/    # Three.js phone stack and the iOS-style app drawn on each screen
  layouts/Base.astro      # <head>, SEO meta, JSON-LD
  pages/index.astro       # portfolio
  pages/cv.astro          # printable A4 CV
  pages/*.ts              # resume.json, llms.txt, llms-full.txt, index.md, manifest
  styles/global.css       # design tokens, light/dark themes, layout
public/
  admin/                  # Sveltia CMS (index.html + config.yml)
  robots.txt, og.png, icon.svg, humans.txt
tests/                    # Vitest
scripts/cv-pdf.ts         # renders /cv/ to dist/cv.pdf, fitted to 2 pages
scripts/pdf-fit.ts        # page counting + auto-fit (tested)
scripts/ats.ts            # ATS check: reads the PDF back and verifies the text layer (tested)
.github/workflows/deploy.yml
```

## Performance and agent readiness

- Lighthouse scores 100 in Performance, Accessibility, Best Practices, SEO and Agentic Browsing, on mobile and desktop, for both `/` and `/cv/`.
- No web fonts, frameworks or trackers. CSS is inlined, and images are responsive WebP.
- Three.js loads only when you scroll near Experience, and only where WebGL works. Everywhere else, and for screen readers and crawlers, the section is a plain list.
- Structured data: JSON-LD `Person`, `ProfilePage` and `WebSite`, all built from the content.
- Agent-friendly: `llms.txt`, a markdown copy of the page, a machine-readable resume, `robots.txt` content signals (search and AI input allowed, training disallowed), and WebMCP tools (`get_profile`, `list_projects`, `get_skills`, `get_contact`, `download_resume`) for browsers that support `navigator.modelContext`.

After design changes, re-check with:

```bash
npx lighthouse https://usamaeltmsah.github.io/ --view
```

## Troubleshooting

- **The site didn't update after a CMS save:** check the [Actions](https://github.com/usamaeltmsah/usamaeltmsah.github.io/actions) tab. A failed **Run tests** step names the file and field to fix, such as a date in the wrong format or an image that was deleted.
- **The CMS says "Not found" after you sign in:** the token is missing access to this repository, or lacks Contents: Read and write.
- **A new project or activity appears last:** open the section in the CMS and drag it into place. New entries sort last until they're reordered.
- **The GitHub or YouTube sections disappeared:** an API was unreachable during that build. The next daily run restores them, or you can trigger **Run workflow** manually.
