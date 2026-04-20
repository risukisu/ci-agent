import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const CONFIG = {
  root: ROOT,
  competitorsFile: path.join(ROOT, 'competitors.md'),
  outputDir: path.join(ROOT, 'output'),
  templatesDir: path.join(ROOT, 'templates'),

  // Your company info (filled in during setup)
  company: {
    name: 'Appsilon',
    url: 'https://appsilon.com',
    tagline: 'Open Source, Done Right for Pharma',
    description: 'We are a technology partner for life sciences companies, delivering open-source AI, R and Python solutions, cloud-based statistical computing environments, and SAS-to-Open Source migration to accelerate drug development in regulated settings.',
  },

  // Scraper settings
  scraper: {
    timeout: 30_000,
    screenshotDelay: 3_000,
    maxSubpages: 10, // max non-service pages per competitor (services are always fully scraped)
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  },

  // Ad library URL patterns
  adLibraries: {
    linkedin: (name) => `https://www.linkedin.com/ad-library/search?accountOwner=${encodeURIComponent(name)}`,
    google: (domain) => `https://adstransparency.google.com/?region=anywhere&domain=${encodeURIComponent(domain)}`,
  },
};
