import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import pLimit from 'p-limit';
import { z } from 'zod';
import { sanitizeScrapedContent } from './cleaner.js';

const ai = new GoogleGenAI();

// Enhanced Zod Schema for executive-grade report validation
const SiteAnalysisSchema = z.object({
  businessSummary: z.string().default('N/A'),
  valuePropositions: z.array(z.string()).default([]),
  targetPersona: z.object({
    primaryAudience: z.string().default('N/A'),
    idealCustomerProfile: z.string().default('N/A'),
    keyPainPoints: z.array(z.string()).default([]),
  }),
  revenueModel: z.object({
    monetizationType: z.string().default('N/A'),
    pricingTiers: z.array(z.string()).default([]),
    estimatedArpu: z.string().default('N/A'),
  }),
  swotAnalysis: z.object({
    strengths: z.array(z.string()).default([]),
    weaknesses: z.array(z.string()).default([]),
    opportunities: z.array(z.string()).default([]),
    threats: z.array(z.string()).default([]),
  }),
  techStack: z.array(z.string()).default([]),
  technicalArchitecture: z.object({
    frontend: z.string().default('N/A'),
    backendAndAnalytics: z.array(z.string()).default([]),
    infrastructureInsights: z.string().default('N/A'),
  }),
  keyInsights: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  competitors: z.array(z.string()).default([]),
});

async function callGeminiWithRetry(params, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
}

/**
 * Formats subpages into clean context snippets for LLM synthesis.
 */
function formatSubpages(subpages = []) {
  const validSubpages = subpages.filter((s) => s.success);
  if (validSubpages.length === 0) return 'No secondary subpages crawled.';

  return validSubpages
    .map(
      (s) =>
        `--- Subpage: ${s.url} (${s.title || 'Untitled'}) ---\n` +
        `Headings: ${s.headings?.slice(0, 8).join(' | ') || 'None'}\n` +
        `Snippet: ${s.bodyTextSnippet?.substring(0, 3500) || 'None'}`
    )
    .join('\n\n');
}

/**
 * Analyzes a single site's scraped payload with pre-sanitization.
 */
export async function analyzeSiteData(siteName, rawOutput) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  let rawDataToSanitize = rawOutput;
  let subpagesContext = 'No secondary subpages crawled.';

  if (typeof rawOutput === 'object' && rawOutput !== null) {
    if (rawOutput.rawEvidence?.subpages) {
      subpagesContext = formatSubpages(rawOutput.rawEvidence.subpages);
    }
  }

  const sanitizedInput = typeof rawDataToSanitize === 'string'
    ? sanitizeScrapedContent(rawDataToSanitize)
    : sanitizeScrapedContent(JSON.stringify(rawDataToSanitize));

  if (!sanitizedInput) {
    throw new Error(`Scraped content for ${siteName} is empty or unreadable.`);
  }

  const userContent = JSON.stringify({
    siteName,
    primaryLandingData: sanitizedInput,
    subpagesEvidence: subpagesContext,
  });

  const systemInstruction = `You are a world-class SaaS competitive intelligence analyst preparing an executive-grade teardown report for investors and product leaders. Analyze the provided scraped web data and subpages to output an in-depth, comprehensive breakdown.

CRITICAL INSTRUCTIONS:
1. Provide deep, granular analysis across all requested dimensions (SWOT, Revenue Models, Persona Breakdown, Technical Stack). Avoid vague generic statements.
2. Under "revenueModel", extract specific tier prices, billing cycles, or transaction rates if visible in the scraped text.
3. Under "swotAnalysis", identify strategic SaaS positioning strengths, weaknesses, growth opportunities, and market threats.
4. Synthesize all subpage evidence (pricing, plans, support) into clear, actionable executive insights.`;

  const response = await callGeminiWithRetry({
    model,
    contents: userContent,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          businessSummary: { type: 'STRING' },
          valuePropositions: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          targetPersona: {
            type: 'OBJECT',
            properties: {
              primaryAudience: { type: 'STRING' },
              idealCustomerProfile: { type: 'STRING' },
              keyPainPoints: {
                type: 'ARRAY',
                items: { type: 'STRING' },
              },
            },
            required: ['primaryAudience', 'idealCustomerProfile', 'keyPainPoints'],
          },
          revenueModel: {
            type: 'OBJECT',
            properties: {
              monetizationType: { type: 'STRING' },
              pricingTiers: {
                type: 'ARRAY',
                items: { type: 'STRING' },
              },
              estimatedArpu: { type: 'STRING' },
            },
            required: ['monetizationType', 'pricingTiers', 'estimatedArpu'],
          },
          swotAnalysis: {
            type: 'OBJECT',
            properties: {
              strengths: { type: 'ARRAY', items: { type: 'STRING' } },
              weaknesses: { type: 'ARRAY', items: { type: 'STRING' } },
              opportunities: { type: 'ARRAY', items: { type: 'STRING' } },
              threats: { type: 'ARRAY', items: { type: 'STRING' } },
            },
            required: ['strengths', 'weaknesses', 'opportunities', 'threats'],
          },
          techStack: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          technicalArchitecture: {
            type: 'OBJECT',
            properties: {
              frontend: { type: 'STRING' },
              backendAndAnalytics: { type: 'ARRAY', items: { type: 'STRING' } },
              infrastructureInsights: { type: 'STRING' },
            },
            required: ['frontend', 'backendAndAnalytics', 'infrastructureInsights'],
          },
          keyInsights: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          recommendations: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          competitors: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
        },
        required: [
          'businessSummary',
          'valuePropositions',
          'targetPersona',
          'revenueModel',
          'swotAnalysis',
          'techStack',
          'technicalArchitecture',
          'keyInsights',
          'recommendations',
          'competitors',
        ],
      },
    },
  });

  let rawJson;
  try {
    rawJson = JSON.parse(response.text);
  } catch (err) {
    throw new Error(`Failed to parse JSON response from Gemini: ${err.message}`);
  }

  const validationResult = SiteAnalysisSchema.safeParse(rawJson);
  if (!validationResult.success) {
    console.error(`[${siteName}] Validation failed:`, validationResult.error.format());
    throw new Error(`LLM output for ${siteName} failed structural validation.`);
  }

  return validationResult.data;
}

/**
 * Batch processes an array of site items concurrently.
 */
export async function analyzeSiteDataBatch(siteItems, concurrencyLimit = 5) {
  const limit = pLimit(concurrencyLimit);

  const tasks = siteItems.map((item) =>
    limit(async () => {
      try {
        const result = await analyzeSiteData(item.siteName, item.rawData);
        return { status: 'fulfilled', siteName: item.siteName, data: result };
      } catch (error) {
        return { status: 'rejected', siteName: item.siteName, error: error.message };
      }
    })
  );

  return Promise.all(tasks);
}