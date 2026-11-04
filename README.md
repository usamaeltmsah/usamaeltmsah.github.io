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
| **Experience** | One entry per role (Full-time, Part-time, Freelance, Internship, Volunteer) | Newest first; group by type; filter current or past roles |
| **Education** | One entry per school | |
| **Projects** | One entry per project, with a screenshot thumbnail | Drag and drop to set the order on the site; filter featured |
| **Activities** | Hackathons, workshops, conferences, communities | Drag and drop to set the order; photo thumbnails |
| **Certificates & awards** | One entry per credential | Newest first; group by kind or issuer |
| **Writing** | Articles (used when dev.to is unreachable, and in `resume.json`) | Newest first |

Every field has a hint, and dates are validated as you type (`YYYY-MM`). Leave **End** empty for a current role.

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
| `src/content/experience/<company>.json` | `type` is one of `Full-time`, `Part-time`, `Freelance`, `Internship`, `Volunteer` |
| `src/content/projects/<name>.json` | `order` sets the position; `featured: true` shows it large in a phone frame using `image` |
| `src/content/activities/<name>.json` | `order` sets the position; `date` can be `YYYY`, `YYYY-MM` or `YYYY-YYYY` |
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

- **`content.test.ts`:** every content file matches its Zod schema, and every referenced image exists.
- **`cms-config.test.ts`:** `public/admin/config.yml` is valid against Sveltia CMS's official JSON Schema and uses only built-in widgets. Every CMS field exists in the Zod schema, every required schema field is editable in the CMS, and `index.html` loads the same Sveltia version the tests validate against.
- **`resume.test.ts`, `feeds.test.ts`:** date formatting, sorting, resume assembly, and the GitHub and YouTube parsers.

When upgrading Sveltia, bump the version in both `package.json` and `public/admin/index.html` (and the `$schema` line in `config.yml`). The tests will flag a mismatch.

## Project structure

```
src/
  content/                # all content (one JSON file per entry)
    profile.json, skills.json
    experience/ education/ projects/ activities/ credentials/ writing/
  content.config.ts       # Astro collections for the folders above
  assets/images/          # photos and screenshots (optimized at build)
  lib/schemas.ts          # Zod schemas: the single definition of every field
  lib/resume.ts           # pure: entries → JSON Resume, date formatting, sorting
  lib/feeds.ts            # pure: GitHub summary, YouTube feed parsing
  lib/data.ts             # loads collections, fetches feeds, resolves images
  lib/markdown.ts         # resume → markdown (index.md, llms-full.txt)
  layouts/Base.astro      # <head>, SEO meta, JSON-LD
  pages/index.astro       # portfolio
  pages/cv.astro          # printable A4 CV
  pages/*.ts              # resume.json, llms.txt, llms-full.txt, index.md, manifest
  styles/global.css       # design tokens, light/dark themes, layout
public/
  admin/                  # Sveltia CMS (index.html + config.yml)
  robots.txt, og.png, icon.svg, humans.txt
tests/                    # Vitest
scripts/cv-pdf.mjs        # renders /cv/ to dist/cv.pdf
.github/workflows/deploy.yml
```

## Performance and agent readiness

- Lighthouse scores 100 in Performance, Accessibility, Best Practices, SEO and Agentic Browsing, on mobile and desktop, for both `/` and `/cv/`.
- No web fonts, frameworks or trackers. CSS is inlined, and images are responsive WebP.
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
