# CI Agent — Open Source Redesign

**Date:** 2026-03-06
**Status:** Approved
**Goal:** Transform CI Agent from an internal Appsilon tool into a public open-source competitive intelligence tool for marketers using Claude Code.

## Target User

Claude Code marketers — people who use Claude Code (desktop app or CLI) and want to monitor competitors. Technical enough to install Node.js and clone a repo, but not developers. They may or may not have a GitHub account.

## Key Design Decisions

1. **Claude Code is the AI layer** — no separate API key needed. The tool scrapes and captures data; Claude Code analyzes it conversationally after each run.
2. **CLAUDE.md is the setup wizard** — detects first-run state (placeholder values in config.js), walks user through setup conversationally.
3. **Change detection between runs** — each run saves structured JSON; a diff module compares against the previous run to surface changes (new services, updated messaging, ad activity shifts).
4. **Two install paths** — Download ZIP (basic) or Fork+Clone (advanced, GitHub-backed). Same tool, same experience, different backup story.
5. **Fox mascot** — ASCII fox greets users during setup.

## Architecture

### What runs (Node.js)
- Playwright scrapes competitor websites, LinkedIn Ad Library, Google Ads Transparency
- Takes screenshots of each
- Saves structured data as raw-data.json
- Generates Markdown + PDF reports with raw data
- Compares against previous run, writes changes.md

### What Claude Code does (conversation)
- First-run setup wizard (reads CLAUDE.md, detects placeholders)
- Post-scan analysis (reads raw-data.json + changes.md, provides strategic briefing)
- Ongoing interaction (add competitors, explain data, suggest actions)

### Output per run
```
output/
  YYYY-MM-DD/
    raw-data.json
    changes.md
    report-YYYY-MM-DD.md
    report-YYYY-MM-DD.pdf
    screenshots/
      domain-website.png
      domain-linkedin-ads.png
      domain-google-ads.png
```

## File Plan

### From v0 (copy + modify)
| File | Changes |
|------|---------|
| src/index.js | Remove analysis import, add raw-data.json save, call changes module |
| src/config.js | Replace company data with placeholders |
| src/competitors.js | No changes |
| src/report-md.js | Remove AI analysis section (raw data only) |
| src/report-pdf.js | Remove AI analysis section |
| src/scrapers/website.js | No changes |
| src/scrapers/linkedin-ads.js | No changes |
| src/scrapers/google-ads.js | No changes |
| templates/report.html | Remove analysis section from template |
| package.json | Remove @anthropic-ai/sdk dependency, update metadata |

### New files
| File | Purpose |
|------|---------|
| src/changes.js | Diff current vs previous run, output changes.md |
| CLAUDE.md | Setup wizard + usage guide + project context |
| README.md | Human-facing docs for GitHub |
| .gitignore | output/, node_modules/, .env |
| LICENSE | MIT |

### Deleted (not carried from v0)
| File | Reason |
|------|--------|
| src/analysis.js | Replaced by Claude Code conversation |
| output/ | Real data, not included |
| node_modules/ | Users install fresh |

## CLAUDE.md Structure

1. Fox mascot ASCII art + greeting
2. Project overview (what it does, tech stack)
3. First-run setup detection + conversational wizard
4. Running a scan + post-scan analysis instructions
5. Managing competitors
6. Understanding output + change detection
7. Project structure map
8. Extending the tool

## Prerequisites for Users

1. Node.js (LTS)
2. Claude Code (desktop app or CLI)
3. That's it
