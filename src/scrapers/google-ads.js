import path from 'path';
import { CONFIG } from '../config.js';

/**
 * Scrape Google Ads Transparency Center results for a competitor.
 * Scrolls through results and captures full-page screenshot.
 */
export async function scrapeGoogleAds(page, competitor, screenshotDir) {
  const result = {
    competitor: competitor.name,
    platform: 'Google Ads Transparency',
    url: CONFIG.adLibraries.google(competitor.domain),
    screenshot: null,
    hasAds: null,
    adCount: null,
    ads: [],
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

    const pageText = await page.$eval('body', (el) => el.textContent).catch(() => '');

    if (pageText.includes('no ads') || pageText.includes('No ads') || pageText.includes("didn't run any ads")) {
      result.hasAds = false;
      result.adCount = 0;
    } else {
      result.hasAds = true;

      // Scroll to load all ad results
      await autoScroll(page);

      // Try to extract ad count from page
      result.adCount = await page.$eval(
        '[class*="count"], [class*="result"]',
        (el) => {
          const match = el.textContent.match(/(\d[\d,]*)\s*(ads?|results?)/i);
          return match ? match[1].replace(/,/g, '') : el.textContent.trim();
        }
      ).catch(() => null);

      // Try to extract ad creative details
      result.ads = await page.$$eval(
        '[class*="creative"], [class*="ad-card"], [role="listitem"]',
        (cards) => cards.slice(0, 50).map(card => {
          const text = card.textContent?.trim()?.substring(0, 300) || '';
          const img = card.querySelector('img');
          const format = img ? 'display' : 'text';
          return { text, format };
        }).filter(ad => ad.text.length > 10)
      ).catch(() => []);
    }

    // Full-page screenshot
    const screenshotPath = path.join(screenshotDir, `${competitor.domain}-google-ads.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.screenshot = screenshotPath;
    console.log(`  [google-ads] ${competitor.name} done. hasAds=${result.hasAds}, count=${result.adCount}, extracted=${result.ads.length}`);
  } catch (err) {
    result.error = err.message;
    console.log(`  [google-ads] ${competitor.name} failed: ${err.message}`);
  }

  return result;
}

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
  await page.waitForTimeout(2000);
}
