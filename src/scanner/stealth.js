// ── Shared stealth / anti-detection helpers used by every scraper.

/**
 * Applies stealth settings to a Puppeteer page:
 * - Realistic user-agent string
 * - Accept-Language header
 * - Blocks images, fonts, and media to save bandwidth
 *
 * @param {import('puppeteer-core').Page} page
 */
export async function stealthPage(page) {
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-IN,en;q=0.9' });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    if (['image', 'font', 'media'].includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });
}

/**
 * Scrolls the page down `times` times with a 1.2 s pause between scrolls.
 *
 * @param {import('puppeteer-core').Page} page
 * @param {number} [times=3]
 */
export async function autoScroll(page, times = 3) {
  for (let i = 0; i < times; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
    await delay(1200);
  }
}

/**
 * Types text into a selector with a random human-like delay per character.
 * Delay is between 60 and 110 ms per character.
 *
 * @param {import('puppeteer-core').Page} page
 * @param {string} selector - CSS selector for the input element.
 * @param {string} text - Text to type.
 */
export async function humanType(page, selector, text) {
  await page.waitForSelector(selector);
  await page.click(selector);
  const charDelay = Math.floor(Math.random() * 50) + 60; // 60–110 ms
  await page.type(selector, text, { delay: charDelay });
}

/**
 * Returns a promise that resolves after `ms` milliseconds.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
