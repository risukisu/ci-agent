# Subpage Scraper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scrape competitor subpages (services, case studies, about) via nav/footer link discovery + sitemap.xml, giving Claude Code a complete picture of each competitor's commercial offering.

**Architecture:** New `src/scrapers/subpages.js` handles discovery (nav links + sitemap) and scraping. Services pages are always scraped (no cap). Other categories capped by `maxSubpages` config. Results stored as `data.subpages[]` in raw-data.json.

**Tech Stack:** Playwright (existing), Node.js URL/path APIs for link parsing

**Branch:** `feature/subpage-scraper` off `master`

---

### Task 1: Create feature branch

**Step 1: Branch off master**

```bash
cd D:/Claude/projects/ci-agent && git checkout -b feature/subpage-scraper
```

**Step 2: Verify**

```bash
git branch --show-current
```

Expected: `feature/subpage-scraper`

---

### Task 2: Add maxSubpages to config

**Files:**
- Modify: `src/config.js`

**Step 1: Add maxSubpages setting**

Add `maxSubpages: 10` to the `scraper` object in `src/config.js`, after the `screenshotDelay` line:

```js
  scraper: {
    timeout: 30_000,
    screenshotDelay: 3_000,
    maxSubpages: 10, // max non-service pages per competitor (services are always fully scraped)
    userAgent: 'Mozilla/5.0 ...',
  },
```

**Step 2: Commit**

```bash
git add src/config.js && git commit -m "feat: add maxSubpages config setting"
```

---

### Task 3: Create subpages scraper — discovery functions

**Files:**
- Create: `src/scrapers/subpages.js`

**Step 1: Write the discovery + scraping module**

This is the core new file. It exports one function: `scrapeSubpages(context, competitor, screenshotDir)` which:
1. Discovers links from homepage nav/footer
2. Fetches sitemap.xml for additional URLs
3. Categorizes all links
4. Scrapes services pages (no limit) + other pages (up to maxSubpages)
5. Returns array of subpage results

