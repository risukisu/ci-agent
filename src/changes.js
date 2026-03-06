import fs from 'fs/promises';
import path from 'path';
import { CONFIG } from './config.js';

/**
 * Compare current scrape data against the most recent previous run.
 * Writes changes.md to the current output directory.
 * Returns null on first run (no previous data).
 */
export async function detectChanges(currentData, outputDir) {
  const previousDir = await findPreviousRun(outputDir);

  if (!previousDir) {
    console.log('[changes] First run — no previous data to compare.');
    return null;
  }

  console.log(`[changes] Comparing against previous run: ${path.basename(previousDir)}`);

  const previousRawPath = path.join(previousDir, 'raw-data.json');
  let previousData;
  try {
    previousData = JSON.parse(await fs.readFile(previousRawPath, 'utf-8'));
  } catch {
    console.log('[changes] Could not read previous raw-data.json — skipping diff.');
    return null;
  }

  const changes = compareRuns(previousData, currentData);
  const changesPath = path.join(outputDir, 'changes.md');

  if (changes.length === 0) {
    const md = `# Changes Since Last Run\n\n_No significant changes detected since ${path.basename(previousDir)}._\n`;
    await fs.writeFile(changesPath, md, 'utf-8');
    console.log('[changes] No significant changes found.');
    return changesPath;
  }

  let md = `# Changes Since Last Run\n\n`;
  md += `**Comparing:** ${path.basename(previousDir)} → ${path.basename(outputDir)}\n\n`;

  for (const change of changes) {
    md += `## ${change.competitor}\n\n`;
    for (const detail of change.details) {
      md += `- **${detail.field}:** ${detail.description}\n`;
    }
    md += `\n`;
  }

  await fs.writeFile(changesPath, md, 'utf-8');
  console.log(`[changes] ${changes.length} competitor(s) with changes. Saved: ${changesPath}`);
  return changesPath;
}

/**
 * Find the most recent previous output directory.
 */
async function findPreviousRun(currentOutputDir) {
  const outputRoot = CONFIG.outputDir;
  const currentName = path.basename(currentOutputDir);

  let dirs;
  try {
    dirs = await fs.readdir(outputRoot);
  } catch {
    return null;
  }

  const previous = dirs
    .filter(d => /^\d{4}-\d{2}-\d{2}(_\d{2}-\d{2}-\d{2})?$/.test(d) && d !== currentName)
    .sort()
    .reverse();

  if (previous.length === 0) return null;
  return path.join(outputRoot, previous[0]);
}

/**
 * Compare two runs and return an array of changes per competitor.
 */
function compareRuns(previousData, currentData) {
  const changes = [];
  const prevByName = new Map(previousData.map(d => [d.competitor.name, d]));
  const currByName = new Map(currentData.map(d => [d.competitor.name, d]));

  // New competitors
  for (const [name] of currByName) {
    if (!prevByName.has(name)) {
      changes.push({
        competitor: name,
        details: [{ field: 'New Competitor', description: 'Added since last run' }],
      });
    }
  }

  // Removed competitors
  for (const [name] of prevByName) {
    if (!currByName.has(name)) {
      changes.push({
        competitor: name,
        details: [{ field: 'Removed', description: 'No longer in competitors list' }],
      });
    }
  }

  // Compare existing competitors
  for (const [name, curr] of currByName) {
    const prev = prevByName.get(name);
    if (!prev) continue;

    const details = [];

    // Website title change
    if (prev.website?.title && curr.website?.title && prev.website.title !== curr.website.title) {
      details.push({
        field: 'Website Title',
        description: `"${prev.website.title}" → "${curr.website.title}"`,
      });
    }

    // Meta description change
    if (prev.website?.metaDescription && curr.website?.metaDescription &&
        prev.website.metaDescription !== curr.website.metaDescription) {
      details.push({
        field: 'Meta Description',
        description: `Changed from "${prev.website.metaDescription.substring(0, 80)}..." to "${curr.website.metaDescription.substring(0, 80)}..."`,
      });
    }

    // Heading changes (h1s)
    const prevH1s = (prev.website?.headings || []).filter(h => h.tag === 'h1').map(h => h.text);
    const currH1s = (curr.website?.headings || []).filter(h => h.tag === 'h1').map(h => h.text);
    const newH1s = currH1s.filter(h => !prevH1s.includes(h));
    const removedH1s = prevH1s.filter(h => !currH1s.includes(h));
    if (newH1s.length > 0) {
      details.push({ field: 'New H1 Headings', description: newH1s.join(', ') });
    }
    if (removedH1s.length > 0) {
      details.push({ field: 'Removed H1 Headings', description: removedH1s.join(', ') });
    }

    // Ad activity changes
    if (prev.googleAds?.hasAds !== curr.googleAds?.hasAds) {
      details.push({
        field: 'Google Ads',
        description: curr.googleAds?.hasAds ? 'Started running ads' : 'Stopped running ads',
      });
    }

    if (details.length > 0) {
      changes.push({ competitor: name, details });
    }
  }

  return changes;
}
