# CI Agent Open Source Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform ci-agent from an internal tool into a public open-source competitive intelligence tool for Claude Code marketers.

**Architecture:** Node.js + Playwright scrapes competitor data. CLAUDE.md serves as setup wizard and AI analysis layer. Change detection diffs between runs. No external API keys required.

**Tech Stack:** Node.js (ESM), Playwright, Handlebars, Claude Code (CLAUDE.md-driven)

**Source reference:** `D:/Claude/projects/ci-agent-v0/` contains the original working code.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `LICENSE`

**Step 1: Create package.json**

```json
{
  "name": "ci-agent",
  "version": "1.0.0",
  "description": "Competitive Intelligence Agent — scrapes competitor websites and ad libraries, generates reports. Powered by Claude Code.",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "install-browsers": "npx playwright install chromium"
  },
  "keywords": ["competitive-intelligence", "marketing", "scraper", "claude-code"],
  "license": "MIT",
  "dependencies": {
    "handlebars": "^4.7.8",
    "playwright": "^1.50.0"
  }
}
```

Note: `@anthropic-ai/sdk` is intentionally removed — Claude Code handles analysis.

**Step 2: Create .gitignore**

```
node_modules/
output/
.env
```

**Step 3: Create LICENSE**

Standard MIT license file. Use current year (2026) and author "CI Agent Contributors".

**Step 4: Commit**

```bash
git init
git add package.json .gitignore LICENSE
git commit -m "feat: initial project scaffolding"
```

---

### Task 2: Copy Scrapers (unchanged from v0)

These files are copied as-is from v0 — they work correctly and need no modifications.

**Files:**
- Create: `src/scrapers/website.js` (copy from `ci-agent-v0/src/scrapers/website.js`)
- Create: `src/scrapers/linkedin-ads.js` (copy from `ci-agent-v0/src/scrapers/linkedin-ads.js`)
- Create: `src/scrapers/google-ads.js` (copy from `ci-agent-v0/src/scrapers/google-ads.js`)
- Create: `src/competitors.js` (copy from `ci-agent-v0/src/competitors.js`)

**Step 1: Copy files**

```bash
mkdir -p D:/Claude/projects/ci-agent/src/scrapers
cp D:/Claude/projects/ci-agent-v0/src/scrapers/website.js D:/Claude/projects/ci-agent/src/scrapers/
cp D:/Claude/projects/ci-agent-v0/src/scrapers/linkedin-ads.js D:/Claude/projects/ci-agent/src/scrapers/
cp D:/Claude/projects/ci-agent-v0/src/scrapers/google-ads.js D:/Claude/projects/ci-agent/src/scrapers/
cp D:/Claude/projects/ci-agent-v0/src/competitors.js D:/Claude/projects/ci-agent/src/
```

**Step 2: Commit**

```bash
git add src/scrapers/ src/competitors.js
git commit -m "feat: add scrapers and competitor loader from v0"
```

---

### Task 3: Templatize config.js

**Files:**
- Create: `src/config.js`

**Step 1: Create config.js with placeholders**

Copy from `ci-agent-v0/src/config.js` and replace the company block:

```js
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const CONFIG = {
  root: ROOT,
  competitorsFile: path.join(ROOT, 'competitors.md'),
  outputDir: path.join(ROOT, 'output'),
  templatesDir: path.join(ROOT, 'templates'),

  // Your company info (filled in during setup)
  company: {
    name: 'YOUR_COMPANY_NAME',
    url: 'https://yourcompany.com',
    tagline: 'Your company tagline',
    description: 'Brief description of your company and what you do.',
  },

  // Scraper settings
  scraper: {
    timeout: 30_000,
    screenshotDelay: 3_000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  },

  // Ad library URL patterns
  adLibraries: {
    linkedin: (name) => `https://www.linkedin.com/ad-library/search?accountOwner=${encodeURIComponent(name)}`,
    google: (domain) => `https://adstransparency.google.com/?region=anywhere&domain=${encodeURIComponent(domain)}`,
  },
};
```

**Step 2: Create empty competitors.md**

```markdown
# Competitors

Add competitors below in the format: `- Company Name | https://website.com/`

<!-- Example:
- Acme Corp | https://acmecorp.com/
- Globex Inc | https://globex.com/
-->
```

**Step 3: Commit**

```bash
git add src/config.js competitors.md
git commit -m "feat: templatize config with placeholders for setup wizard"
```

---

### Task 4: Change Detection Module

**Files:**
- Create: `src/changes.js`

**Step 1: Write changes.js**

This module finds the previous run's `raw-data.json`, compares it against the current run, and writes a `changes.md` file.

```js
import fs from 'fs/promises';
import path from 'path';
import { CONFIG } from './config.js';

