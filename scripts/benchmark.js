import 'dotenv/config';

import fs from 'fs';
import path from 'path';

import { analyzeSiteData } from '../src/analyzer.js';

const SITES = ['cal', 'linear', 'posthog', 'notion', 'vercel', 'localcan'];
const OUTPUTS_DIR = path.join(process.cwd(), 'outputs');
const MODEL = 'gemini-3.5-flash-lite';

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTechnologyName(technology) {
  if (typeof technology === 'string') {
    return technology.trim();
  }

  if (technology && typeof technology === 'object') {
    return (
      technology.technology ||
      technology.name ||
      technology.tech ||
      ''
    ).trim();
  }

  return '';
}

function getEvidenceText(rawEvidence) {
  const pageData = rawEvidence?.pageData || {};

  return [
    pageData.bodyTextSnippet || '',
    ...(Array.isArray(pageData.headings) ? pageData.headings : []),
    pageData.title || '',
  ]
    .filter(Boolean)
    .join('\n');
}

// ------------------------------------------------------------
// Benchmark scoring
// ------------------------------------------------------------

function scoreReport(report, rawData) {
  let jsonValidity = 100;
  let evidencePreservation = 100;
  let noHallucination = 100;

  const rawEvidence = rawData?.rawEvidence || rawData || {};

  // 1. Schema verification
  const requiredKeys = [
    'company_name',
    'value_proposition',
    'observed_facts',
    'pricing_plans',
    'detected_technologies',
    'analytical_insights',
  ];

  for (const key of requiredKeys) {
    if (report?.[key] === undefined || report?.[key] === null) {
      jsonValidity -= 15;
    }
  }

  const arrayFields = [
    'observed_facts',
    'pricing_plans',
    'detected_technologies',
    'analytical_insights',
  ];

  for (const field of arrayFields) {
    if (report?.[field] !== undefined && !Array.isArray(report[field])) {
      jsonValidity -= 15;
    }
  }

  // 2. Evidence grounding
  const bodyText = getEvidenceText(rawEvidence);
  const normalizedBodyText = normalizeText(bodyText);

  let checkedFacts = 0;
  let matchedFacts = 0;

  if (Array.isArray(report?.observed_facts)) {
    for (const fact of report.observed_facts) {
      checkedFacts++;
      const evidence = normalizeText(fact?.evidence);

      if (evidence && normalizedBodyText.includes(evidence)) {
        matchedFacts++;
      } else {
        evidencePreservation -= 20;
      }
    }
  }

  const groundingPercentage =
    checkedFacts > 0 ? Math.round((matchedFacts / checkedFacts) * 100) : 100;

  // 3. Technology isolation
  const detectedTechs =
    rawData?.detectedTechnologies ||
    rawEvidence?.detectedTechnologies ||
    [];

  const allowedTechs = detectedTechs
    .map(extractTechnologyName)
    .filter(Boolean);

  const normalizeTech = (str) =>
    String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  const allowedTechLookup = new Set(allowedTechs.map(normalizeTech));

  let reportedTechCount = 0;
  let matchedTechCount = 0;

  if (Array.isArray(report?.detected_technologies)) {
    reportedTechCount = report.detected_technologies.length;

    for (const tech of report.detected_technologies) {
      const techName = extractTechnologyName(tech);

      if (!techName) {
        noHallucination -= 50;
        continue;
      }

      if (allowedTechLookup.has(normalizeTech(techName))) {
        matchedTechCount++;
      } else {
        noHallucination -= 50;
      }
    }
  }

  const techMatchPercentage =
    reportedTechCount > 0
      ? Math.round((matchedTechCount / reportedTechCount) * 100)
      : 100;

  // Clamp values
  const vScore = Math.max(0, Math.min(100, jsonValidity));
  const eScore = Math.max(0, Math.min(100, evidencePreservation));
  const hScore = Math.max(0, Math.min(100, noHallucination));

  const finalScore = (
    vScore * 0.3 +
    eScore * 0.3 +
    hScore * 0.3 +
    100 * 0.1
  ).toFixed(1);

  return {
    finalScore: parseFloat(finalScore),
    jsonValidity: vScore,
    evidencePreservation: eScore,
    noHallucination: hScore,
    matchedFacts: `${matchedFacts}/${checkedFacts}`,
    groundingPercentage,
    techCount: reportedTechCount,
    matchedTechCount,
    techMatchPercentage,
  };
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

async function main() {
  console.log(
    '\n============================================================================='
  );
  console.log(`⚡ BENCHMARK SUITE: ${MODEL}`);
  console.log(`🌐 Total Sites: ${SITES.length}`);
  console.log(
    '=============================================================================\n'
  );

  const results = [];
  let totalLatency = 0;
  let scoreSum = 0;

  for (const site of SITES) {
    const rawPath = path.join(OUTPUTS_DIR, `${site}-raw.json`);

    if (!fs.existsSync(rawPath)) {
      console.warn(`⚠️ Raw output missing for "${site}"`);
      continue;
    }

    let rawData;
    try {
      rawData = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
    } catch (err) {
      console.error(`❌ Failed to parse ${site}-raw.json:`, err.message);
      continue;
    }

    const formattedName = site.charAt(0).toUpperCase() + site.slice(1);
    process.stdout.write(`⏳ Analyzing ${formattedName}... `);

    const startTime = Date.now();

    try {
      const report = await analyzeSiteData(formattedName, rawData);
      const latency = Date.now() - startTime;
      totalLatency += latency;

      const metrics = scoreReport(report, rawData);
      scoreSum += metrics.finalScore;

      results.push({
        site: formattedName,
        latency,
        ...metrics,
      });

      console.log(`Done in ${latency}ms | Score: ${metrics.finalScore}`);
    } catch (err) {
      console.log('❌ Failed!');
      console.error(`    ${formattedName}:`, err?.message || err);
    }
  }

  if (results.length === 0) {
    console.error('❌ No sites were successfully evaluated.');
    process.exitCode = 1;
    return;
  }

  const avgScore = parseFloat((scoreSum / results.length).toFixed(1));
  const avgLatency = Math.round(totalLatency / results.length);

  console.log('\n');
  console.log(`📊 PER-SITE METRICS`);
  console.table(
    results.map((r) => ({
      Site: r.site,
      'Latency (ms)': r.latency,
      'Score (/100)': r.finalScore,
      'Schema %': `${r.jsonValidity}%`,
      'Grounding %': `${r.evidencePreservation}% (${r.matchedFacts})`,
      'Tech Match %': `${r.techMatchPercentage}%`,
      'Reported Techs': r.techCount,
    }))
  );

  console.log('\n=============================================================================');
  console.log(`📈 SUMMARY REPORT (${MODEL})`);
  console.log(`  • Average Latency: ${avgLatency} ms`);
  console.log(`  • Average Score:   ${avgScore} / 100`);
  console.log('=============================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Benchmark execution failed:', err);
  process.exitCode = 1;
});