import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';
import { chromium } from 'playwright';
import { CONFIG } from './config.js';

/**
 * Generate a branded PDF report from scraped data using HTML template + Playwright.
 */
export async function generatePdfReport(scrapedData, outputDir) {
  const date = new Date().toISOString().split('T')[0];
  const filename = `report-${date}.pdf`;
  const filepath = path.join(outputDir, filename);

  // Load and compile HTML template
  const templatePath = path.join(CONFIG.templatesDir, 'report.html');
  const templateSource = await fs.readFile(templatePath, 'utf-8');
  const template = Handlebars.compile(templateSource);

  // Embed screenshots as base64 for the PDF
  const enrichedData = await Promise.all(
    scrapedData.map(async (data) => {
      const enriched = { ...data };

      // Convert screenshot files to base64 for embedding in HTML
      if (data.website?.screenshot) {
        enriched.website = {
          ...data.website,
          screenshotBase64: await fileToBase64(data.website.screenshot),
        };
      }
      if (data.linkedinAds?.screenshot) {
        enriched.linkedinAds = {
          ...data.linkedinAds,
          screenshotBase64: await fileToBase64(data.linkedinAds.screenshot),
        };
      }
      if (data.googleAds?.screenshot) {
        enriched.googleAds = {
          ...data.googleAds,
          screenshotBase64: await fileToBase64(data.googleAds.screenshot),
        };
      }

      return enriched;
    })
  );

  // Render HTML
  const html = template({
    company: CONFIG.company,
    date,
    competitorCount: scrapedData.length,
    competitors: enrichedData,
  });

  // Convert HTML to PDF using Playwright
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({
    path: filepath,
    format: 'A4',
    printBackground: true,
    margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
  });
  await browser.close();

  console.log(`[report] PDF report saved: ${filepath}`);
  return filepath;
}

async function fileToBase64(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    return buffer.toString('base64');
  } catch {
    return null;
  }
}
