import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import 'dotenv/config';

import { crawlWebsite } from './crawler.js';
import { matchFingerprints } from './fingerprints.js';
import { analyzeSiteData } from './analyzer.js';
import { saveAnalysisResult } from './storage.js';
import { getCachedAnalysis, setCachedAnalysis } from './cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

/**
 * Runs the full teardown pipeline for a single target site with 24-hour caching.
 */
export async function teardownSite(site, options = {}) {
  const outputDir = options.outdir || path.join(projectRoot, 'outputs');
  await fs.mkdir(outputDir, { recursive: true });

  console.log(`\n=====================================================`);
  console.log(`🔎 Analyzing ${site.name}: ${site.url}`);
  console.log(`=====================================================`);

  // Check 24h cache unless force bypass is requested
  if (!options.force) {
    const cache = await getCachedAnalysis(site.url);
    if (cache.hit) {
      const hoursAgo = (cache.ageMs / (1000 * 60 * 60)).toFixed(1);
      console.log(`⚡ Cache HIT (Analyzed ${hoursAgo} hours ago)`);
      
      const reportPath = await saveAnalysisResult(site.name, cache.data, outputDir);
      console.log(`💾 Restored Report to: ${reportPath}\n`);
      return cache.data;
    }
  }

  // 1. Crawl Target Site
  const result = await crawlWebsite(site.url);
  if (!result.success) {
    console.log(`❌ Crawl Failed: ${result.error}\n`);
    return null;
  }

  // 2. Match Tech Stack Fingerprints
  const detected = matchFingerprints(result.rawEvidence);

  const rawOutput = {
    site,
    crawl: { success: result.success, latencyMs: result.latencyMs },
    detectedTechnologies: detected,
    rawEvidence: result.rawEvidence,
  };

  // Save Raw Scraping Payload
  const safeName = site.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const rawPath = path.join(outputDir, `${safeName}-raw.json`);
  await fs.writeFile(rawPath, JSON.stringify(rawOutput, null, 2), 'utf-8');

  console.log(`✅ Crawled in ${(result.latencyMs / 1000).toFixed(1)}s`);
  console.log(`🛠️ Tech Stack: ${detected.map((t) => t.technology).join(', ') || 'None'}`);

  // 3. Run Gemini Synthesis
  if (!process.env.GEMINI_API_KEY) {
    console.log(`⚠️ Skipped LLM analysis (GEMINI_API_KEY missing in .env)\n`);
    return rawOutput;
  }

  console.log(`🤖 Synthesizing report with Gemini...`);
  try {
    const report = await analyzeSiteData(site.name, rawOutput);
    
    // Save to 24-hour persistent cache
    await setCachedAnalysis(site.url, report);

    const reportPath = await saveAnalysisResult(site.name, report, outputDir);
    console.log(`💾 Saved Report: ${reportPath}\n`);
    return report;
  } catch (err) {
    console.log(`❌ Gemini Analysis Failed: ${err.message}\n`);
    return null;
  }
}

/**
 * CLI Commander Setup
 */
const program = new Command();

program
  .name('saas-teardown')
  .description('Production-ready CLI engine for SaaS competitive intelligence and site teardowns')
  .version('1.0.0');

// Command: Single URL Teardown
program
  .command('url')
  .description('Run teardown on a live website URL')
  .argument('<url>', 'Target website URL (e.g., https://cal.com)')
  .option('-n, --name <string>', 'Company/Site name')
  .option('-o, --outdir <path>', 'Output directory for reports', './outputs')
  .option('-f, --force', 'Bypass cache and force fresh crawl + analysis')
  .action(async (targetUrl, options) => {
    let formattedUrl = targetUrl;
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const domainName = new URL(formattedUrl).hostname.replace(/^www\./, '');
    const siteName = options.name || domainName;

    await teardownSite({ name: siteName, url: formattedUrl }, options);
  });

// Command: Batch Test Suite
program
  .command('batch')
  .description('Run teardown across all sites in test-sites.json')
  .option('-o, --outdir <path>', 'Output directory for reports', './outputs')
  .option('-f, --force', 'Bypass cache and force fresh batch execution')
  .action(async (options) => {
    try {
      const jsonContent = await fs.readFile(path.join(projectRoot, 'test-sites.json'), 'utf-8');
      const testSites = JSON.parse(jsonContent);

      console.log(`\nSaaS Teardown Pipeline (Powered by gemini-3.5-flash-lite)`);
      console.log(`Running batch job for ${testSites.length} targets...\n`);

      for (const site of testSites) {
        await teardownSite(site, options);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (err) {
      console.error(`❌ Batch execution failed: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);