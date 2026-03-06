import fs from 'fs/promises';
import { CONFIG } from './config.js';

/**
 * Parse competitors.md and return structured list.
 * Expected format: `- Company Name | https://website.com/`
 */
export async function loadCompetitors() {
  const content = await fs.readFile(CONFIG.competitorsFile, 'utf-8');
  const competitors = [];

  for (const line of content.split('\n')) {
    const match = line.match(/^-\s+(.+?)\s*\|\s*(https?:\/\/.+?)\s*$/);
    if (match) {
      const name = match[1].trim();
      const url = match[2].trim();
      // Extract domain from URL (e.g., "cytel.com" from "https://cytel.com/")
      const domain = new URL(url).hostname.replace(/^www\./, '');
      competitors.push({ name, url, domain });
    }
  }

  if (competitors.length === 0) {
    throw new Error('No competitors found in competitors.md. Add entries in format: - Name | https://url.com/');
  }

  return competitors;
}