```js
import path from 'path';
import { CONFIG } from '../config.js';

// Category keywords — order matters for matching priority
const CATEGORY_PATTERNS = {
  services: /\b(services?|solutions?|capabilities|products?|offerings?|platform|what-we-do|our-work)\b/i,
  'case-studies': /\b(case.?stud|success.?stor|clients?|portfolio|our.?work|customer.?stor|testimonial)\b/i,
  about: /\b(about|team|leadership|company|who.?we.?are|careers?|jobs?|people|staff)\b/i,
};

/**
 * Discover and scrape competitor subpages.
 * Services pages are always scraped (no cap).
 * Other categories are capped by CONFIG.scraper.maxSubpages.
 */
export async function scrapeSubpages(context, competitor, screenshotDir) {
  console.log(`  [subpages] Discovering pages for ${competitor.name}...`);

  // 1. Discover links from homepage nav/footer
  const navLinks = await discoverNavLinks(context, competitor);

  // 2. Discover links from sitemap.xml
  const sitemapLinks = await discoverSitemapLinks(context, competitor);

  // 3. Merge and deduplicate
  const allLinks = mergeLinks(navLinks, sitemapLinks, competitor);
  console.log(`  [subpages] Found ${allLinks.length} candidate pages (${navLinks.length} from nav, ${sitemapLinks.length} from sitemap)`);

  // 4. Categorize
  const categorized = categorizeLinks(allLinks, competitor);
  const servicePages = categorized.filter(l => l.category === 'services');
  const otherPages = categorized.filter(l => l.category !== 'services');

  // 5. Select pages to scrape: all services + capped others
  const maxOther = CONFIG.scraper.maxSubpages || 10;
  const pagesToScrape = [
    ...servicePages,
    ...otherPages.slice(0, maxOther),
  ];

  console.log(`  [subpages] Scraping ${servicePages.length} service pages + ${Math.min(otherPages.length, maxOther)} other pages`);

  // 6. Scrape each page
  const results = [];
  for (const link of pagesToScrape) {
    const page = await context.newPage();
    const result = await scrapeSinglePage(page, link, competitor, screenshotDir);
    await page.close();
    if (result) results.push(result);
  }

  console.log(`  [subpages] ${competitor.name}: ${results.length} pages scraped`);
  return results;
}

/**
 * Extract internal links from homepage nav and footer elements.
 */
async function discoverNavLinks(context, competitor) {
  const page = await context.newPage();
  const links = [];

  try {
    await page.goto(competitor.url, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.scraper.timeout,
    });
    await page.waitForTimeout(2000);

    // Extract links from nav and footer
    const rawLinks = await page.$$eval('nav a[href], footer a[href], header a[href]', (anchors) =>
      anchors.map(a => ({
        url: a.href,
        text: a.textContent.trim().substring(0, 200),
      }))
    );

    const baseHost = new URL(competitor.url).hostname.replace(/^www\./, '');

    for (const link of rawLinks) {
      try {
        const url = new URL(link.url);
        const linkHost = url.hostname.replace(/^www\./, '');
        // Only internal links, skip anchors and homepage
        if (linkHost === baseHost && url.pathname !== '/' && url.pathname.length > 1 && !url.hash) {
          links.push({
            url: url.href,
            text: link.text,
            source: 'nav',
          });
        }
      } catch {
        // Skip invalid URLs
      }
    }
  } catch (err) {
    console.log(`  [subpages] Nav discovery failed for ${competitor.name}: ${err.message}`);
  } finally {
    await page.close();
  }

  return links;
}

/**
 * Fetch and parse sitemap.xml for additional URLs.
 */
async function discoverSitemapLinks(context, competitor) {
  const page = await context.newPage();
  const links = [];

  try {
    const sitemapUrl = new URL('/sitemap.xml', competitor.url).href;
    const response = await page.goto(sitemapUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });

    if (!response || response.status() !== 200) {
      console.log(`  [subpages] No sitemap.xml for ${competitor.name}`);
      return links;
    }

    // Parse XML content — extract all <loc> tags
    const urls = await page.$$eval('loc', (locs) =>
      locs.map(loc => loc.textContent.trim())
    );

    const baseHost = new URL(competitor.url).hostname.replace(/^www\./, '');

    for (const rawUrl of urls) {
      try {
        const url = new URL(rawUrl);
        const linkHost = url.hostname.replace(/^www\./, '');
        if (linkHost === baseHost && url.pathname !== '/' && url.pathname.length > 1) {
          links.push({
            url: url.href,
            text: '', // Sitemap URLs don't have anchor text
            source: 'sitemap',
          });
        }
      } catch {
        // Skip invalid URLs
      }
    }

    console.log(`  [subpages] Sitemap: ${links.length} URLs found for ${competitor.name}`);
  } catch (err) {
    console.log(`  [subpages] Sitemap fetch failed for ${competitor.name}: ${err.message}`);
  } finally {
    await page.close();
  }

  return links;
}

/**
 * Merge nav and sitemap links, deduplicate by normalized URL.
 */
function mergeLinks(navLinks, sitemapLinks, competitor) {
  const seen = new Set();
  const merged = [];

  // Nav links take priority (they have anchor text)
  for (const link of [...navLinks, ...sitemapLinks]) {
    const normalized = normalizeUrl(link.url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      merged.push(link);
    }
  }

  return merged;
}

/**
 * Normalize URL for deduplication — strip trailing slash, lowercase, remove query/hash.
 */
function normalizeUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    return `${url.hostname}${url.pathname}`.toLowerCase().replace(/\/+$/, '');
  } catch {
    return urlStr;
  }
}

/**
 * Categorize links by URL path and anchor text.
 */
function categorizeLinks(links, competitor) {
  return links.map(link => {
    const textToCheck = `${link.url} ${link.text}`;
    let category = 'other';

    // Check in priority order: services first
    for (const [cat, pattern] of Object.entries(CATEGORY_PATTERNS)) {
      if (pattern.test(textToCheck)) {
        category = cat;
        break;
      }
    }

    return { ...link, category };
  });
}

/**
 * Scrape a single subpage — same treatment as homepage.
 */
async function scrapeSinglePage(page, link, competitor, screenshotDir) {
  const result = {
    url: link.url,
    category: link.category,
    linkText: link.text,
    source: link.source,
    title: null,
    metaDescription: null,
    headings: [],
    bodyText: null,
    screenshot: null,
    error: null,
  };

  try {
    // Generate filename from URL path
    const urlPath = new URL(link.url).pathname.replace(/\//g, '-').replace(/^-|-$/g, '') || 'page';
    const screenshotName = `${competitor.domain}-${urlPath}.png`;

    await page.goto(link.url, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.scraper.timeout,
    });
    await page.waitForTimeout(CONFIG.scraper.screenshotDelay);

    result.title = await page.title();
    result.metaDescription = await page.$eval(
      'meta[name="description"]',
      (el) => el.content
    ).catch(() => null);

    result.headings = await page.$$eval('h1, h2, h3', (els) =>
      els.slice(0, 20).map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: el.textContent.trim().substring(0, 200),
      }))
    );

    result.bodyText = await page.$eval('body', (el) => {
      const clone = el.cloneNode(true);
      clone.querySelectorAll('script, style, nav, footer, header').forEach((e) => e.remove());
      return clone.textContent.replace(/\s+/g, ' ').trim().substring(0, 5000);
    });

    const screenshotPath = path.join(screenshotDir, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    result.screenshot = screenshotPath;

    console.log(`    [${link.category}] ${link.url} — done`);
  } catch (err) {
    result.error = err.message;
    console.log(`    [${link.category}] ${link.url} — failed: ${err.message}`);
  }

  return result;
}
```

