import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let customSignatures = [];
let wappalyzerSignatures = {};

// Load signature sets on initialization
try {
  const customPath = path.join(__dirname, '..', 'signatures', 'fingerprints.json');
  if (fs.existsSync(customPath)) {
    customSignatures = JSON.parse(fs.readFileSync(customPath, 'utf-8'));
  }

  const wappalyzerPath = path.join(__dirname, '..', 'signatures', 'wappalyzer-technologies.json');
  if (fs.existsSync(wappalyzerPath)) {
    const rawWappalyzer = JSON.parse(fs.readFileSync(wappalyzerPath, 'utf-8'));
    wappalyzerSignatures = rawWappalyzer.apps || rawWappalyzer.technologies || rawWappalyzer;
  }
} catch (error) {
  console.error('[TechDetector Setup Error]:', error.message);
}

/**
 * Strips Wappalyzer version capturing syntax (e.g. pattern\;version:\1)
 */
function cleanRegexPattern(patternStr) {
  if (!patternStr) return '';
  return patternStr.split('\\;')[0].trim();
}

/**
 * Analyzes HTTP headers, raw HTML content, and script tags to identify tech stack
 * 
 * @param {Object} headers - Key-value pair of low-cased HTTP response headers
 * @param {string} htmlBody - Raw HTML string of the target page
 * @param {Array<string>} scriptSources - Array of target script URLs/SRC attributes
 * @returns {Array<Object>} List of detected technologies
 */
export function detectTechnologies(headers = {}, htmlBody = '', scriptSources = []) {
  const detected = new Map();

  // PASS 1: Proprietary Cossay Overrides (fingerprints.json)
  for (const item of customSignatures) {
    let matched = false;

    // 1. Header checks
    if (item.rules?.headers) {
      for (const [headerKey, patterns] of Object.entries(item.rules.headers)) {
        const actualVal = headers[headerKey.toLowerCase()] || '';
        const patternArray = Array.isArray(patterns) ? patterns : [patterns];
        if (patternArray.some(p => new RegExp(p, 'i').test(actualVal))) {
          matched = true;
          break;
        }
      }
    }

    // 2. Network / Script / HTML string checks
    if (!matched && item.rules?.network) {
      for (const pattern of item.rules.network) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(htmlBody) || scriptSources.some(src => regex.test(src))) {
          matched = true;
          break;
        }
      }
    }

    if (matched) {
      detected.set(item.name.toLowerCase(), {
        name: item.name,
        category: item.category,
        source: 'cossay-override'
      });
    }
  }

  // PASS 2: Open Wappalyzer Definitions (wappalyzer-technologies.json)
  for (const [techName, rules] of Object.entries(wappalyzerSignatures)) {
    if (detected.has(techName.toLowerCase())) continue; // Skip if overridden by Cossay

    let matched = false;

    // 1. Header checks
    if (rules.headers) {
      for (const [headerKey, patternVal] of Object.entries(rules.headers)) {
        const actualVal = headers[headerKey.toLowerCase()] || '';
        const cleanPattern = cleanRegexPattern(typeof patternVal === 'string' ? patternVal : patternVal[0]);
        if (actualVal && new RegExp(cleanPattern, 'i').test(actualVal)) {
          matched = true;
          break;
        }
      }
    }

    // 2. HTML Body checks
    if (!matched && rules.html) {
      const htmlPatterns = Array.isArray(rules.html) ? rules.html : [rules.html];
      for (const rawPattern of htmlPatterns) {
        const cleanPattern = cleanRegexPattern(rawPattern);
        if (cleanPattern && new RegExp(cleanPattern, 'i').test(htmlBody)) {
          matched = true;
          break;
        }
      }
    }

    // 3. Script Source checks
    if (!matched && (rules.scripts || rules.script)) {
      const scriptPatterns = rules.scripts || rules.script;
      const patternArray = Array.isArray(scriptPatterns) ? scriptPatterns : [scriptPatterns];
      for (const rawPattern of patternArray) {
        const cleanPattern = cleanRegexPattern(rawPattern);
        if (cleanPattern) {
          const regex = new RegExp(cleanPattern, 'i');
          if (scriptSources.some(src => regex.test(src))) {
            matched = true;
            break;
          }
        }
      }
    }

    if (matched) {
      detected.set(techName.toLowerCase(), {
        name: techName,
        category: rules.category || 'Infrastructure & Tools',
        source: 'community'
      });
    }
  }

  return Array.from(detected.values());
}