import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import pLimit from 'p-limit';
import { z } from 'zod';
import { sanitizeScrapedContent } from './cleaner.js';

const ai = new GoogleGenAI();

// Zod Schema for output validation
const SiteAnalysisSchema = z.object({
  company_name: z.string().default('Unknown Company'),
  value_proposition: z.string().default('N/A'),
  observed_facts: z.array(
    z.object({
      fact: z.string(),
      evidence: z.string(),
    })
  ).default([]),
  pricing_plans: z.array(
    z.object({
      plan: z.string(),
      price: z.string().optional().default('Contact for pricing'),
      features: z.array(z.string()).default([]),
    })
  ).default([]),
  detected_technologies: z.array(
    z.object({
      name: z.string(),
      category: z.string().optional().default('Uncategorized'),
    })
  ).default([]),
  analytical_insights: z.array(z.string()).default([]),
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
 * Analyzes a single site's scraped payload with pre-sanitization.
 */
export async function analyzeSiteData(siteName, rawOutput) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  // 1. Sanitize raw scraping input to control token budget & noise
  const sanitizedInput = typeof rawOutput === 'string' 
    ? sanitizeScrapedContent(rawOutput)
    : sanitizeScrapedContent(JSON.stringify(rawOutput));

  if (!sanitizedInput) {
    throw new Error(`Scraped content for ${siteName} is empty or unreadable.`);
  }

  const userContent = JSON.stringify({
    siteName,
    rawData: sanitizedInput,
  });

  const systemInstruction = `You are an exceptionally accurate SaaS competitive intelligence and site data extraction engine.

CRITICAL GROUNDING INSTRUCTIONS FOR EVIDENCE:
1. Every 'evidence' string inside 'observed_facts' MUST be an exact, word-for-word, verbatim excerpt from the provided raw site text.
2. Never summarize, rephrase, correct, or clean up punctuation in the 'evidence' field.
3. If an accurate verbatim excerpt cannot be extracted directly, do not invent or rephrase one.

CRITICAL INSTRUCTIONS FOR TECHNOLOGIES:
1. Only extract technologies that are explicitly listed or verified within the raw input payload. Do not invent or infer unverified stack components.`;

  const response = await callGeminiWithRetry({
    model,
    contents: userContent,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          company_name: { type: 'STRING' },
          value_proposition: { type: 'STRING' },
          observed_facts: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                fact: { type: 'STRING' },
                evidence: { type: 'STRING' },
              },
              required: ['fact', 'evidence'],
            },
          },
          pricing_plans: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                plan: { type: 'STRING' },
                price: { type: 'STRING' },
                features: {
                  type: 'ARRAY',
                  items: { type: 'STRING' },
                },
              },
              required: ['plan'],
            },
          },
          detected_technologies: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                category: { type: 'STRING' },
              },
              required: ['name'],
            },
          },
          analytical_insights: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
        },
        required: [
          'company_name',
          'value_proposition',
          'observed_facts',
          'pricing_plans',
          'detected_technologies',
          'analytical_insights',
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