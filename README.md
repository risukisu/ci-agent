# CI Agent — Competitive Intelligence Tool

![CANDOR: copilot](https://img.shields.io/badge/䷼%20CANDOR-copilot-fee2e2?labelColor=fee2e2)

Monitor your competitors automatically. CI Agent scrapes competitor websites and ad libraries, captures screenshots, detects changes over time, and generates reports — all powered by Claude Code for AI analysis.

## What It Does

- **Website Scraping** — Captures competitor homepages: titles, meta descriptions, key headings, body text, and full screenshots
- **Ad Library Monitoring** — Checks LinkedIn Ad Library and Google Ads Transparency Center for each competitor
- **Change Detection** — Compares each scan against the previous run to surface changes (new messaging, updated services, ad activity shifts)
- **Report Generation** — Produces Markdown and branded PDF reports with all captured data
- **AI Analysis** — Claude Code reads the raw data and provides strategic competitive insights conversationally

## Prerequisites

1. **Node.js** (LTS version) — [Download here](https://nodejs.org/)
2. **Claude Code** — Desktop app ([download](https://claude.ai/download)) or CLI (`npm install -g @anthropic-ai/claude-code`)

That's it. No API keys needed.

## Quick Start

### Option A: Download ZIP (no GitHub account needed)

1. Click the green **Code** button above, then **Download ZIP**
2. Extract the ZIP to a folder on your computer
3. Open the folder in Claude Code (desktop app or `claude` in terminal)
4. Say **"hi"** — Claude will detect it's a fresh install and start the setup wizard

### Option B: Fork + Clone (recommended for GitHub users)

1. Click **Fork** to create your own copy of this repo
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ci-agent.git
   cd ci-agent
   ```
3. Open in Claude Code (desktop app or `claude` in terminal)
4. Say **"hi"** — Claude will start the setup wizard

### What Setup Looks Like

A friendly fox will greet you and ask a few questions:
- Your company name, website, and tagline
- Your competitors (name + website URL for each)

Then it installs dependencies and you're ready to scan.

## Running a Scan

Just tell Claude: **"run scan"**

Or run manually:
```bash
node src/index.js
```

Each scan takes 1-3 minutes and creates a dated folder in `output/`:

```
output/2026-03-06/
  raw-data.json        — Structured scrape data
  changes.md           — What changed since last run
  report-2026-03-06.md — Markdown report
  report-2026-03-06.pdf— Branded PDF report
  screenshots/         — Visual captures of each competitor
```

After the scan, Claude reads the results and provides strategic analysis — competitor positioning, messaging trends, ad activity, and actionable recommendations.

## How It Works

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ Playwright   │───>│ Raw Data     │───>│ Claude Code │
│ scrapes      │    │ + Reports    │    │ analyzes    │
│ competitors  │    │ + Changes    │    │ results     │
└─────────────┘    └──────────────┘    └─────────────┘
```

1. **Playwright** (headless browser) visits each competitor's website, LinkedIn Ad Library page, and Google Ads Transparency page
2. **Data & reports** are saved locally — structured JSON, Markdown, PDF, and screenshots
3. **Claude Code** reads the output and provides AI-powered competitive analysis

No data leaves your machine except the browser requests to competitor websites.

## Configuration

### Company Info
Edit `src/config.js` to update your company details (or ask Claude to do it).

### Competitors
Edit `competitors.md` to add or remove competitors:
```
- Company Name | https://website.com/
- Another Corp | https://anothercorp.com/
```

## Roadmap

Currently CI Agent scans **competitor homepages + ad libraries**. Future releases will expand the scope:

- **Subpage scraping** — Services pages, case studies, pricing pages, about/team pages
- **Social media monitoring** — LinkedIn company pages, Twitter/X, Facebook (where available)
- **SEO data** — Keywords, domain authority, backlink profiles
- **Job postings** — Track hiring signals (what roles competitors are filling)
- **Review sites** — G2, Capterra, Trustpilot ratings and review trends
- **Tech stack detection** — What tools and platforms competitors are using

Each of these will be added as individual PRs. Contributions welcome!

## Contributing

This is an open-source marketing tool built for the Claude Code community.

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT — see [LICENSE](LICENSE) for details.

---

Built with [Claude Code](https://claude.ai/code) as copilot. [CANDOR: copilot](https://candor.md) — AI writes the code, I make the decisions.
