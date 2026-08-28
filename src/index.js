#!/usr/bin/env node
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
import { exportReport } from './utils/exporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

/**
 * Normalizes input URL strings and extracts clean domain names.
 */
function normalizeUrl(input) {
  let urlString = input.trim();
  if (!/^https?:\/\//i.test(urlString)) {
    urlString = `https://${urlString}`;
  }

  try {
    const parsed = new URL(urlString);
    return {
      fullUrl: parsed.toString(),
      domain: parsed.hostname.replace(/^www\./, ''),
    };
  } catch (error) {
    throw new Error(`Invalid URL provided: "${input}".`);
  }
}

/**
 * Normalizes Gemini/Scraper raw output into a clean schema for export engines and API consumption.
 */
function formatReportPayload(site, rawOutput, reportData) {
  return {
    targetDomain: site.name,
    url: site.url,
    timestamp: new Date().toISOString().split('T')[0],
    businessSummary: reportData?.businessSummary || reportData?.summary || `${site.name} platform competitive analysis.`,
    techStack: reportData?.techStack || rawOutput?.detectedTechnologies?.map((t) => t.technology) || [],
    keyInsights: reportData?.keyInsights || reportData?.insights || [
      `Crawl completed with latency of ${((rawOutput?.crawl?.latencyMs || 0) / 1000).toFixed(1)}s.`,
      `Identified ${rawOutput?.detectedTechnologies?.length || 0} client-side fingerprints.`
    ],
    recommendations: reportData?.recommendations || [
      "No specific recommendations extracted from landing page data."
    ],
    competitors: reportData?.competitors || [
      "Direct competitors not automatically identified."
    ]
  };
}

/**
 * Runs the full teardown pipeline for a single target site with 24-hour caching and exporter routing.
 */
export async function teardownSite(site, options = {}) {
  const outputDir = options.outdir || path.join(projectRoot, 'outputs');
  await fs.mkdir(outputDir, { recursive: true });

  const format = (options.format || 'json').toLowerCase();

  console.log(`\n=====================================================`);
  console.log(`🔎 Analyzing ${site.name}: ${site.url}`);
  console.log(`=====================================================`);

  let finalReport = null;

  // Check 24h cache unless force bypass is requested
  if (!options.force) {
    const cache = await getCachedAnalysis(site.url);
    if (cache.hit) {
      const hoursAgo = (cache.ageMs / (1000 * 60 * 60)).toFixed(1);
      console.log(`⚡ Cache HIT (Analyzed ${hoursAgo} hours ago)`);
      finalReport = cache.data;
    }
  }

  // Cache MISS or Force Refresh -> Crawl and Synthesize
  if (!finalReport) {
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
      finalReport = formatReportPayload(site, rawOutput, null);
    } else {
      console.log(`🤖 Synthesizing report with Gemini...`);
      try {
        const report = await analyzeSiteData(site.name, rawOutput);
        finalReport = formatReportPayload(site, rawOutput, report);

        // Save to 24-hour persistent cache
        await setCachedAnalysis(site.url, finalReport);
      } catch (err) {
        console.log(`❌ Gemini Analysis Failed: ${err.message}\n`);
        finalReport = formatReportPayload(site, rawOutput, null);
      }
    }
  }

  // Handle Export Output based on --format flag
  if (format === 'json') {
    const reportPath = await saveAnalysisResult(site.name, finalReport, outputDir);
    console.log(`💾 Saved Report to: ${reportPath}\n`);
  } else {
    try {
      // Pass outputDir down to exportReport so files write to projectRoot/outputs
      const exportedPath = await exportReport(finalReport, { format, outdir: outputDir, outputDir });
      console.log(`📄 Generated ${format.toUpperCase()} Report: ${exportedPath}\n`);
    } catch (exportErr) {
      console.error(`❌ Exporter Failed: ${exportErr.message}\n`);
    }
  }

  return finalReport;
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
  .command('analyze')
  .alias('url')
  .description('Run teardown on a live website URL')
  .argument('<url>', 'Target website URL (e.g., stripe.com or https://cal.com)')
  .option('-n, --name <string>', 'Company/Site name')
  .option('-o, --outdir <path>', 'Output directory for reports', './outputs')
  .option('-f, --format <format>', 'Output format: json, html, pdf', 'json')
  .option('--force', 'Bypass cache and force fresh crawl + analysis')
  .action(async (targetUrl, options) => {
    try {
      const { fullUrl, domain } = normalizeUrl(targetUrl);
      const siteName = options.name || domain;

      await teardownSite({ name: siteName, url: fullUrl }, options);
    } catch (err) {
      console.error(`❌ Execution failed: ${err.message}`);
      process.exit(1);
    }
  });

// Command: Batch Test Suite
program
  .command('batch')
  .description('Run teardown across all sites in test-sites.json')
  .option('-o, --outdir <path>', 'Output directory for reports', './outputs')
  .option('-f, --format <format>', 'Output format: json, html, pdf', 'json')
  .option('--force', 'Bypass cache and force fresh batch execution')
  .action(async (options) => {
    try {
      const jsonContent = await fs.readFile(path.join(projectRoot, 'test-sites.json'), 'utf-8');
      const testSites = JSON.parse(jsonContent);

      console.log(`\nSaaS Teardown Pipeline`);
      console.log(`Running batch job for ${testSites.length} targets...\n`);

      for (const site of testSites) {
        const { fullUrl, domain } = normalizeUrl(site.url);
        await teardownSite({ name: site.name || domain, url: fullUrl }, options);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (err) {
      console.error(`❌ Batch execution failed: ${err.message}`);
      process.exit(1);
    }
  });

// ONLY parse CLI flags when index.js is invoked directly as a script
const isDirectEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectEntrypoint) {
  program.parse(process.argv);
}