import path from 'path';
import { CONFIG } from '../config.js';

/**
 * Screenshot Google Ads Transparency Center results for a competitor.
 */
export async function scrapeGoogleAds(page, competitor, screenshotDir) {
  const result = {
    competitor: competitor.name,
    platform: 'Google Ads Transparency',
    url: CONFIG.adLibraries.google(competitor.domain),
    screenshot: null,
    hasAds: null,
    error: null,
  };

  try {
    console.log(`  [google-ads] Searching ads for "${competitor.domain}"...`);
    await page.goto(result.url, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.scraper.timeout,
    });

    // Wait for dynamic content
    await page.waitForTimeout(CONFIG.scraper.screenshotDelay + 2000);

    // Check if "no ads" message is shown
    const pageText = await page.$eval('body', (el) => el.textContent).catch(() => '');
    if (pageText.includes('no ads') || pageText.includes('No ads')) {
      result.hasAds = false;
    } else {
      result.hasAds = true;
    }

    // Take screenshot
    const screenshotPath = path.join(screenshotDir, `${competitor.domain}-google-ads.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    result.screenshot = screenshotPath;
    console.log(`  [google-ads] ${competitor.name} done.`);
  } catch (err) {
    result.error = err.message;
    console.log(`  [google-ads] ${competitor.name} failed: ${err.message}`);
  }

  return result;
}
