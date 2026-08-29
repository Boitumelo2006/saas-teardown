import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import handlebars from 'handlebars';
import PDFDocument from 'pdfkit';

/**
 * Handlebars HTML Template with Minimalist Typography
 */
const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SaaS Teardown: {{targetDomain}}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 48px;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.6;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 24px;
      margin-bottom: 40px;
    }
    .brand-title {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.03em;
      text-transform: capitalize;
      margin: 0 0 4px 0;
    }
    .meta { color: #64748b; font-size: 13px; font-weight: 500; }
    .logo-placeholder {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #94a3b8;
      text-transform: uppercase;
      border: 1px dashed #cbd5e1;
      padding: 10px 18px;
      border-radius: 6px;
    }
    
    .section { margin-bottom: 36px; }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #0f172a;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
    }
    
    p { margin: 0 0 12px 0; color: #334155; font-size: 14px; }
    
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    
    .card {
      background: #f8fafc;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    
    .card h4 { margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #0f172a; }
    
    .badge-container { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .badge {
      background: #ffffff;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 12px;
    }
    
    ul { margin: 0; padding-left: 18px; color: #334155; }
    li { margin-bottom: 6px; font-size: 14px; }

    .swot-box { padding: 16px; border-radius: 6px; font-size: 13px; }
    .swot-s { background: #f0fdf4; border: 1px solid #bbf7d0; }
    .swot-w { background: #fef2f2; border: 1px solid #fecaca; }
    .swot-o { background: #eff6ff; border: 1px solid #bfdbfe; }
    .swot-t { background: #fffbebf; border: 1px solid #fde68a; }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <h1 class="brand-title">{{targetDomain}} Teardown</h1>
      <div class="meta">{{url}} &bull; Generated: {{timestamp}}</div>
    </div>
    <div class="logo-placeholder">Your Logo Here</div>
  </div>

  <div class="section">
    <div class="section-title">01. Executive Summary & Value Propositions</div>
    <p>{{businessSummary}}</p>
    <ul>
      {{#each valuePropositions}}
        <li>{{this}}</li>
      {{/each}}
    </ul>
  </div>

  <div class="grid-2 section">
    <div class="card">
      <div class="section-title">02. Target Persona</div>
      <h4>Primary Audience</h4>
      <p>{{targetPersona.primaryAudience}}</p>
      <h4>Ideal Customer Profile</h4>
      <p>{{targetPersona.idealCustomerProfile}}</p>
      <h4>Key Pain Points</h4>
      <ul>
        {{#each targetPersona.keyPainPoints}}
          <li>{{this}}</li>
        {{/each}}
      </ul>
    </div>

    <div class="card">
      <div class="section-title">03. Revenue Model</div>
      <h4>Monetization Type</h4>
      <p>{{revenueModel.monetizationType}}</p>
      <h4>Estimated ARPU</h4>
      <p>{{revenueModel.estimatedArpu}}</p>
      <h4>Pricing Tiers</h4>
      <ul>
        {{#each revenueModel.pricingTiers}}
          <li>{{this}}</li>
        {{/each}}
      </ul>
    </div>
  </div>

  <div class="section">
    <div class="section-title">04. Strategic SWOT Analysis</div>
    <div class="grid-4">
      <div class="swot-box swot-s">
        <strong>Strengths</strong>
        <ul>{{#each swotAnalysis.strengths}}<li>{{this}}</li>{{/each}}</ul>
      </div>
      <div class="swot-box swot-w">
        <strong>Weaknesses</strong>
        <ul>{{#each swotAnalysis.weaknesses}}<li>{{this}}</li>{{/each}}</ul>
      </div>
      <div class="swot-box swot-o">
        <strong>Opportunities</strong>
        <ul>{{#each swotAnalysis.opportunities}}<li>{{this}}</li>{{/each}}</ul>
      </div>
      <div class="swot-box swot-t">
        <strong>Threats</strong>
        <ul>{{#each swotAnalysis.threats}}<li>{{this}}</li>{{/each}}</ul>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">05. Technical Architecture & Stack</div>
    <p><strong>Frontend:</strong> {{technicalArchitecture.frontend}}</p>
    <p><strong>Infrastructure:</strong> {{technicalArchitecture.infrastructureInsights}}</p>
    <div class="badge-container">
      {{#each techStack}}
        <span class="badge">{{this}}</span>
      {{/each}}
    </div>
  </div>

  <div class="grid-2 section">
    <div class="card">
      <div class="section-title">06. Key Insights</div>
      <ul>
        {{#each keyInsights}}
          <li>{{this}}</li>
        {{/each}}
      </ul>
    </div>
    <div class="card">
      <div class="section-title">07. Strategic Recommendations</div>
      <ul>
        {{#each recommendations}}
          <li>{{this}}</li>
        {{/each}}
      </ul>
    </div>
  </div>

</body>
</html>
`;

export async function exportReport(jsonData, options = { format: 'html' }) {
  const outputDir = options.outdir || options.outputDir || './outputs';
  await fs.mkdir(outputDir, { recursive: true });
  
  const safeName = (jsonData.targetDomain || 'report').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const outputFilename = `teardown-${safeName}`;

  // ---------------------------------------------------------
  // 1. Export HTML
  // ---------------------------------------------------------
  if (options.format === 'html') {
    const template = handlebars.compile(HTML_TEMPLATE);
    const htmlContent = template(jsonData);
    const htmlPath = path.join(outputDir, `${outputFilename}.html`);
    await fs.writeFile(htmlPath, htmlContent, 'utf-8');
    return htmlPath;
  }

  // ---------------------------------------------------------
  // 2. Export Minimalist Multi-Page PDF via PDFKit
  // ---------------------------------------------------------
  if (options.format === 'pdf') {
    const pdfPath = path.join(outputDir, `${outputFilename}.pdf`);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 45,
        bufferPages: true,
      });

      const stream = createWriteStream(pdfPath);
      doc.pipe(stream);

      const PAGE_WIDTH = 505; // 595.28 - 90
      let currentY = 45;

      // Helper: Check Page Bounds & Auto Break
      const ensureSpace = (heightNeeded) => {
        if (currentY + heightNeeded > 780) {
          doc.addPage();
          currentY = 45;
          drawMinimalHeader(true);
        }
      };

      // Helper: Clean Minimal Header
      const drawMinimalHeader = (isSubsequent = false) => {
        if (!isSubsequent) {
          // Main Document Header
          doc.fontSize(22).fillColor('#0f172a').font('Helvetica-Bold').text(jsonData.targetDomain.toUpperCase(), 45, currentY);
          doc.fontSize(9).fillColor('#64748b').font('Helvetica').text(`URL: ${jsonData.url}   |   DATE: ${jsonData.timestamp}`, 45, currentY + 28);
          
          // White-label Logo Container Box (Top Right)
          doc.roundedRect(420, currentY, 130, 32, 4).lineWidth(0.5).dash(3, { space: 3 }).stroke('#cbd5e1');
          doc.undash();
          doc.fontSize(8).fillColor('#94a3b8').font('Helvetica-Bold').text('Saas Teardown', 438, currentY + 12);

          // Divider Line
          doc.moveTo(45, currentY + 48).lineTo(550, currentY + 48).lineWidth(1).stroke('#0f172a');
          currentY += 65;
        } else {
          // Minimal Header for Pages 2+
          doc.fontSize(8).fillColor('#94a3b8').font('Helvetica-Bold').text(`${jsonData.targetDomain.toUpperCase()} — TEARDOWN REPORT`, 45, 30);
          doc.moveTo(45, 40).lineTo(550, 40).lineWidth(0.5).stroke('#e2e8f0');
          currentY = 50;
        }
      };

      // Helper: Section Titles
      const drawSectionHeader = (title) => {
        ensureSpace(35);
        doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text(title.toUpperCase(), 45, currentY, { characterSpacing: 1.5 });
        doc.moveTo(45, currentY + 14).lineTo(550, currentY + 14).lineWidth(0.5).stroke('#cbd5e1');
        currentY += 24;
      };

      // Initial Header
      drawMinimalHeader(false);

      // --- SECTION 1: BUSINESS POSITIONING & VALUE PROPS ---
      drawSectionHeader('01. Business Positioning & Value Propositions');
      doc.fontSize(10).fillColor('#334155').font('Helvetica').text(jsonData.businessSummary || 'N/A', 45, currentY, { width: PAGE_WIDTH, lineGap: 3 });
      currentY = doc.y + 12;

      if (jsonData.valuePropositions?.length) {
        jsonData.valuePropositions.forEach((vp) => {
          ensureSpace(20);
          doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('•', 45, currentY);
          doc.fontSize(9).fillColor('#334155').font('Helvetica').text(vp, 57, currentY, { width: PAGE_WIDTH - 12, lineGap: 2 });
          currentY = doc.y + 4;
        });
      }
      currentY += 16;

      // --- SECTION 2: TARGET PERSONA ---
      drawSectionHeader('02. Target Persona & ICP');
      doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('Primary Audience: ', 45, currentY, { continued: true });
      doc.font('Helvetica').fillColor('#334155').text(jsonData.targetPersona?.primaryAudience || 'N/A');
      currentY = doc.y + 6;

      doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('Ideal Customer Profile: ', 45, currentY, { continued: true });
      doc.font('Helvetica').fillColor('#334155').text(jsonData.targetPersona?.idealCustomerProfile || 'N/A');
      currentY = doc.y + 10;

      if (jsonData.targetPersona?.keyPainPoints?.length) {
        doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('Key Pain Points Addressed:', 45, currentY);
        currentY += 14;
        jsonData.targetPersona.keyPainPoints.forEach((pain) => {
          ensureSpace(18);
          doc.fontSize(9).fillColor('#64748b').font('Helvetica-Bold').text('-', 50, currentY);
          doc.fontSize(9).fillColor('#334155').font('Helvetica').text(pain, 60, currentY, { width: PAGE_WIDTH - 15 });
          currentY = doc.y + 3;
        });
      }
      currentY += 16;

      // --- SECTION 3: REVENUE MODEL ---
      drawSectionHeader('03. Revenue & Monetization Model');
      doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('Monetization Type: ', 45, currentY, { continued: true });
      doc.font('Helvetica').fillColor('#334155').text(jsonData.revenueModel?.monetizationType || 'N/A');
      currentY = doc.y + 6;

      doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('Estimated ARPU: ', 45, currentY, { continued: true });
      doc.font('Helvetica').fillColor('#334155').text(jsonData.revenueModel?.estimatedArpu || 'N/A');
      currentY = doc.y + 10;

      if (jsonData.revenueModel?.pricingTiers?.length) {
        doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('Pricing Tiers:', 45, currentY);
        currentY += 14;
        jsonData.revenueModel.pricingTiers.forEach((tier) => {
          ensureSpace(20);
          doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('•', 50, currentY);
          doc.fontSize(9).fillColor('#334155').font('Helvetica').text(tier, 60, currentY, { width: PAGE_WIDTH - 15 });
          currentY = doc.y + 4;
        });
      }
      currentY += 16;

      // --- SECTION 4: SWOT ANALYSIS ---
      drawSectionHeader('04. Strategic SWOT Matrix');
      const renderSwotBlock = (title, items) => {
        if (!items || !items.length) return;
        ensureSpace(30);
        doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text(title.toUpperCase(), 45, currentY);
        currentY += 12;
        items.forEach((item) => {
          ensureSpace(18);
          doc.fontSize(8).fillColor('#64748b').font('Helvetica-Bold').text('>', 52, currentY);
          doc.fontSize(9).fillColor('#334155').font('Helvetica').text(item, 62, currentY, { width: PAGE_WIDTH - 17 });
          currentY = doc.y + 3;
        });
        currentY += 6;
      };

      if (jsonData.swotAnalysis) {
        renderSwotBlock('Strengths', jsonData.swotAnalysis.strengths);
        renderSwotBlock('Weaknesses', jsonData.swotAnalysis.weaknesses);
        renderSwotBlock('Opportunities', jsonData.swotAnalysis.opportunities);
        renderSwotBlock('Threats', jsonData.swotAnalysis.threats);
      }
      currentY += 10;

      // --- SECTION 5: TECHNICAL ARCHITECTURE & STACK ---
      drawSectionHeader('05. Technical Stack & Architecture');
      doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('Frontend Infrastructure: ', 45, currentY, { continued: true });
      doc.font('Helvetica').fillColor('#334155').text(jsonData.technicalArchitecture?.frontend || 'N/A');
      currentY = doc.y + 6;

      doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('Infrastructure Insights: ', 45, currentY, { continued: true });
      doc.font('Helvetica').fillColor('#334155').text(jsonData.technicalArchitecture?.infrastructureInsights || 'N/A');
      currentY = doc.y + 12;

      // Tech Stack Badges
      if (jsonData.techStack?.length) {
        ensureSpace(30);
        doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('Detected Technologies:', 45, currentY);
        currentY += 16;

        let badgeX = 45;
        jsonData.techStack.forEach((tech) => {
          const textWidth = doc.widthOfString(tech, { font: 'Helvetica-Bold', size: 8 });
          const badgeWidth = textWidth + 14;

          if (badgeX + badgeWidth > 550) {
            badgeX = 45;
            currentY += 22;
            ensureSpace(25);
          }

          doc.roundedRect(badgeX, currentY, badgeWidth, 16, 3).fill('#f1f5f9');
          doc.fontSize(8).fillColor('#0f172a').font('Helvetica-Bold').text(tech, badgeX + 7, currentY + 4);
          badgeX += badgeWidth + 6;
        });
        currentY += 28;
      }

      // --- SECTION 6: INSIGHTS & RECOMMENDATIONS ---
      drawSectionHeader('06. Strategic Insights & Recommendations');
      
      if (jsonData.keyInsights?.length) {
        doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('Key Insights:', 45, currentY);
        currentY += 14;
        jsonData.keyInsights.forEach((insight) => {
          ensureSpace(20);
          doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('•', 50, currentY);
          doc.fontSize(9).fillColor('#334155').font('Helvetica').text(insight, 60, currentY, { width: PAGE_WIDTH - 15 });
          currentY = doc.y + 4;
        });
        currentY += 10;
      }

      if (jsonData.recommendations?.length) {
        doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('Recommendations:', 45, currentY);
        currentY += 14;
        jsonData.recommendations.forEach((rec) => {
          ensureSpace(20);
          doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('•', 50, currentY);
          doc.fontSize(9).fillColor('#334155').font('Helvetica').text(rec, 60, currentY, { width: PAGE_WIDTH - 15 });
          currentY = doc.y + 4;
        });
      }

      // Render Footer on all pages
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#94a3b8').font('Helvetica').text(
          `Page ${i + 1} of ${range.count}`,
          45,
          810,
          { align: 'center', width: PAGE_WIDTH }
        );
      }

      doc.end();

      stream.on('finish', () => resolve(pdfPath));
      stream.on('error', (err) => reject(err));
    });
  }
}