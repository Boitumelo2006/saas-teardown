// src/cache.js
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DEFAULT_CACHE_DIR = path.join(process.cwd(), '.cache');
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generates a consistent MD5 hash key for a target URL.
 */
function getCacheKey(url) {
  const normalizedUrl = url.trim().toLowerCase().replace(/\/+$/, '');
  return crypto.createHash('md5').update(normalizedUrl).digest('hex');
}

/**
 * Retrieves cached data if it exists and is within the TTL limit.
 */
export async function getCachedAnalysis(url, ttlMs = DEFAULT_TTL_MS, cacheDir = DEFAULT_CACHE_DIR) {
  const key = getCacheKey(url);
  const filePath = path.join(cacheDir, `${key}.json`);

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const cachedEntry = JSON.parse(raw);

    const age = Date.now() - cachedEntry.timestamp;
    if (age <= ttlMs) {
      return {
        hit: true,
        data: cachedEntry.data,
        ageMs: age,
        cachedAt: new Date(cachedEntry.timestamp).toISOString(),
      };
    }
  } catch (err) {
    // Cache miss or missing file
  }

  return { hit: false };
}

/**
 * Stores teardown analysis output to local cache with a timestamp.
 */
export async function setCachedAnalysis(url, data, cacheDir = DEFAULT_CACHE_DIR) {
  const key = getCacheKey(url);
  await fs.mkdir(cacheDir, { recursive: true });

  const filePath = path.join(cacheDir, `${key}.json`);
  const payload = {
    url,
    timestamp: Date.now(),
    data,
  };

  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}