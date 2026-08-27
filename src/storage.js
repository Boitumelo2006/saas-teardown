// src/storage.js
import fs from 'fs/promises';
import path from 'path';

/**
 * Normalizes a URL or site name into a clean, safe filename prefix.
 * e.g., "https://cal.com/pricing" -> "cal.com"
 */
export function sanitizeFilename(siteNameOrUrl) {
  let cleaned = siteNameOrUrl
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .toLowerCase();

  return cleaned || 'teardown';
}

/**
 * Saves analysis output as formatted JSON into the /output directory.
 * @param {string} siteNameOrUrl 
 * @param {object} analysisData 
 * @param {string} outputDir 
 * @returns {Promise<string>} The full path of the saved file.
 */
export async function saveAnalysisResult(siteNameOrUrl, analysisData, outputDir = './output') {
  const resolvedDir = path.resolve(outputDir);
  await fs.mkdir(resolvedDir, { recursive: true });

  const safeName = sanitizeFilename(siteNameOrUrl);
  const fileName = `${safeName}_teardown.json`;
  const filePath = path.join(resolvedDir, fileName);

  await fs.writeFile(filePath, JSON.stringify(analysisData, null, 2), 'utf-8');
  return filePath;
}