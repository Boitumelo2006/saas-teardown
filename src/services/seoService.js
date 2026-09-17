import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Fetch domain authority using Open PageRank (Free)
 */
async function getDomainAuthority(domain) {
  try {
    const response = await axios.get(
      `https://openpagerank.com/api/v1.0/getPageRank?domains[]=${domain}`,
      {
        headers: { 'API-OPR-PK': process.env.OPEN_PAGERANK_KEY }
      }
    );
    const data = response.data?.response?.[0];
    return {
      rank: data?.page_rank_integer || 0,
      decimalRank: data?.page_rank_decimal || 0
    };
  } catch (error) {
    console.warn('Open PageRank lookup failed:', error.message);
    return { rank: 0, decimalRank: 0 };
  }
}

/**
 * Fetch organic search presence via SerpApi
 */
async function getSearchPresence(domain) {
  if (!process.env.SERPAPI_KEY) return { organicResultsCount: 0, topKeywords: [] };
  
  try {
    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google',
        q: `site:${domain}`,
        api_key: process.env.SERPAPI_KEY
      }
    });

    const organic = response.data?.organic_results || [];
    return {
      organicResultsCount: response.data?.search_information?.total_results || organic.length,
      topKeywords: organic.slice(0, 5).map(item => item.title)
    };
  } catch (error) {
    console.warn('SerpApi lookup failed:', error.message);
    return { organicResultsCount: 0, topKeywords: [] };
  }
}

/**
 * Main SEO Service Export
 */
export async function analyzeSEO(domain) {
  const [authority, searchPresence] = await Promise.all([
    getDomainAuthority(domain),
    getSearchPresence(domain)
  ]);

  return {
    domain,
    authorityScore: authority.rank,
    estimatedIndexedPages: searchPresence.organicResultsCount,
    sampleHeadlines: searchPresence.topKeywords
  };
}