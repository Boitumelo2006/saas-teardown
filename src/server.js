import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { teardownSite } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static reports directly
app.use('/outputs', express.static(path.join(projectRoot, 'outputs')));

/**
 * Health Check Endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'saas-teardown-api', timestamp: new Date().toISOString() });
});

/**
 * Root Health Check for Browser visits
 */
app.get('/', (req, res) => {
  res.json({ status: 'active', message: 'SaaS Teardown API is running live on Railway.' });
});

/**
 * Teardown API Endpoint for Lovable / Web UI
 * POST /api/teardown
 * Body: { "url": "stripe.com", "force": false }
 */
app.post('/api/teardown', async (req, res) => {
  try {
    const { url, name, format, force = false } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Missing required parameter: url' });
    }

    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    const domainName = new URL(targetUrl).hostname.replace(/^www\./, '');
    const siteName = name || domainName;

    // Default export format to 'pdf' if omitted or set to 'json'
    const exportFormat = (!format || format.toLowerCase() === 'json') 
      ? 'pdf' 
      : format.toLowerCase();

    // Run core engine pipeline
    const report = await teardownSite(
      { name: siteName, url: targetUrl },
      { format: exportFormat, force }
    );

    if (!report) {
      return res.status(500).json({ error: 'Analysis failed during crawling or LLM synthesis.' });
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');

    // Build downloadable public output link
    const downloadUrl = `${protocol}://${host}/outputs/${siteName}.${exportFormat}`;

    return res.json({
      success: true,
      data: report,
      downloadUrl
    });

  } catch (error) {
    console.error(`[API Error]: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 SaaS Teardown API running at http://localhost:${PORT}`);
  console.log(`📂 Serving output files at http://localhost:${PORT}/outputs`);
});