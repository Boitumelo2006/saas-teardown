import * as cheerio from 'cheerio';

/**
 * Extracts social media URLs from page anchor links or raw HTML string.
 */
export function extractSocialMedia(links = [], html = '') {
  const socials = {
    twitter: null,
    linkedin: null,
    github: null,
    youtube: null,
    facebook: null,
    instagram: null,
  };

  // 1. Scan structured link objects extracted by Playwright
  links.forEach((link) => {
    const href = link.href || link;
    if (typeof href !== 'string') return;

    if (!socials.twitter && /(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/i.test(href)) {
      if (!href.includes('/intent/') && !href.includes('/share')) socials.twitter = href;
    } else if (!socials.linkedin && /linkedin\.com\/(company|in)\/([a-zA-Z0-9_-]+)/i.test(href)) {
      socials.linkedin = href;
    } else if (!socials.github && /github\.com\/([a-zA-Z0-9_-]+)/i.test(href)) {
      socials.github = href;
    } else if (!socials.youtube && /youtube\.com\/(c|channel|user|@)/i.test(href)) {
      socials.youtube = href;
    } else if (!socials.facebook && /facebook\.com\/([a-zA-Z0-9_.-]+)/i.test(href)) {
      if (!href.includes('/sharer')) socials.facebook = href;
    } else if (!socials.instagram && /instagram\.com\/([a-zA-Z0-9_.-]+)/i.test(href)) {
      socials.instagram = href;
    }
  });

  // 2. Fallback HTML parsing with Cheerio if raw HTML string provided
  if (html && Object.values(socials).every((val) => val === null)) {
    const $ = cheerio.load(html);
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      if (!socials.twitter && /(twitter\.com|x\.com)\//i.test(href)) socials.twitter = href;
      if (!socials.linkedin && /linkedin\.com\//i.test(href)) socials.linkedin = href;
      if (!socials.github && /github\.com\//i.test(href)) socials.github = href;
      if (!socials.youtube && /youtube\.com\//i.test(href)) socials.youtube = href;
    });
  }

  return socials;
}