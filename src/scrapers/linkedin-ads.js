import path from 'path';
import { CONFIG } from '../config.js';

/**
 * Screenshot LinkedIn Ad Library results for a competitor.
 * LinkedIn may block automated access — handles gracefully.
 */
export async function scrapeLinkedInAds(page, competitor, screenshotDir) {
  const result = {
    competitor: competitor.name,
    platform: 'LinkedIn Ad Library',
    url: CONFIG.adLibraries.linkedin(competitor.name),
    screenshot: null,
    adCount: null,
    error: null,
  };

  try {
    console.log(`  [linkedin] Searching ads for "${competitor.name}"...`);
    await page.goto(result.url, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.scraper.timeout,
    });

    // Wait for content to render
    await page.waitForTimeout(CONFIG.scraper.screenshotDelay + 2000);

    // Try to detect if we're blocked or need auth
    const pageText = await page.$eval('body', (el) => el.textContent).catch(() => '');
    if (pageText.includes('Sign in') || pageText.includes('Join now')) {
      result.error = 'LinkedIn requires sign-in to view ad library results';
      console.log(`  [linkedin] ${competitor.name}: sign-in required`);
    }

    // Try to get ad count from the page
    result.adCount = await page.$eval(
      '[class*="results"], [class*="count"], [aria-label*="result"]',
      (el) => el.textContent.trim()
    ).catch(() => null);

    // Screenshot regardless (shows either results or the sign-in prompt)
    const screenshotPath = path.join(screenshotDir, `${competitor.domain}-linkedin-ads.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    result.screenshot = screenshotPath;
    console.log(`  [linkedin] ${competitor.name} done.`);
  } catch (err) {
    result.error = err.message;
    console.log(`  [linkedin] ${competitor.name} failed: ${err.message}`);
  }

  return result;
}
