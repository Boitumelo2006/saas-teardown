//cleaner.js
/**
 * Sanitizes raw HTML or scraped text into clean, token-efficient raw input.
 * @param {string} rawText 
 * @param {number} maxChars 
 */
export function sanitizeScrapedContent(rawText, maxChars = 40000) {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }

  let cleaned = rawText
    // Remove scripts, styles, and SVG blocks
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Collapse excess whitespace and duplicate newlines
    .replace(/\s+/g, ' ')
    .trim();

  // Enforce max character limit for token budget control
  if (cleaned.length > maxChars) {
    cleaned = cleaned.substring(0, maxChars);
  }

  return cleaned;
}