**Step 2: Commit**

```bash
git add src/scrapers/subpages.js && git commit -m "feat: add subpage discovery and scraping module"
```

---

### Task 4: Integrate subpage scraper into index.js

**Files:**
- Modify: `src/index.js`

**Step 1: Add import**

Add after the google-ads import (line 8):
```js
import { scrapeSubpages } from './scrapers/subpages.js';
```

**Step 2: Add subpage scraping step**

After the google ads scraping block (after `await googlePage.close();` around line 71), add:

```js
    // Scrape subpages (services, case studies, about, etc.)
    data.subpages = await scrapeSubpages(context, competitor, screenshotDir);
```

**Step 3: Commit**

```bash
git add src/index.js && git commit -m "feat: integrate subpage scraper into main orchestrator"
```

---

### Task 5: Update Markdown report generator

**Files:**
- Modify: `src/report-md.js`

**Step 1: Add subpages section**

After the Google Ads section (after the `data.googleAds?.screenshot` block, before `md += '---\n\n';`), insert:

```js
    // Subpages
    if (data.subpages?.length) {
      // Group by category
      const byCategory = {};
      for (const sp of data.subpages) {
        if (!byCategory[sp.category]) byCategory[sp.category] = [];
        byCategory[sp.category].push(sp);
      }

      for (const [category, pages] of Object.entries(byCategory)) {
        const label = category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ');
        md += `### ${label} Pages (${pages.length})\n\n`;

        for (const sp of pages) {
          md += `#### ${sp.title || sp.url}\n\n`;
          md += `- **URL:** ${sp.url}\n`;
          if (sp.metaDescription) md += `- **Description:** ${sp.metaDescription}\n`;
          md += `\n`;

          if (sp.headings?.length) {
            md += `**Key Headings:**\n\n`;
            for (const h of sp.headings) {
              md += `- ${h.text}\n`;
            }
            md += `\n`;
          }

          if (sp.bodyText) {
            md += `<details>\n<summary>Page Text Excerpt</summary>\n\n`;
            md += `${sp.bodyText.substring(0, 3000)}\n\n`;
            md += `</details>\n\n`;
          }

          if (sp.screenshot) {
            const relPath = path.relative(outputDir, sp.screenshot).replace(/\\/g, '/');
            md += `![${sp.title || sp.url}](${relPath})\n\n`;
          }
        }
      }
    }
