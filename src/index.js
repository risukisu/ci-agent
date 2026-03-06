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
