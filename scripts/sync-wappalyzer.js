import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SIGNATURES_DIR = path.join(__dirname, '..', 'src', 'signatures');
const TARGET_FILE = path.join(SIGNATURES_DIR, 'wappalyzer-technologies.json');

// Source mirror for Wappalyzer signatures
const WAPPALYZER_MIRROR_URL = 'https://raw.githubusercontent.com/projectdiscovery/wappalyzergo/main/fingerprints_data.json';

async function syncWappalyzer() {
  console.log('🔄 Fetching latest technology signatures...');

  try {
    const response = await fetch(WAPPALYZER_MIRROR_URL, {
      headers: { 'User-Agent': 'Cossay-TechSync/1.0' }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Ensure directory exists
    if (!fs.existsSync(SIGNATURES_DIR)) {
      fs.mkdirSync(SIGNATURES_DIR, { recursive: true });
    }

    // Write updated JSON
    fs.writeFileSync(TARGET_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ Successfully updated ${TARGET_FILE}`);

  } catch (error) {
    console.warn(`⚠️ Sync failed: ${error.message}`);
    console.warn('Falling back to local cached wappalyzer-technologies.json');
  }
}

syncWappalyzer();