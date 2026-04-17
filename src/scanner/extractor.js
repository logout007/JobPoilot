// ── Job description extraction helper for the scanner pipeline.

/**
 * Extracts the job description text from a page.
 * Tries multiple common selectors, falls back to body text,
 * and limits the result to 5 000 characters.
 *
 * @param {import('puppeteer-core').Page} page - Puppeteer page instance.
 * @returns {Promise<string>} The extracted description, or '' on failure.
 */
export async function extractJobDescription(page) {
  try {
    // Common selectors for job description sections
    const selectors = [
      '.description',
      '[data-job-description]',
      '.job-details',
      '.job-description',
      '#job-description',
      '[class*="description"]',
      '[class*="job-details"]',
      '.jobsearch-jobDescriptionText', // Indeed
      '.show-more-less-html',          // LinkedIn
      '.job_description',              // Naukri
      '[data-testid="job-description"]',
      '.content',
      'article',
      'main',
    ];

    let description = '';

    // Try each selector until we find meaningful content
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await page.evaluate(el => el.innerText || el.textContent, element);
          if (text && text.trim().length > 50) {
            description = text.trim();
            break;
          }
        }
      } catch (_err) {
        // Continue to next selector
        continue;
      }
    }

    // Fallback: strip nav/header/footer and grab body text
    if (!description) {
      description = await page.evaluate(() => {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll('script, style, nav, header, footer, aside').forEach(el => el.remove());
        return clone.innerText || clone.textContent || '';
      });
    }

    // Limit to 5000 characters
    if (description.length > 5000) {
      description = description.substring(0, 5000);
    }

    console.log(`[JobDescription] Extracted ${description.length} characters`);
    return description;
  } catch (error) {
    console.error('[JobDescription] Extraction failed:', error.message);
    return '';
  }
}
