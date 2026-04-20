import path from 'path';
import { CONFIG } from '../config.js';

const CATEGORY_PATTERNS = {
  services: /\b(services?|solutions?|capabilities|products?|offerings?|platform|what-we-do|our-work)\b/i,
  'case-studies': /\b(case.?stud|success.?stor|clients?|portfolio|our.?work|customer.?stor|testimonial)\b/i,
  about: /\b(about|team|leadership|company|who.?we.?are|careers?|jobs?|people|staff)\b/i,
};

/**
 * Discover and scrape competitor subpages.
 * Services pages are always scraped (no cap).
 * Other categories are capped by CONFIG.scraper.maxSubpages.
 */
export async function scrapeSubpages(context, competitor, screenshotDir) {
  console.log(`  [subpages] Discovering pages for ${competitor.name}...`);

  const navLinks = await discoverNavLinks(context, competitor);
  const sitemapLinks = await discoverSitemapLinks(context, competitor);

  const allLinks = mergeLinks(navLinks, sitemapLinks);
  console.log(`  [subpages] Found ${allLinks.length} candidate pages (${navLinks.length} from nav, ${sitemapLinks.length} from sitemap)`);

  const categorized = categorizeLinks(allLinks);
  const servicePages = categorized.filter(l => l.category === 'services');
  const otherPages = categorized.filter(l => l.category !== 'services');

  const maxOther = CONFIG.scraper.maxSubpages || 10;
  const pagesToScrape = [
    ...servicePages,
    ...otherPages.slice(0, maxOther),
  ];

  console.log(`  [subpages] Scraping ${servicePages.length} service pages + ${Math.min(otherPages.length, maxOther)} other pages`);

  const results = [];
  for (const link of pagesToScrape) {
    const page = await context.newPage();
    const result = await scrapeSinglePage(page, link, competitor, screenshotDir);
    await page.close();
    if (result) results.push(result);
  }

  console.log(`  [subpages] ${competitor.name}: ${results.length} pages scraped`);
  return results;
}

/**
 * Extract internal links from homepage nav and footer elements.
 */
async function discoverNavLinks(context, competitor) {
  const page = await context.newPage();
  const links = [];

  try {
    await page.goto(competitor.url, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.scraper.timeout,
    });
    await page.waitForTimeout(2000);

    const rawLinks = await page.$$eval('nav a[href], footer a[href], header a[href]', (anchors) =>
      anchors.map(a => ({
        url: a.href,
        text: a.textContent.trim().substring(0, 200),
      }))
    );

    const baseHost = new URL(competitor.url).hostname.replace(/^www\./, '');

    for (const link of rawLinks) {
      try {
        const url = new URL(link.url);
        const linkHost = url.hostname.replace(/^www\./, '');
        if (linkHost === baseHost && url.pathname !== '/' && url.pathname.length > 1 && !url.hash) {
          links.push({
            url: url.href,
            text: link.text,
            source: 'nav',
          });
        }
      } catch {
        // Skip invalid URLs
      }
    }
  } catch (err) {
    console.log(`  [subpages] Nav discovery failed for ${competitor.name}: ${err.message}`);
  } finally {
    await page.close();
  }

  return links;
}

/**
 * Fetch and parse sitemap.xml for additional URLs.
 */
async function discoverSitemapLinks(context, competitor) {
  const page = await context.newPage();
  const links = [];

  try {
    const sitemapUrl = new URL('/sitemap.xml', competitor.url).href;
    const response = await page.goto(sitemapUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });

    if (!response || response.status() !== 200) {
      console.log(`  [subpages] No sitemap.xml for ${competitor.name}`);
      return links;
    }

    const urls = await page.$$eval('loc', (locs) =>
      locs.map(loc => loc.textContent.trim())
    );

    const baseHost = new URL(competitor.url).hostname.replace(/^www\./, '');

    for (const rawUrl of urls) {
      try {
        const url = new URL(rawUrl);
        const linkHost = url.hostname.replace(/^www\./, '');
        if (linkHost === baseHost && url.pathname !== '/' && url.pathname.length > 1) {
          links.push({
            url: url.href,
            text: '',
            source: 'sitemap',
          });
        }
      } catch {
        // Skip invalid URLs
      }
    }

    console.log(`  [subpages] Sitemap: ${links.length} URLs found for ${competitor.name}`);
  } catch (err) {
    console.log(`  [subpages] Sitemap fetch failed for ${competitor.name}: ${err.message}`);
  } finally {
    await page.close();
  }

  return links;
}

/**
 * Merge nav and sitemap links, deduplicate by normalized URL.
 */
function mergeLinks(navLinks, sitemapLinks) {
  const seen = new Set();
  const merged = [];

  for (const link of [...navLinks, ...sitemapLinks]) {
    const normalized = normalizeUrl(link.url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      merged.push(link);
    }
  }

  return merged;
}

function normalizeUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    return `${url.hostname}${url.pathname}`.toLowerCase().replace(/\/+$/, '');
  } catch {
    return urlStr;
  }
}

/**
 * Categorize links by URL path and anchor text.
 */
function categorizeLinks(links) {
  return links.map(link => {
    const textToCheck = `${link.url} ${link.text}`;
    let category = 'other';

    for (const [cat, pattern] of Object.entries(CATEGORY_PATTERNS)) {
      if (pattern.test(textToCheck)) {
        category = cat;
        break;
      }
    }

    return { ...link, category };
  });
}

/**
 * Scrape a single subpage — same treatment as homepage.
 */
async function scrapeSinglePage(page, link, competitor, screenshotDir) {
  const result = {
    url: link.url,
    category: link.category,
    linkText: link.text,
    source: link.source,
    title: null,
    metaDescription: null,
    headings: [],
    bodyText: null,
    screenshot: null,
    error: null,
  };

  try {
    const urlPath = new URL(link.url).pathname.replace(/\//g, '-').replace(/^-|-$/g, '') || 'page';
    const screenshotName = `${competitor.domain}-${urlPath}.png`;

    await page.goto(link.url, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.scraper.timeout,
    });
    await page.waitForTimeout(CONFIG.scraper.screenshotDelay);

    result.title = await page.title();
    result.metaDescription = await page.$eval(
      'meta[name="description"]',
      (el) => el.content
    ).catch(() => null);

    result.headings = await page.$$eval('h1, h2, h3', (els) =>
      els.slice(0, 20).map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: el.textContent.trim().substring(0, 200),
      }))
    );

    result.bodyText = await page.$eval('body', (el) => {
      const clone = el.cloneNode(true);
      clone.querySelectorAll('script, style, nav, footer, header').forEach((e) => e.remove());
      return clone.textContent.replace(/\s+/g, ' ').trim().substring(0, 5000);
    });

    const screenshotPath = path.join(screenshotDir, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    result.screenshot = screenshotPath;

    console.log(`    [${link.category}] ${link.url} — done`);
  } catch (err) {
    result.error = err.message;
    console.log(`    [${link.category}] ${link.url} — failed: ${err.message}`);
  }

  return result;
}
