import path from 'path';
import { CONFIG } from '../config.js';

/**
 * Scrape a competitor's website for positioning, services, and messaging.
 * Takes a screenshot of the homepage.
 */
export async function scrapeWebsite(page, competitor, screenshotDir) {
  const result = {
    competitor: competitor.name,
    url: competitor.url,
    screenshot: null,
    title: null,
    metaDescription: null,
    headings: [],
    bodyText: null,
    error: null,
  };

  try {
    console.log(`  [website] Navigating to ${competitor.url}...`);
    await page.goto(competitor.url, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.scraper.timeout,
    });

    // Wait a bit for dynamic content
    await page.waitForTimeout(CONFIG.scraper.screenshotDelay);

    // Extract page metadata
    result.title = await page.title();
    result.metaDescription = await page.$eval(
      'meta[name="description"]',
      (el) => el.content
    ).catch(() => null);

    // Extract all headings (h1-h3) for positioning signals
    result.headings = await page.$$eval('h1, h2, h3', (els) =>
      els.slice(0, 20).map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: el.textContent.trim().substring(0, 200),
      }))
    );

    // Extract body text (limited to avoid huge payloads)
    result.bodyText = await page.$eval('body', (el) => {
      // Remove scripts, styles, nav, footer for cleaner text
      const clone = el.cloneNode(true);
      clone.querySelectorAll('script, style, nav, footer, header').forEach((e) => e.remove());
      return clone.textContent.replace(/\s+/g, ' ').trim().substring(0, 5000);
    });

    // Take full-page screenshot
    const screenshotPath = path.join(screenshotDir, `${competitor.domain}-website.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    result.screenshot = screenshotPath;
    console.log(`  [website] ${competitor.name} done.`);
  } catch (err) {
    result.error = err.message;
    console.log(`  [website] ${competitor.name} failed: ${err.message}`);
  }

  return result;
}