```

**Step 2: Commit**

```bash
git add src/report-md.js && git commit -m "feat: add subpages section to Markdown report"
```

---

### Task 6: Update PDF report generator and template

**Files:**
- Modify: `src/report-pdf.js`
- Modify: `templates/report.html`

**Step 1: Update report-pdf.js to embed subpage screenshots**

In the `enrichedData` mapping (inside the `scrapedData.map` callback), after the googleAds screenshot block, add:

```js
      // Subpage screenshots
      if (data.subpages?.length) {
        enriched.subpages = await Promise.all(
          data.subpages.map(async (sp) => ({
            ...sp,
            screenshotBase64: sp.screenshot ? await fileToBase64(sp.screenshot) : null,
          }))
        );
      }
```

**Step 2: Add subpages template block to report.html**

After the Google Ads `{{/if}}` block (before `</div>` closing the competitor-section, around line 307), add:

```html
    {{#if this.subpages.length}}
    <h3>Subpages Analyzed ({{this.subpages.length}})</h3>
    {{#each this.subpages}}
    <div class="info-card" style="margin-bottom: 10px;">
      <h4>{{this.category}} — {{this.title}}</h4>
      <p style="font-size: 10px; color: #666;">{{this.url}}</p>
      {{#if this.metaDescription}}<p>{{this.metaDescription}}</p>{{/if}}
      {{#if this.headings.length}}
      <ul>
        {{#each this.headings}}
        <li>{{this.text}}</li>
        {{/each}}
      </ul>
      {{/if}}
      {{#if this.screenshotBase64}}
      <div class="screenshot-container">
        <img src="data:image/png;base64,{{this.screenshotBase64}}" alt="{{this.title}}">
        <div class="screenshot-label">{{this.category}}: {{this.title}}</div>
      </div>
      {{/if}}
    </div>
    {{/each}}
    {{/if}}
```

**Step 3: Commit**

```bash
git add src/report-pdf.js templates/report.html && git commit -m "feat: add subpages section to PDF report"
```

---

### Task 7: Update change detection for subpages

**Files:**
- Modify: `src/changes.js`

**Step 1: Add subpage change detection**

In the `compareRuns` function, inside the "Compare existing competitors" loop (after the Google Ads change detection block, before `if (details.length > 0)`), add:

```js
    // Service page changes
    const prevServiceUrls = (prev.subpages || []).filter(s => s.category === 'services').map(s => s.url);
    const currServiceUrls = (curr.subpages || []).filter(s => s.category === 'services').map(s => s.url);
    const newServices = currServiceUrls.filter(u => !prevServiceUrls.includes(u));
    const removedServices = prevServiceUrls.filter(u => !currServiceUrls.includes(u));
    if (newServices.length > 0) {
      details.push({ field: 'New Service Pages', description: newServices.join(', ') });
    }
    if (removedServices.length > 0) {
      details.push({ field: 'Removed Service Pages', description: removedServices.join(', ') });
    }
```

**Step 2: Commit**

```bash
git add src/changes.js && git commit -m "feat: detect service page changes between runs"
```

---

### Task 8: Update CLAUDE.md and README.md

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

**Step 1: Update CLAUDE.md**

Add to the setup wizard flow (after step 3 "Ask for competitors", before step 4 "Write the config files"):

```markdown
3b. **Ask about scan depth:**
   - "How many extra pages (case studies, about, etc.) should I scan per competitor beyond their services? Default is 10. Services pages are always fully scanned regardless of this limit."
   - Update `scraper.maxSubpages` in `src/config.js` with their answer
```

Update the "What This Tool Does" list item 1 to:
```markdown
1. **Scrapes** competitor websites — homepage AND subpages (services, case studies, about) discovered from navigation and sitemap
```

Update the "Understanding Output" screenshots section to mention subpage screenshots:
```
      domain-website.png
      domain-services.png
      domain-case-studies.png
      ...
```

Update the "Project Structure" to include the new scraper:
```
      subpages.js    — Discovers and scrapes competitor subpages
```

**Step 2: Update README.md**

Update "What It Does" first bullet to:
```markdown
- **Website Scraping** — Captures competitor homepages and subpages (services, case studies, about) via nav link discovery and sitemap.xml parsing
```

Move "Subpage scraping" from the Roadmap to the "What It Does" section (it's implemented now).

**Step 3: Commit**

```bash
git add CLAUDE.md README.md && git commit -m "docs: update CLAUDE.md and README for subpage scraping"
```

---

### Task 9: Test end-to-end

**Step 1: Install dependencies (if needed)**

```bash
cd D:/Claude/projects/ci-agent && npm install
```

**Step 2: Verify setup guard still works with placeholder config**

Not applicable here since config is already populated from the test run. Instead verify the import chain:

```bash
node -e "import('./src/scrapers/subpages.js').then(m => console.log('Import OK:', typeof m.scrapeSubpages))"
```

Expected: `Import OK: function`

**Step 3: Run a scan**

```bash
node src/index.js
```

Watch for:
- `[subpages] Discovering pages for ...` messages
- `[subpages] Found N candidate pages (X from nav, Y from sitemap)`
- `[subpages] Scraping N service pages + M other pages`
- Per-page `[services]`, `[case-studies]`, `[about]` log lines
- No crashes

**Step 4: Verify output**

Check `output/YYYY-MM-DD/raw-data.json` has `subpages` array per competitor.

**Step 5: Fix any issues and commit**

```bash
git add -A && git commit -m "fix: address issues found during testing"
```

---

### Task 10: Push and create PR

**Step 1: Push feature branch**

```bash
git push -u origin feature/subpage-scraper
```

**Step 2: Create PR**

```bash
gh pr create --title "Add subpage scraper: services, case studies, about pages" --body "$(cat <<'EOF'
## Summary
- Discovers competitor subpages from nav/footer links + sitemap.xml
- Categorizes pages as services, case-studies, about, or other
- Services pages are ALWAYS fully scraped (no cap)
- Other pages capped by `maxSubpages` config (default 10)
- Each page gets same treatment as homepage: title, meta, headings, body text, screenshot
- Change detection tracks new/removed service pages between runs
- Reports include subpage data grouped by category

## Test plan
- [ ] Run scan with current competitors
- [ ] Verify subpages appear in raw-data.json
- [ ] Verify service pages are discovered for each competitor
- [ ] Verify sitemap.xml is checked (may not exist for all)
- [ ] Verify Markdown report shows subpage sections
- [ ] Verify PDF report shows subpage sections
- [ ] Verify change detection catches new service pages on re-run
EOF
)"
```

---

## Task Summary

| Task | What | Files |
|------|------|-------|
| 1 | Create feature branch | — |
| 2 | Add maxSubpages config | src/config.js |
| 3 | Create subpages scraper | src/scrapers/subpages.js |
| 4 | Integrate into orchestrator | src/index.js |
| 5 | Update Markdown report | src/report-md.js |
| 6 | Update PDF report + template | src/report-pdf.js, templates/report.html |
| 7 | Update change detection | src/changes.js |
| 8 | Update docs | CLAUDE.md, README.md |
| 9 | Test end-to-end | — |
| 10 | Push and create PR | — |
