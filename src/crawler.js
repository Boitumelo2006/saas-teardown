import { chromium } from 'playwright';

const NAVIGATION_TIMEOUT = 12000;
const POST_LOAD_BUFFER = 1500;
const TOTAL_TIMEOUT = 35000;

/**
 * Extracts scripts, metadata, headers, and text from a single open page instance.
 */
async function extractPageDetails(page) {
  const scripts = await page.evaluate(() =>
    Array.from(document.scripts)
      .map((s) => s.src)
      .filter(Boolean)
  );

  const pageData = await page.evaluate(() => {
    const clean = (str) => str?.replace(/\s+/g, ' ').trim() || '';

    const title = document.title || '';
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .map((h) => clean(h.innerText))
      .filter(Boolean);

    // Identify internal target routes from anchor tags
    const internalLinks = Array.from(document.querySelectorAll('a[href]'))
      .map((a) => ({ text: clean(a.innerText), href: a.href }))
      .filter((link) => link.href.startsWith('http'));

    const bodyTextSnippet = clean(document.body?.innerText).substring(0, 8000);

    return { title, headings, internalLinks, bodyTextSnippet };
  });

  return { scripts, pageData };
}

/**
 * Safely visits secondary routes (e.g., pricing, about, features) and extracts text payload.
 */
async function crawlSubpage(page, url, networkRequests) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });
    await page.waitForTimeout(POST_LOAD_BUFFER);

    const { pageData } = await extractPageDetails(page);
    return {
      url,
      success: true,
      title: pageData.title,
      headings: pageData.headings,
      bodyTextSnippet: pageData.bodyTextSnippet
    };
  } catch (err) {
    return { url, success: false, error: err.message };
  }
}

export async function crawlWebsite(targetUrl) {
  const startTime = Date.now();
  const networkRequests = new Set();
  let responseHeaders = {};

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept and sanitize incoming request URLs across all page navigations
  page.on('request', (request) => {
    const cleanUrl = request.url().replace(/[\[\]\(\)]/g, '').trim();
    networkRequests.add(cleanUrl);
  });

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Global crawl timeout exceeded')), TOTAL_TIMEOUT)
    );

    const crawlPromise = (async () => {
      // 1. Crawl Primary Landing Page
      const response = await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: NAVIGATION_TIMEOUT
      });

      if (response) {
        const rawHeaders = response.headers();
        for (const [k, v] of Object.entries(rawHeaders)) {
          responseHeaders[k.toLowerCase()] = v;
        }
      }

      await page.waitForTimeout(POST_LOAD_BUFFER);
      const { scripts: mainScripts, pageData: mainPageData } = await extractPageDetails(page);

      // 2. Discover Secondary Target Links (Pricing, About, Features, Plans)
      const targetDomain = new URL(targetUrl).hostname.replace(/^www\./, '');
      const subpageCandidates = mainPageData.internalLinks.filter((link) => {
        try {
          const linkUrl = new URL(link.href);
          const isSameDomain = linkUrl.hostname.replace(/^www\./, '') === targetDomain;
          const isTargetRoute = /pricing|plans|costs|billing|about|features|product/i.test(
            `${linkUrl.pathname} ${link.text}`
          );
          return isSameDomain && isTargetRoute && linkUrl.pathname !== '/';
        } catch {
          return false;
        }
      });

      // Deduplicate target URLs and limit to top 2 secondary pages
      const uniqueSubpageUrls = Array.from(
        new Set(subpageCandidates.map((c) => c.href.split('#')[0]))
      ).slice(0, 2);

      // 3. Crawl Discovered Subpages
      const subpageResults = [];
      for (const subUrl of uniqueSubpageUrls) {
        const subData = await crawlSubpage(page, subUrl, networkRequests);
        subpageResults.push(subData);
      }

      return {
        scripts: mainScripts,
        mainPageData,
        subpages: subpageResults
      };
    })();

    const { scripts, mainPageData, subpages } = await Promise.race([crawlPromise, timeoutPromise]);
    const endTime = Date.now();

    await browser.close();

    return {
      success: true,
      latencyMs: endTime - startTime,
      rawEvidence: {
        networkRequests: Array.from(networkRequests),
        responseHeaders,
        scripts,
        pageData: {
          title: mainPageData.title,
          headings: mainPageData.headings,
          bodyTextSnippet: mainPageData.bodyTextSnippet
        },
        subpages
      }
    };
  } catch (error) {
    await browser.close();
    return {
      success: false,
      error: error.message,
      latencyMs: Date.now() - startTime
    };
  }
}