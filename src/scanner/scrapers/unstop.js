// ── Unstop scraper

import { stealthPage, autoScroll, delay } from '../stealth.js';

const SCRAPER_TIMEOUT_MS = 45_000;

export const SELECTORS = {
  jobCard: {
    primary: '[class*="opportunity_opportunity"]',
    fallbacks: ['[class*="card"]', '.job-card', '[data-opportunity-id]'],
  },
  title: {
    primary: '[class*="title"]',
    fallbacks: ['h3', 'h4', 'a[class*="heading"]'],
  },
  company: {
    primary: '[class*="company"]',
    fallbacks: ['[class*="organization"]', '[class*="employer"]'],
  },
  location: {
    primary: '[class*="location"]',
    fallbacks: ['[class*="city"]'],
  },
  salary: {
    primary: '[class*="salary"]',
    fallbacks: ['[class*="stipend"]', '[class*="compensation"]'],
  },
  url: {
    primary: 'a[href*="/jobs/"]',
    fallbacks: ['a[href*="/opportunity/"]'],
  },
  postedDate: {
    primary: '[class*="posted"]',
    fallbacks: ['[class*="date"]', '[class*="time"]', 'time'],
  },
};

/**
 * Scrapes Unstop job listings.
 * @param {import('puppeteer-core').Browser} browser
 * @param {object} credentials — not used for Unstop (public scrape)
 * @returns {Promise<Array<object>>}
 */
export default async function scrape(browser, credentials) {
  const page = await browser.newPage();
  await stealthPage(page);

  try {
    await page.goto('https://unstop.com/jobs', {
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
        const hoursMatch = text.match(/(\d+)\s*hour/);
        const daysMatch = text.match(/(\d+)\s*day/);
        const weeksMatch = text.match(/(\d+)\s*week/);
        const monthsMatch = text.match(/(\d+)\s*month/);
        if (hoursMatch) now.setHours(now.getHours() - parseInt(hoursMatch[1]));
        else if (daysMatch) now.setDate(now.getDate() - parseInt(daysMatch[1]));
        else if (weeksMatch) now.setDate(now.getDate() - parseInt(weeksMatch[1]) * 7);
        else if (monthsMatch) now.setMonth(now.getMonth() - parseInt(monthsMatch[1]));
        return now.toISOString().split('T')[0];
      };

      return Array.from(
        document.querySelectorAll(
          '[class*="opportunity_opportunity"], [class*="card"], .job-card, [data-opportunity-id]',
        ),
      )
        .slice(0, 25)
        .map((card) => {
          const titleEl = card.querySelector(
            '[class*="title"], h3, h4, a[class*="heading"]',
          );
          const companyEl = card.querySelector(
            '[class*="company"], [class*="organization"], [class*="employer"]',
          );
          const locEl = card.querySelector('[class*="location"], [class*="city"]');
          const salaryEl = card.querySelector(
            '[class*="salary"], [class*="stipend"], [class*="compensation"]',
          );
          const linkEl = card.querySelector(
            'a[href*="/jobs/"], a[href*="/opportunity/"]',
          );
          const dateEl = card.querySelector(
            '[class*="posted"], [class*="date"], [class*="time"], time',
          );

          const href = linkEl?.href || '';
          const jobIdMatch = href.match(/\/jobs\/(\d+)|\/opportunity\/([^\/]+)/);
          const jobId = jobIdMatch
            ? jobIdMatch[1] || jobIdMatch[2]
            : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const dateText =
            dateEl?.textContent || dateEl?.getAttribute('datetime') || '';

          return {
            jobId: `us-${jobId}`,
            title: titleEl?.textContent?.trim() || '',
            company: companyEl?.textContent?.trim() || '',
            location: locEl?.textContent?.trim() || 'India',
            salary: salaryEl?.textContent?.trim() || '',
            url: href.startsWith('http') ? href : `https://unstop.com${href}`,
            platform: 'Unstop',
            postedDate: parsePostedDate(dateText),
          };
        })
        .filter((j) => j.title && j.company && j.jobId);
    });

    // Validate: filter out jobs missing title or url (Req 10.3, 10.4)
    const validJobs = jobs.filter((j) => {
      if (!j.title || !j.url) {
        console.log(`[Unstop] Discarded job ${j.jobId}: missing ${!j.title ? 'title' : ''}${!j.title && !j.url ? ', ' : ''}${!j.url ? 'url' : ''}`);
        return false;
      }
      return true;
    });

    console.log(`[Unstop] ${validJobs.length} valid jobs found (${jobs.length - validJobs.length} discarded)`);
    return validJobs;
  } catch (error) {
    console.error('[Unstop] Scraper failed:', error.message);
    console.error('[Unstop] Stack trace:', error.stack);
    return [];
  } finally {
    await page.close().catch((e) => console.error('[Unstop] Page close error:', e));
  }
}
