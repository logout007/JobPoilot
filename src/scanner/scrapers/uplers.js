// ── Uplers scraper

import { stealthPage, autoScroll, delay } from '../stealth.js';

const SCRAPER_TIMEOUT_MS = 45_000;

export const SELECTORS = {
  jobCard: {
    primary: '[class*="company"]',
    fallbacks: ['[class*="job"]', '.card', '[data-company-id]'],
  },
  title: {
    primary: '[class*="title"]',
    fallbacks: ['h2', 'h3', 'h4', 'a[class*="heading"]'],
  },
  company: {
    primary: '[class*="company"]',
    fallbacks: ['[class*="name"]'],
  },
  location: {
    primary: '[class*="location"]',
    fallbacks: ['[class*="city"]'],
  },
  salary: {
    primary: '[class*="salary"]',
    fallbacks: ['[class*="compensation"]'],
  },
  url: {
    primary: 'a[href*="/company/"]',
    fallbacks: ['a[href*="/job"]'],
  },
  postedDate: {
    primary: '[class*="posted"]',
    fallbacks: ['[class*="date"]', 'time'],
  },
};

/**
 * Scrapes Uplers job listings.
 * @param {import('puppeteer-core').Browser} browser
 * @param {object} credentials — not used for Uplers (public scrape)
 * @returns {Promise<Array<object>>}
 */
export default async function scrape(browser, credentials) {
  const page = await browser.newPage();
  await stealthPage(page);

  try {
    await page.goto('https://www.uplers.com/all/', {
      waitUntil: 'domcontentloaded',
      timeout: SCRAPER_TIMEOUT_MS,
    });
    await delay(2000);
    await autoScroll(page, 3);

    const jobs = await page.evaluate(() => {
      const parsePostedDate = (dateText) => {
        if (!dateText) return new Date().toISOString().split('T')[0];
        const text = dateText.toLowerCase().trim();
        const now = new Date();
        const daysMatch = text.match(/(\d+)\s*day/);
        const weeksMatch = text.match(/(\d+)\s*week/);
        const monthsMatch = text.match(/(\d+)\s*month/);
        if (daysMatch) now.setDate(now.getDate() - parseInt(daysMatch[1]));
        else if (weeksMatch) now.setDate(now.getDate() - parseInt(weeksMatch[1]) * 7);
        else if (monthsMatch) now.setMonth(now.getMonth() - parseInt(monthsMatch[1]));
        return now.toISOString().split('T')[0];
      };

      return Array.from(
        document.querySelectorAll(
          '[class*="company"], [class*="job"], .card, [data-company-id]',
        ),
      )
        .slice(0, 25)
        .map((card) => {
          const titleEl = card.querySelector(
            '[class*="title"], h2, h3, h4, a[class*="heading"]',
          );
          const companyEl = card.querySelector('[class*="company"], [class*="name"]');
          const locEl = card.querySelector('[class*="location"], [class*="city"]');
          const salaryEl = card.querySelector(
            '[class*="salary"], [class*="compensation"]',
          );
          const linkEl = card.querySelector('a[href*="/company/"], a[href*="/job"]');
          const dateEl = card.querySelector(
            '[class*="posted"], [class*="date"], time',
          );

          const href = linkEl?.href || '';
          const jobIdMatch = href.match(/\/company\/([^\/]+)|\/job\/([^\/]+)/);
          const jobId = jobIdMatch
            ? jobIdMatch[1] || jobIdMatch[2]
            : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const dateText =
            dateEl?.textContent || dateEl?.getAttribute('datetime') || '';

          // Filter for tech/developer roles
          const title = titleEl?.textContent?.trim() || '';
          const isRelevant =
            title &&
            (title.toLowerCase().includes('developer') ||
              title.toLowerCase().includes('engineer') ||
              title.toLowerCase().includes('node') ||
              title.toLowerCase().includes('full stack') ||
              title.toLowerCase().includes('backend') ||
              title.toLowerCase().includes('frontend') ||
              title.toLowerCase().includes('react') ||
              title.toLowerCase().includes('typescript'));

          if (!isRelevant) return null;

          return {
            jobId: `up-${jobId}`,
            title,
            company: companyEl?.textContent?.trim() || 'Uplers Client',
            location: locEl?.textContent?.trim() || 'Remote',
            salary: salaryEl?.textContent?.trim() || '',
            url: href.startsWith('http') ? href : `https://www.uplers.com${href}`,
            platform: 'Uplers',
            postedDate: parsePostedDate(dateText),
          };
        })
        .filter((j) => j && j.title && j.company && j.jobId);
    });

    // Validate: filter out jobs missing title or url (Req 10.3, 10.4)
    const validJobs = jobs.filter((j) => {
      if (!j.title || !j.url) {
        console.log(`[Uplers] Discarded job ${j.jobId}: missing ${!j.title ? 'title' : ''}${!j.title && !j.url ? ', ' : ''}${!j.url ? 'url' : ''}`);
        return false;
      }
      return true;
    });

    console.log(`[Uplers] ${validJobs.length} valid jobs found (${jobs.length - validJobs.length} discarded)`);
    return validJobs;
  } catch (error) {
    console.error('[Uplers] Scraper failed:', error.message);
    console.error('[Uplers] Stack trace:', error.stack);
    return [];
  } finally {
    await page.close().catch((e) => console.error('[Uplers] Page close error:', e));
  }
}