/**
 * Compare current scrape data against the most recent previous run.
 * Writes changes.md to the current output directory.
 * Returns null on first run (no previous data).
 */
export async function detectChanges(currentData, outputDir) {
  const previousDir = await findPreviousRun(outputDir);

  if (!previousDir) {
    console.log('[changes] First run — no previous data to compare.');
    return null;
  }

  console.log(`[changes] Comparing against previous run: ${path.basename(previousDir)}`);

  const previousRawPath = path.join(previousDir, 'raw-data.json');
  let previousData;
  try {
    previousData = JSON.parse(await fs.readFile(previousRawPath, 'utf-8'));
  } catch {
    console.log('[changes] Could not read previous raw-data.json — skipping diff.');
    return null;
  }

  const changes = compareRuns(previousData, currentData);
  const changesPath = path.join(outputDir, 'changes.md');

  if (changes.length === 0) {
    const md = `# Changes Since Last Run\n\n_No significant changes detected since ${path.basename(previousDir)}._\n`;
    await fs.writeFile(changesPath, md, 'utf-8');
    console.log('[changes] No significant changes found.');
    return changesPath;
  }

  let md = `# Changes Since Last Run\n\n`;
  md += `**Comparing:** ${path.basename(previousDir)} → ${path.basename(outputDir)}\n\n`;

  for (const change of changes) {
    md += `## ${change.competitor}\n\n`;
    for (const detail of change.details) {
      md += `- **${detail.field}:** ${detail.description}\n`;
    }
    md += `\n`;
  }

  await fs.writeFile(changesPath, md, 'utf-8');
  console.log(`[changes] ${changes.length} competitor(s) with changes. Saved: ${changesPath}`);
  return changesPath;
}

/**
 * Find the most recent previous output directory.
 */
async function findPreviousRun(currentOutputDir) {
  const outputRoot = CONFIG.outputDir;
  const currentName = path.basename(currentOutputDir);

  let dirs;
  try {
    dirs = await fs.readdir(outputRoot);
  } catch {
    return null;
  }

  // Filter to date-formatted directories, exclude current, sort descending
  const previous = dirs
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d !== currentName)
    .sort()
    .reverse();

  if (previous.length === 0) return null;
  return path.join(outputRoot, previous[0]);
}

/**
 * Compare two runs and return an array of changes per competitor.
 */
