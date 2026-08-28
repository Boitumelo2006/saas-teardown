import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import pLimit from 'p-limit';
import { z } from 'zod';
import { sanitizeScrapedContent } from './cleaner.js';

const ai = new GoogleGenAI();

// Zod Schema for output validation matching dashboard expectations
const SiteAnalysisSchema = z.object({
  businessSummary: z.string().default('N/A'),
  techStack: z.array(z.string()).default([]),
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
        `Headings: ${s.headings?.slice(0, 5).join(' | ') || 'None'}\n` +
        `Snippet: ${s.bodyTextSnippet?.substring(0, 2500) || 'None'}`
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

  // Extract structured subpage data if rawOutput is an object from crawler.js
  if (typeof rawOutput === 'object' && rawOutput !== null) {
    if (rawOutput.rawEvidence?.subpages) {
      subpagesContext = formatSubpages(rawOutput.rawEvidence.subpages);
    }
  }

  // 1. Sanitize raw scraping input to control token budget & noise
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

  const systemInstruction = `You are an expert SaaS competitive intelligence analyst. Analyze the scraped web data, subpage evidence (e.g. pricing, about, features), and technology stack for the requested target site.

CRITICAL INSTRUCTIONS:
1. Generate a comprehensive executive business summary covering value proposition, monetization strategy, and target persona using both primary landing page content and discovered subpage evidence.
2. Extract or infer key technical/architectural insights, actionable growth recommendations, and direct market competitors based on all scraped evidence.
3. Keep the JSON responses concise, high-value, and accurate to the scraped evidence.`;

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
          techStack: {
            type: 'ARRAY',
            items: { type: 'STRING' },
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
          'techStack',
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