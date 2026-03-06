# Subpage Scraper Design

**Date:** 2026-03-06
**Status:** Approved
**Goal:** Scrape competitor subpages (services, case studies, about) to provide complete picture of commercial offerings for analysis.
**PR:** Feature branch → master

## Discovery Strategy

Two-source discovery: nav/footer link extraction (primary) + sitemap.xml parsing (supplementary).

### Link Discovery
1. Parse homepage nav and footer — extract all internal links
2. Categorize by keyword matching:
   - **services** (services, solutions, capabilities, products, offerings, platform) → ALWAYS scraped, no cap
   - **case-studies** (case-study, case-studies, success-stories, clients, portfolio, work)
   - **about** (about, team, leadership, company, who-we-are)
   - **other** (blog, careers, resources, etc.)
3. Fetch `/sitemap.xml` — if available, add URLs not already discovered, categorize same way
4. Deduplicate

### Scraping Priority
1. All `services` pages — always, no limit
2. Remaining categories — up to `maxSubpages` config setting (default 10), prioritizing case-studies → about → other

### Per-Page Capture
- URL and category tag
- Title, meta description
- Headings (h1-h3, up to 20)
- Body text excerpt (5,000 chars, stripped of nav/footer/scripts)
- Screenshot (viewport)

## Data Shape

```json
{
  "competitor": { "name": "A2-AI", ... },
  "website": { ... },
  "subpages": [
    {
      "url": "https://a2-ai.com/capabilities",
      "category": "services",
      "title": "Capabilities — A2-AI",
      "metaDescription": "...",
      "headings": [...],
      "bodyText": "...",
      "screenshot": "screenshots/a2-ai.com-capabilities.png"
    }
  ],
  "linkedinAds": { ... },
  "googleAds": { ... }
}
```

## Files Changed

| File | Change |
|------|--------|
| `src/scrapers/subpages.js` | **New** — discovery + categorization + scraping |
| `src/config.js` | Add `scraper.maxSubpages: 10` |
| `src/index.js` | Call subpage scraper after homepage, attach to `data.subpages` |
| `src/report-md.js` | Add subpages section per competitor |
| `src/report-pdf.js` | Add subpages section |
| `templates/report.html` | Add subpages template block |
| `src/changes.js` | Detect new/removed service pages between runs |
| `CLAUDE.md` | Add maxSubpages to setup wizard, document subpage scanning |
| `README.md` | Update features to mention subpage scraping |

## Setup Wizard Addition

After competitors are configured, ask:
> "How many extra pages (case studies, about, etc.) should I scan per competitor beyond their services? Default is 10. Services pages are always fully scanned regardless of this limit."
