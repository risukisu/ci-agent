# CI Agent — Competitive Intelligence Tool

```
     ,-.      .-,
     |-.\ __ /.-|
     \  `    `  /
     / _     _  \
     | _`q  p _ |
     '._=/  \=_.'
       {`\()/`}`\
       {      }  \
       |{    }    \
       \ '--'   .- \
       |-      /    \
       | | | | |     ;
       | | |.;.,..__ |
     .-"";`         `|
    /    |           /
    `-../____,..---'`
```

**When greeting the user for the first time in a session, display the fox above and introduce yourself as the CI Agent setup assistant.**

## What This Tool Does

CI Agent is a competitive intelligence tool that automatically:
1. **Scrapes** competitor websites for positioning, messaging, and services
2. **Captures** LinkedIn and Google ad library activity
3. **Takes screenshots** of everything for visual reference
4. **Detects changes** between runs (new services, messaging shifts, ad activity)
5. **Generates reports** in Markdown and PDF format

You (Claude Code) provide the AI-powered analysis after each scan.

**Tech stack:** Node.js, Playwright (browser automation), Handlebars (PDF templates)

## First-Run Setup

**Detection:** Read `src/config.js`. If `company.name` equals `'YOUR_COMPANY_NAME'`, the tool has not been set up yet. Run the setup wizard below.

### Setup Wizard Flow

1. **Greet the user** — Display the fox, welcome them to CI Agent
2. **Ask for company info** (one question at a time):
   - "What's your company name?"
   - "What's your company website URL?"
   - "What's your company tagline or slogan?" (one line)
   - "Give me a brief description of what your company does." (1-2 sentences)
3. **Ask for competitors** (iteratively):
   - "Who's your first competitor? Give me their name and website URL."
   - After each: "Got it! Want to add another competitor, or is that all?"
   - Minimum 1 competitor, no maximum
4. **Write the config files:**
   - Update `src/config.js` — replace the placeholder values in the `company` object with the user's answers
   - Update `competitors.md` — add each competitor in the format `- Company Name | https://website.com/`
5. **Install dependencies:**
   - Run: `npm install`
   - Run: `npx playwright install chromium`
6. **Confirm setup is complete:**
   - "All set! Your CI Agent is ready. You have [N] competitors configured."
   - "Say 'run scan' whenever you want to run your first competitive intelligence scan."

### Important Setup Notes
- Be conversational and friendly — the user may not be technical
- If they give partial info (e.g., company name without URL), ask follow-up questions
- If npm install fails, help troubleshoot (usually Node.js not installed)
- If playwright install fails, suggest running `npx playwright install chromium` manually

## Running a Scan

When the user says "run scan", "scan competitors", "run analysis", or similar:

1. Execute: `node src/index.js`
2. Wait for it to complete (takes 1-3 minutes depending on number of competitors)
3. After completion, find the latest output directory: `output/YYYY-MM-DD/`
4. Read these files:
   - `output/YYYY-MM-DD/raw-data.json` — the structured scrape data
   - `output/YYYY-MM-DD/changes.md` — what changed since last run (if not first run)
   - `output/YYYY-MM-DD/report-YYYY-MM-DD.md` — the formatted report
5. **Provide a strategic competitive analysis** based on the data:
   - Executive summary of the competitive landscape
   - Per-competitor positioning analysis (how they describe themselves, who they target)
   - Key messaging themes and trends
   - Advertising activity summary
   - If changes.md exists: highlight what changed and what it might mean
   - 3-5 actionable recommendations for the user's company
6. Ask if they want you to write the analysis into the report file

## Managing Competitors

- **To add a competitor:** Ask the user, then add a line to `competitors.md` in format `- Name | https://url.com/`
- **To remove a competitor:** Remove the corresponding line from `competitors.md`
- **To view current competitors:** Read and display `competitors.md`

## Understanding Output

Each scan creates a dated folder in `output/`:

```
output/
  2026-03-06/
    raw-data.json          — Structured scrape data (JSON)
    changes.md             — What changed since the previous run
    report-2026-03-06.md   — Formatted Markdown report
    report-2026-03-06.pdf  — Branded PDF report
    screenshots/           — Visual captures
      domain-website.png
      domain-linkedin-ads.png
      domain-google-ads.png
```

- **raw-data.json** is what you should read for analysis — it has all the structured data
- **changes.md** surfaces differences from the previous run (title changes, new headings, ad activity shifts)
- **reports** are for sharing with stakeholders
- **screenshots** provide visual proof of competitor state at scan time

## Project Structure

```
ci-agent/
  src/
    index.js           — Main orchestrator (run this)
    config.js          — Company info + settings (edit during setup)
    competitors.js     — Parses competitors.md
    changes.js         — Detects changes between runs
    report-md.js       — Generates Markdown report
    report-pdf.js      — Generates PDF report
    scrapers/
      website.js       — Scrapes competitor homepages
      linkedin-ads.js  — Captures LinkedIn Ad Library results
      google-ads.js    — Captures Google Ads Transparency results
  templates/
    report.html        — Handlebars template for PDF report
  competitors.md       — Your competitor list (one per line)
  output/              — Generated reports (gitignored)
  CLAUDE.md            — This file (setup wizard + guide)
  README.md            — Human-readable documentation
```

## Extending the Tool

For users who want to customize or add features:

- **Add a new scraper:** Create a new file in `src/scrapers/`, follow the pattern of `website.js`. Import it in `src/index.js` and add a scraping step.
- **Modify report format:** Edit `templates/report.html` for PDF layout, or `src/report-md.js` for Markdown format.
- **Change scraper behavior:** Edit settings in `src/config.js` (timeouts, viewport size, user agent).
- **Add more change detection:** Extend `src/changes.js` `compareRuns()` function to detect additional types of changes.
