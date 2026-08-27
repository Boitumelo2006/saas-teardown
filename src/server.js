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

// Serve static PDF and HTML reports directly
app.use('/outputs', express.static(path.join(projectRoot, 'outputs')));

/**
 * Health Check Endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'saas-teardown-api', timestamp: new Date().toISOString() });
});

/**
 * Teardown API Endpoint for Lovable / Web UI
 * POST /api/teardown
 * Body: { "url": "stripe.com", "format": "pdf", "force": false }
 */
app.post('/api/teardown', async (req, res) => {
  try {
    const { url, name, format = 'json', force = false } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Missing required parameter: url' });
    }

    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    const domainName = new URL(targetUrl).hostname.replace(/^www\./, '');
    const siteName = name || domainName;

    // Run core engine pipeline
    const report = await teardownSite(
      { name: siteName, url: targetUrl },
      { format, force }
    );

    if (!report) {
      return res.status(500).json({ error: 'Analysis failed during crawling or LLM synthesis.' });
    }

    const fileExtension = format.toLowerCase();
    const downloadUrl = format !== 'json' 
      ? `${req.protocol}://${req.get('host')}/outputs/teardown-${siteName}.${fileExtension}`
      : null;

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