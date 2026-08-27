import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import handlebars from 'handlebars';
import PDFDocument from 'pdfkit';

const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 32px; color: #0f172a; background: #f8fafc; }
    .header { background: #0f172a; color: #ffffff; padding: 24px 32px; border-radius: 8px; margin-bottom: 24px; border-left: 6px solid #2563eb; }
    .header h1 { margin: 0 0 6px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
    .header .meta { color: #94a3b8; font-size: 13px; }
    .card { background: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; color: #2563eb; margin: 0 0 12px 0; padding-left: 10px; border-left: 3px solid #2563eb; }
    p { margin: 0; color: #334155; line-height: 1.6; font-size: 14px; }
    .badge-container { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .badge { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 4px 12px; border-radius: 16px; font-weight: 600; font-size: 12px; }
    ul { margin: 0; padding-left: 18px; color: #334155; }
    li { margin-bottom: 8px; font-size: 14px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="header">
    <h1>SaaS Teardown: {{targetDomain}}</h1>
    <div class="meta">Target URL: {{url}} &bull; Generated on: {{timestamp}}</div>
  </div>

  <div class="card">
    <h2>Business Positioning</h2>
    <p>{{businessSummary}}</p>
  </div>

  <div class="card">
    <h2>Detected Tech Stack</h2>
    <div class="badge-container">
      {{#each techStack}}
        <span class="badge">{{this}}</span>
      {{/each}}
    </div>
  </div>

  <div class="card">
    <h2>Key Strategic Insights</h2>
    <ul>
      {{#each keyInsights}}
        <li>{{this}}</li>
      {{/each}}
    </ul>
  </div>
</body>
</html>
`;

export async function exportReport(jsonData, options = { format: 'html' }) {
  await fs.mkdir('./outputs', { recursive: true });
  const outputFilename = `teardown-${jsonData.targetDomain || 'report'}`;

  // 1. Export HTML
  if (options.format === 'html') {
    const template = handlebars.compile(HTML_TEMPLATE);
    const htmlContent = template(jsonData);
    const htmlPath = path.join('./outputs', `${outputFilename}.html`);
    await fs.writeFile(htmlPath, htmlContent, 'utf-8');
    return htmlPath;
  }

  // 2. Export PDF via PDFKit
  if (options.format === 'pdf') {
    const pdfPath = path.join('./outputs', `${outputFilename}.pdf`);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const stream = createWriteStream(pdfPath);

      doc.pipe(stream);

      // Top Header Banner
      doc.rect(40, 40, 515, 65).fill('#0f172a');
      doc.rect(40, 40, 6, 65).fill('#2563eb');

      doc.fontSize(18).fillColor('#ffffff').font('Helvetica-Bold').text(`SaaS Teardown: ${jsonData.targetDomain}`, 56, 52);
      doc.fontSize(9).fillColor('#94a3b8').font('Helvetica').text(`Target: ${jsonData.url}   |   Generated: ${jsonData.timestamp}`, 56, 76);

      let currentY = 125;

      // Section Utility Drawer
      const drawSectionHeader = (title, y) => {
        doc.rect(40, y, 3, 14).fill('#2563eb');
        doc.fontSize(11).fillColor('#2563eb').font('Helvetica-Bold').text(title.toUpperCase(), 50, y + 1);
        return y + 24;
      };

      // 1. Business Positioning Section
      currentY = drawSectionHeader('Business Positioning', currentY);
      doc.fontSize(10).fillColor('#334155').font('Helvetica').text(jsonData.businessSummary, 40, currentY, { width: 515, lineGap: 4 });
      currentY = doc.y + 20;

      // 2. Tech Stack Section
      currentY = drawSectionHeader('Detected Tech Stack', currentY);
      
      let badgeX = 40;
      jsonData.techStack.forEach((tech) => {
        const textWidth = doc.widthOfString(tech, { font: 'Helvetica-Bold', size: 9 });
        const badgeWidth = textWidth + 16;

        if (badgeX + badgeWidth > 555) {
          badgeX = 40;
          currentY += 24;
        }

        // Draw Pill Badge
        doc.roundedRect(badgeX, currentY, badgeWidth, 18, 9).fill('#eff6ff');
        doc.roundedRect(badgeX, currentY, badgeWidth, 18, 9).lineWidth(0.5).stroke('#bfdbfe');
        doc.fontSize(9).fillColor('#1e40af').font('Helvetica-Bold').text(tech, badgeX + 8, currentY + 4);

        badgeX += badgeWidth + 8;
      });

      currentY += 34;

      // 3. Key Strategic Insights
      currentY = drawSectionHeader('Key Strategic Insights', currentY);
      jsonData.keyInsights.forEach((insight) => {
        doc.fontSize(10).fillColor('#2563eb').font('Helvetica-Bold').text('•', 42, currentY);
        doc.fontSize(10).fillColor('#334155').font('Helvetica').text(insight, 54, currentY, { width: 500, lineGap: 3 });
        currentY = doc.y + 6;
      });

      doc.end();

      stream.on('finish', () => resolve(pdfPath));
      stream.on('error', (err) => reject(err));
    });
  }
}