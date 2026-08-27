import { chromium } from 'playwright';

const NAVIGATION_TIMEOUT = 15000;
const POST_LOAD_BUFFER = 3000;
const TOTAL_TIMEOUT = 30000;

export async function crawlWebsite(targetUrl) {
  const startTime = Date.now();
  const networkRequests = new Set();
  let responseHeaders = {};

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept and sanitize incoming request URLs
  page.on('request', (request) => {
    const cleanUrl = request.url().replace(/[\[\]\(\)]/g, '').trim();
    networkRequests.add(cleanUrl);
  });

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Global crawl timeout exceeded')), TOTAL_TIMEOUT)
    );

    const crawlPromise = (async () => {
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

      // Extract script tags directly from the DOM tree
      const scripts = await page.evaluate(() =>
        Array.from(document.scripts)
          .map((s) => s.src)
          .filter(Boolean)
      );

      // Extract clean DOM text and metadata
      const pageData = await page.evaluate(() => {
        const clean = (str) => str?.replace(/\s+/g, ' ').trim() || '';

        const title = document.title || '';
        const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
          .map((h) => clean(h.innerText))
          .filter(Boolean);

        const pricingLinks = Array.from(document.querySelectorAll('a'))
          .filter((a) => /pricing|plans|costs|billing/i.test(`${a.href} ${a.innerText}`))
          .map((a) => ({ text: clean(a.innerText), href: a.href }));

        const bodyTextSnippet = clean(document.body?.innerText).substring(0, 12000);

        return { title, headings, pricingLinks, bodyTextSnippet };
      });

      return { scripts, pageData };
    })();

    const { scripts, pageData } = await Promise.race([crawlPromise, timeoutPromise]);
    const endTime = Date.now();

    await browser.close();

    return {
      success: true,
      latencyMs: endTime - startTime,
      rawEvidence: {
        networkRequests: Array.from(networkRequests),
        responseHeaders,
        scripts,
        pageData
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