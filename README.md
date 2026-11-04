# Usama Fouad: Portfolio

Personal portfolio of Usama Fouad, iOS Developer. It's a static [Astro](https://astro.build) site generated from one data file, editable through a git-based CMS, and deployed to GitHub Pages.

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
src/data/resume.json ──► astro build ──► /            (portfolio)
        ▲                     │       ──► /cv/         (printable CV)
        │                     │       ──► /resume.json (JSON Resume)
   CMS at /admin              │       ──► /llms.txt, /llms-full.txt, /index.md
   (commits to main)          ▼
                     scripts/cv-pdf.mjs ──► /cv.pdf
```

- **Static content:** everything about you lives in [`src/data/resume.json`](src/data/resume.json). Change it once, and the site, the CV, the PDF, the JSON download and the agent files all update.
- **Dynamic content:** GitHub stats and recent repos, dev.to articles and YouTube videos are fetched at build time ([`src/lib/data.ts`](src/lib/data.ts)). If an API is down, the build still succeeds; the GitHub section is hidden and the feed falls back to `publications` in `resume.json`.
- **Deploys:** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and deploys on every push to `main`, once a day at 03:17 UTC to refresh the live data, and on demand from the Actions tab (**Run workflow**).

## Editing content

### Option 1: CMS (no code)

1. Create a GitHub **fine-grained personal access token**: [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
   - Repository access: **Only select repositories** → `usamaeltmsah.github.io`
   - Permissions: **Contents → Read and write**
2. Open https://usamaeltmsah.github.io/admin/ and choose **Sign In Using Access Token**. **Sign In with GitHub** won't work, because it needs an OAuth server that GitHub Pages can't host.
3. Open **Portfolio → Resume & portfolio data**, edit, and **Save**.

Each save is a commit to `main`. The site, CV, PDF and JSON update about a minute later. Uploaded images go to `src/assets/images` and are automatically resized and converted to WebP.

You can also edit without a token: open `/admin/` locally (see [Local development](#local-development)) in Chrome or Edge, choose **Work with Local Repository**, and pick this folder. Then commit and push yourself.

### Option 2: Edit the JSON directly

Edit [`src/data/resume.json`](src/data/resume.json) and push. Besides the standard JSON Resume sections, it has a few extra fields:

| Field | Used for |
| --- | --- |
| `basics.headline`, `basics.availability` | Hero headline and status pill (the word "polished" gets the gradient) |
| `stats[]` | The four stat tiles under the hero |
| `projects[].featured` | `true` shows the project large, in a phone frame, using `image` |
| `projects[].image`, `projects[].color` | Screenshot file name (portrait works best) and card accent color |
| `activities[]` | "Beyond the day job" cards, optionally with an `image` |
| `softSkills[]` | Soft-skills grid; give each one a line of evidence |

Dates are `YYYY-MM` or `YYYY`. Leave `endDate` empty for a current role. Images are referenced by file name only (for example, `"hackathon-vois.jpg"`) and must exist in `src/assets/images/`.

## Local development

Requires Node.js 22.23.4 or later.

```bash
npm install
npm run dev          # http://localhost:4321 with hot reload
npm run build        # site + dist/cv.pdf
npm run build:site   # site only, skips the PDF
npx astro preview    # serve dist/
```

The PDF step uses headless Chrome through `puppeteer-core`. It looks for Chrome, Edge or Chromium in the usual install locations, or you can set `CHROME_PATH`. If none is found, the step is skipped with a warning.

Set `GITHUB_TOKEN` when building locally to avoid GitHub API rate limits.

## Project structure

```
src/
  data/resume.json        # all content (single source of truth)
  assets/images/          # photos and screenshots (optimized at build)
  lib/data.ts             # data helpers + GitHub / dev.to / YouTube fetchers
  lib/markdown.ts         # resume → markdown (index.md, llms-full.txt)
  layouts/Base.astro      # <head>, SEO meta, JSON-LD
  pages/index.astro       # portfolio
  pages/cv.astro          # printable A4 CV
  pages/*.ts              # resume.json, llms.txt, llms-full.txt, index.md, manifest
  styles/global.css       # design tokens, light/dark themes, layout
public/
  admin/                  # Sveltia CMS (index.html + config.yml)
  robots.txt, og.png, icon.svg, humans.txt
scripts/cv-pdf.mjs        # renders /cv/ to dist/cv.pdf
.github/workflows/deploy.yml
```

## Performance and agent readiness

- Lighthouse scores 100 in Performance, Accessibility, Best Practices, SEO and Agentic Browsing, on mobile and desktop, for both `/` and `/cv/`.
- No web fonts, frameworks or trackers. CSS is inlined, and images are responsive WebP.
- Structured data: JSON-LD `Person`, `ProfilePage` and `WebSite`, all built from `resume.json`.
- Agent-friendly: `llms.txt`, a markdown copy of the page, a machine-readable resume, `robots.txt` content signals (search and AI input allowed, training disallowed), and WebMCP tools (`get_profile`, `list_projects`, `get_skills`, `get_contact`, `download_resume`) for browsers that support `navigator.modelContext`.

After design changes, re-check with:

```bash
npx lighthouse https://usamaeltmsah.github.io/ --view
```

## Troubleshooting

- **The site didn't update after a CMS save:** check the [Actions](https://github.com/usamaeltmsah/usamaeltmsah.github.io/actions) tab for a failed run. The usual cause is invalid JSON or an image name that doesn't exist in `src/assets/images/`.
- **The CMS says "Not found" after you sign in:** the token is missing access to this repository, or lacks Contents: Read and write.
- **The GitHub or YouTube sections disappeared:** an API was unreachable during that build. The next daily run restores them, or you can trigger **Run workflow** manually.
