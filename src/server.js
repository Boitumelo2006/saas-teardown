import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { teardownSite } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const outputsDir = path.join(projectRoot, 'outputs');

if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/outputs', express.static(outputsDir));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'saas-teardown-api', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ status: 'active', message: 'SaaS Teardown API is running live on Railway.' });
});

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

    const exportFormat = (!format || format.toLowerCase() === 'json') 
      ? 'pdf' 
      : format.toLowerCase();

    // Run core engine pipeline
    const report = await teardownSite(
      { name: siteName, url: targetUrl },
      { format: exportFormat, force, outdir: outputsDir }
    );

    if (!report) {
      return res.status(500).json({ error: 'Analysis failed during crawling or LLM synthesis.' });
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');

    // Dynamic file detection inside outputsDir
    const files = fs.readdirSync(outputsDir);
    const targetExtension = `.${exportFormat}`;
    
    // Find file matching siteName base name
    const cleanBaseName = siteName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchedFile = files.find(f => {
      const cleanFileName = f.toLowerCase().replace(/[^a-z0-9]/g, '');
      return f.endsWith(targetExtension) && cleanFileName.includes(cleanBaseName);
    });

    const activeFileName = matchedFile || `${siteName}.${exportFormat}`;
    const downloadUrl = `${protocol}://${host}/outputs/${activeFileName}`;

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