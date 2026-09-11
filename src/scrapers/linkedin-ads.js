import path from 'path';
import { CONFIG } from '../config.js';

/**
 * Scrape LinkedIn Ad Library results for a competitor.
 * Scrolls through results and captures full-page screenshot.
 */
export async function scrapeLinkedInAds(page, competitor, screenshotDir) {
  const result = {
    competitor: competitor.name,
    platform: 'LinkedIn Ad Library',
    url: CONFIG.adLibraries.linkedin(competitor.name),
    screenshot: null,
    adCount: null,
    ads: [],
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

    // Check if sign-in is required
    const pageText = await page.$eval('body', (el) => el.textContent).catch(() => '');
    if (pageText.includes('Sign in') || pageText.includes('Join now')) {
      result.error = 'LinkedIn requires sign-in to view ad library results';
      console.log(`  [linkedin] ${competitor.name}: sign-in required`);
    } else {
      // Scroll through results to load all ads
      await autoScroll(page);

      // Try to get total ad count
      result.adCount = await page.$eval(
        '[class*="results"], [class*="count"], [aria-label*="result"]',
        (el) => el.textContent.trim()
      ).catch(() => null);

      // Try to extract individual ad cards
      result.ads = await page.$$eval(
        '[class*="ad-card"], [class*="feed-item"], [class*="result-item"], li[class*="ad"]',
        (cards) => cards.slice(0, 50).map(card => {
          const headline = card.querySelector('h3, [class*="headline"], [class*="title"]');
          const body = card.querySelector('p, [class*="body"], [class*="description"]');
          const sponsor = card.querySelector('[class*="sponsor"], [class*="advertiser"]');
          return {
            headline: headline?.textContent?.trim()?.substring(0, 200) || null,
            body: body?.textContent?.trim()?.substring(0, 300) || null,
            sponsor: sponsor?.textContent?.trim() || null,
          };
        }).filter(ad => ad.headline || ad.body)
      ).catch(() => []);
    }

    // Take full-page screenshot to capture all visible ads
    const screenshotPath = path.join(screenshotDir, `${competitor.domain}-linkedin-ads.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.screenshot = screenshotPath;
    console.log(`  [linkedin] ${competitor.name} done. ${result.ads.length} ads extracted.`);
  } catch (err) {
    result.error = err.message;
    console.log(`  [linkedin] ${competitor.name} failed: ${err.message}`);
  }

  return result;
}

/**
 * Scroll to the bottom of the page incrementally to trigger lazy loading.
 */
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 500;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight || totalHeight > 10000) {
          clearInterval(timer);
          resolve();
        }
      }, 300);
    });
  });
  // Wait for any lazy-loaded content
  await page.waitForTimeout(2000);
}
