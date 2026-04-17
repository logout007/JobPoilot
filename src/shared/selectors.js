// ── Resilient selector extraction utility
// Tries a primary CSS selector first, then falls back through alternatives.

/**
 * Extracts text content from a page element using a prioritized selector list.
 * Tries the primary selector first; if it returns empty/null, tries each
 * fallback in order. Logs a warning when a fallback is used.
 *
 * @param {import('puppeteer-core').Page | Element} context - Puppeteer page or element handle to query within.
 * @param {{ primary: string, fallbacks: string[] }} selectors - Selector config with primary and fallback selectors.
 * @param {string} [platform='Unknown'] - Platform name for log messages.
 * @param {string} [field=''] - Field name for log messages.
 * @returns {Promise<string|null>} The trimmed text content, or null if all selectors fail.
 */
export async function extractWithFallback(context, selectors, platform = 'Unknown', field = '') {
  // Try primary selector first
  try {
    const result = await context.$eval(selectors.primary, el => el?.textContent?.trim() || '');
    if (result) return result;
  } catch {
    // Primary selector not found — continue to fallbacks
  }

  // Try each fallback in order
  for (const fallback of selectors.fallbacks) {
    try {
      const result = await context.$eval(fallback, el => el?.textContent?.trim() || '');
      if (result) {
        console.warn(`[${platform}] Fallback selector used for ${field}: "${fallback}" (primary "${selectors.primary}" failed)`);
        return result;
      }
    } catch {
      // Fallback selector not found — try next
    }
  }

  // All selectors failed
  return null;
}

/**
 * Extracts an attribute value from a page element using a prioritized selector list.
 * Useful for extracting href from links.
 *
 * @param {import('puppeteer-core').Page | Element} context - Puppeteer page or element handle.
 * @param {{ primary: string, fallbacks: string[] }} selectors - Selector config.
 * @param {string} attribute - The attribute to extract (e.g. 'href').
 * @param {string} [platform='Unknown'] - Platform name for log messages.
 * @param {string} [field=''] - Field name for log messages.
 * @returns {Promise<string|null>} The attribute value, or null if all selectors fail.
 */
export async function extractAttrWithFallback(context, selectors, attribute, platform = 'Unknown', field = '') {
  // Try primary selector first
  try {
    const result = await context.$eval(selectors.primary, (el, attr) => el?.getAttribute(attr) || '', attribute);
    if (result) return result;
  } catch {
    // Primary selector not found — continue to fallbacks
  }

  // Try each fallback in order
  for (const fallback of selectors.fallbacks) {
    try {
      const result = await context.$eval(fallback, (el, attr) => el?.getAttribute(attr) || '', attribute);
      if (result) {
        console.warn(`[${platform}] Fallback selector used for ${field}: "${fallback}" (primary "${selectors.primary}" failed)`);
        return result;
      }
    } catch {
      // Fallback selector not found — try next
    }
  }

  return null;
}

/**
 * Queries all elements matching a prioritized selector list (for job card containers).
 * Tries the primary selector first; if it returns empty, tries each fallback.
 *
 * @param {import('puppeteer-core').Page} page - Puppeteer page.
 * @param {{ primary: string, fallbacks: string[] }} selectors - Selector config.
 * @param {string} [platform='Unknown'] - Platform name for log messages.
 * @returns {Promise<import('puppeteer-core').ElementHandle[]>} Array of element handles.
 */
export async function queryAllWithFallback(page, selectors, platform = 'Unknown') {
  // Try primary selector first
  let elements = await page.$$(selectors.primary);
  if (elements.length > 0) return elements;

  // Try each fallback in order
  for (const fallback of selectors.fallbacks) {
    elements = await page.$$(fallback);
    if (elements.length > 0) {
      console.warn(`[${platform}] Fallback selector used for jobCard: "${fallback}" (primary "${selectors.primary}" failed)`);
      return elements;
    }
  }

  return [];
}