function compareRuns(previousData, currentData) {
  const changes = [];
  const prevByName = new Map(previousData.map(d => [d.competitor.name, d]));
  const currByName = new Map(currentData.map(d => [d.competitor.name, d]));

  // Check for new competitors
  for (const [name] of currByName) {
    if (!prevByName.has(name)) {
      changes.push({
        competitor: name,
        details: [{ field: 'New Competitor', description: 'Added since last run' }],
      });
    }
  }

  // Check for removed competitors
  for (const [name] of prevByName) {
    if (!currByName.has(name)) {
      changes.push({
        competitor: name,
        details: [{ field: 'Removed', description: 'No longer in competitors list' }],
      });
    }
  }

  // Compare existing competitors
  for (const [name, curr] of currByName) {
    const prev = prevByName.get(name);
    if (!prev) continue;

    const details = [];

    // Website title change
    if (prev.website?.title && curr.website?.title && prev.website.title !== curr.website.title) {
      details.push({
        field: 'Website Title',
        description: `"${prev.website.title}" → "${curr.website.title}"`,
      });
    }

    // Meta description change
    if (prev.website?.metaDescription && curr.website?.metaDescription &&
        prev.website.metaDescription !== curr.website.metaDescription) {
      details.push({
        field: 'Meta Description',
        description: `Changed from "${prev.website.metaDescription.substring(0, 80)}..." to "${curr.website.metaDescription.substring(0, 80)}..."`,
      });
    }

    // Heading changes (compare h1s)
    const prevH1s = (prev.website?.headings || []).filter(h => h.tag === 'h1').map(h => h.text);
    const currH1s = (curr.website?.headings || []).filter(h => h.tag === 'h1').map(h => h.text);
    const newH1s = currH1s.filter(h => !prevH1s.includes(h));
    const removedH1s = prevH1s.filter(h => !currH1s.includes(h));
    if (newH1s.length > 0) {
      details.push({ field: 'New H1 Headings', description: newH1s.join(', ') });
    }
    if (removedH1s.length > 0) {
      details.push({ field: 'Removed H1 Headings', description: removedH1s.join(', ') });
    }

    // Ad activity changes
    if (prev.googleAds?.hasAds !== curr.googleAds?.hasAds) {
      details.push({
        field: 'Google Ads',
        description: curr.googleAds?.hasAds ? 'Started running ads' : 'Stopped running ads',
      });
    }

    if (details.length > 0) {
      changes.push({ competitor: name, details });
    }
  }

  return changes;
}
```

**Step 2: Commit**

```bash
git add src/changes.js
git commit -m "feat: add change detection module for run-over-run comparison"
```

---

### Task 5: Update Report Generators (remove AI analysis sections)

**Files:**
- Create: `src/report-md.js` (copy from v0, modify)
- Create: `src/report-pdf.js` (copy from v0, modify)
- Create: `templates/report.html` (copy from v0, modify)

**Step 1: Copy and modify report-md.js**

Copy from v0. Remove the AI analysis block (lines 22-26 in v0 which insert the `analysis` variable). The function signature keeps the `analysis` parameter for backwards compat but it's always null now.

Actually, simplify: remove the `analysis` parameter entirely. The function takes `(scrapedData, outputDir)`.

**Step 2: Copy and modify report-pdf.js**

Same treatment — remove `analysis` parameter, copy from v0.

**Step 3: Copy and modify templates/report.html**

Copy from v0. Remove the `{{#if analysis}}` block (lines 236-242 in v0).

**Step 4: Commit**

```bash
git add src/report-md.js src/report-pdf.js templates/report.html
git commit -m "feat: simplify report generators, remove inline AI analysis"
```

---

### Task 6: Update index.js (main orchestrator)

**Files:**
- Create: `src/index.js`

**Step 1: Write updated index.js**

Based on v0's index.js with these changes:
- Remove `analysis.js` import
- Add `changes.js` import
- Save `raw-data.json` after scraping
- Call `detectChanges()` before report generation
- Remove `analysis` parameter from report calls
- Update report function signatures

```js
import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';
import { CONFIG } from './config.js';
import { loadCompetitors } from './competitors.js';
import { scrapeWebsite } from './scrapers/website.js';
import { scrapeLinkedInAds } from './scrapers/linkedin-ads.js';
import { scrapeGoogleAds } from './scrapers/google-ads.js';
import { detectChanges } from './changes.js';
import { generateMarkdownReport } from './report-md.js';
import { generatePdfReport } from './report-pdf.js';

async function main() {
  // Guard: check if setup has been completed
  if (CONFIG.company.name === 'YOUR_COMPANY_NAME') {
    console.error('\n❌ Setup not complete!');
    console.error('Open this project in Claude Code and it will walk you through setup.');
    console.error('Or manually edit src/config.js and competitors.md\n');
    process.exit(1);
  }

  const startTime = Date.now();
  const date = new Date().toISOString().split('T')[0];

  console.log('='.repeat(60));
  console.log(`  Competitive Intelligence Agent`);
  console.log(`  ${CONFIG.company.name} — ${CONFIG.company.tagline}`);
  console.log(`  ${date}`);
  console.log('='.repeat(60));

  // 1. Load competitors
  const competitors = await loadCompetitors();
  console.log(`\nLoaded ${competitors.length} competitors:`);
  for (const c of competitors) {
    console.log(`  - ${c.name} (${c.domain})`);
  }

  // 2. Set up output directory
  const outputDir = path.join(CONFIG.outputDir, date);
  const screenshotDir = path.join(outputDir, 'screenshots');
  await fs.mkdir(screenshotDir, { recursive: true });

  // 3. Launch browser and scrape everything
  console.log('\nLaunching browser...');
  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext({
    userAgent: CONFIG.scraper.userAgent,
    viewport: { width: 1440, height: 900 },
  });

  const scrapedData = [];

  for (const competitor of competitors) {
    console.log(`\n--- ${competitor.name} ---`);

    const data = { competitor };

    const websitePage = await context.newPage();
    data.website = await scrapeWebsite(websitePage, competitor, screenshotDir);
    await websitePage.close();

    const linkedinPage = await context.newPage();
    data.linkedinAds = await scrapeLinkedInAds(linkedinPage, competitor, screenshotDir);
    await linkedinPage.close();

    const googlePage = await context.newPage();
    data.googleAds = await scrapeGoogleAds(googlePage, competitor, screenshotDir);
    await googlePage.close();

    scrapedData.push(data);
  }

  await browser.close();
  console.log('\nBrowser closed.');

  // 4. Save raw data as JSON
  const rawDataPath = path.join(outputDir, 'raw-data.json');
  await fs.writeFile(rawDataPath, JSON.stringify(scrapedData, null, 2), 'utf-8');
  console.log(`\n[data] Raw data saved: ${rawDataPath}`);

  // 5. Detect changes from previous run
  await detectChanges(scrapedData, outputDir);

  // 6. Generate reports
  console.log('\nGenerating reports...');
  const mdPath = await generateMarkdownReport(scrapedData, outputDir);
  const pdfPath = await generatePdfReport(scrapedData, outputDir);

  // 7. Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('  Done!');
  console.log(`  Time: ${elapsed}s`);
  console.log(`  Raw data: ${rawDataPath}`);
  console.log(`  Markdown: ${mdPath}`);
  console.log(`  PDF:      ${pdfPath}`);
  console.log(`  Screenshots: ${screenshotDir}`);
  console.log('='.repeat(60));
  console.log('\nOpen this folder in Claude Code for AI-powered analysis of your results.');
}

main().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
```

**Step 2: Commit**

```bash
git add src/index.js
git commit -m "feat: update orchestrator with raw data export and change detection"
```

---

### Task 7: CLAUDE.md (Setup Wizard + Usage Guide)

**Files:**
- Create: `CLAUDE.md`

**Step 1: Write CLAUDE.md**

This is the most important file. It must:
1. Display the fox mascot on first interaction
2. Detect setup state by checking config.js for placeholder values
3. Walk user through setup conversationally
4. After setup, guide scan execution and analysis

Full content — write the file with these sections:

- **Fox ASCII art** with instruction: "Display this fox when greeting the user for the first time"
- **Project Overview** — what CI Agent does, how it works
- **First-Run Setup** — detection logic: "Read src/config.js. If company.name is 'YOUR_COMPANY_NAME', run the setup wizard." Then step-by-step: ask company info, ask competitors one by one, write files, run npm install, run npx playwright install chromium
- **Running a Scan** — `node src/index.js`. After scan completes, read `output/<latest-date>/raw-data.json` and `output/<latest-date>/changes.md`, then provide a strategic competitive analysis conversationally
- **Managing Competitors** — explain competitors.md format, how to add/remove
- **Understanding Output** — what each file in output/ contains
- **Project Structure** — full file map
- **Extending** — how to add new scrapers, modify report templates

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "feat: add CLAUDE.md setup wizard and usage guide"
```

---

### Task 8: README.md

**Files:**
- Create: `README.md`

**Step 1: Write README.md**

Sections:
- **Title + one-line description**
- **What it does** — scrapes competitor websites + ad libraries, generates reports, Claude Code analyzes
- **Prerequisites** — Node.js LTS, Claude Code (desktop app or CLI)
- **Quick Start (Download ZIP)** — for non-GitHub users
- **Quick Start (Fork + Clone)** — for GitHub users
- **How it works** — diagram of the flow
- **Output** — what gets generated
- **Configuration** — config.js and competitors.md format
- **Contributing** — how to fork, add features, submit PRs
- **License** — MIT

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup instructions and contributing guide"
```

---

### Task 9: Verify & Test

**Step 1: Install dependencies**

```bash
cd D:/Claude/projects/ci-agent
npm install
npx playwright install chromium
```

**Step 2: Verify setup guard works**

```bash
node src/index.js
```

Expected: Error message saying setup not complete, exits with code 1.

**Step 3: Verify file structure**

```bash
ls -R src/ templates/
```

Expected: All files present, no analysis.js.

**Step 4: Commit any fixes**

If anything needed fixing, commit.

---

### Task 10: Git Init + Final Polish

**Step 1: Verify git log**

```bash
git log --oneline
```

Expected: Clean commit history telling the story of the project setup.

**Step 2: Verify .gitignore works**

```bash
git status
```

Expected: No output/ or node_modules/ tracked.

**Step 3: Final commit if needed**

Any remaining polish.

---

## Task Summary

| Task | What | Files |
|------|------|-------|
| 1 | Project scaffolding | package.json, .gitignore, LICENSE |
| 2 | Copy scrapers from v0 | src/scrapers/*, src/competitors.js |
| 3 | Templatize config | src/config.js, competitors.md |
| 4 | Change detection module | src/changes.js |
| 5 | Update report generators | src/report-md.js, src/report-pdf.js, templates/report.html |
| 6 | Update orchestrator | src/index.js |
| 7 | CLAUDE.md wizard | CLAUDE.md |
| 8 | README | README.md |
| 9 | Verify & test | — |
| 10 | Final polish | — |
