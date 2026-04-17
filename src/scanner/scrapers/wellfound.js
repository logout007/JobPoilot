// ── Wellfound (AngelList) scraper

import { stealthPage, autoScroll, delay } from '../stealth.js';

const SCRAPER_TIMEOUT_MS = 45_000;

export const SELECTORS = {
  jobCard: {
    primary: '[data-test="JobSearchResult"]',
    fallbacks: ['.job-listing', '[class*="job"]', '[class*="JobListing"]', 'a[href*="/role/"]'],
  },
  title: {
    primary: '.job-title',
    fallbacks: ['h2', '[class*="title"]', '[class*="Title"]'],
  },
  company: {
    primary: '.company-name',
    fallbacks: ['.startup-name', '[class*="company"]', '[class*="Company"]'],
  },
  location: {
    primary: '.location',
    fallbacks: ['[class*="location"]', '[class*="Location"]'],
  },
  salary: {
    primary: '.salary',
    fallbacks: ['[class*="salary"]', '[class*="Salary"]', '[class*="compensation"]'],
  },
  url: {
    primary: 'a',
    fallbacks: [],
  },
  postedDate: {
    primary: '.date',
    fallbacks: ['[class*="date"]', '[class*="posted"]', '[class*="Posted"]'],
  },
};

/**
 * Scrapes Wellfound job listings.
 * @param {import('puppeteer-core').Browser} browser
 * @param {object} credentials — not used for Wellfound (public scrape)
 * @returns {Promise<Array<object>>}
 */
export default async function scrape(browser, credentials) {
  const page = await browser.newPage();
  await stealthPage(page);

  try {
    // Enhanced stealth techniques to avoid bot detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      window.chrome = { runtime: {} };
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);
    });

    await page.goto('https://wellfound.com/jobs', {
      waitUntil: 'networkidle2',
      timeout: SCRAPER_TIMEOUT_MS,
    });
    await delay(3500);
    await autoScroll(page, 3);

    const pageTitle = await page.title();
    console.log(`[Wellfound Debug] Title: ${pageTitle}`);

    const jobs = await page.evaluate(() => {
      const parsePostedDate = (dateText) => {
        if (!dateText) return new Date().toISOString().split('T')[0];
        const text = dateText.toLowerCase().trim();
        const now = new Date();
        if (text.includes('just posted') || text.includes('today')) {
          return now.toISOString().split('T')[0];
        }
        const daysMatch = text.match(/(\d+)\s*day/);
        const hoursMatch = text.match(/(\d+)\s*hour/);
        const weeksMatch = text.match(/(\d+)\s*week/);
        const monthsMatch = text.match(/(\d+)\s*month/);
        if (hoursMatch) now.setHours(now.getHours() - parseInt(hoursMatch[1]));
        else if (daysMatch) now.setDate(now.getDate() - parseInt(daysMatch[1]));
        else if (weeksMatch) now.setDate(now.getDate() - parseInt(weeksMatch[1]) * 7);
        else if (monthsMatch) now.setMonth(now.getMonth() - parseInt(monthsMatch[1]));
        else if (text.includes('30+')) now.setDate(now.getDate() - 30);
        return now.toISOString().split('T')[0];
      };

      const jobCards = Array.from(
        document.querySelectorAll(
          '[data-test="JobSearchResult"], .job-listing, [class*="job"], [class*="JobListing"], a[href*="/role/"]',
        ),
      );

      console.log(`[Wellfound Debug] Cards found: ${jobCards.length}`);

      return jobCards
        .slice(0, 25)
        .map((card) => {
          const titleEl = card.querySelector(
            '.job-title, h2, [class*="title"], [class*="Title"]',
          );
          const companyEl = card.querySelector(
            '.company-name, .startup-name, [class*="company"], [class*="Company"]',
          );
          const locEl = card.querySelector(
            '.location, [class*="location"], [class*="Location"]',
          );
          const salaryEl = card.querySelector(
            '.salary, [class*="salary"], [class*="Salary"], [class*="compensation"]',
          );
          const linkEl = card.querySelector('a') || card;
          const dateEl = card.querySelector(
            '.date, [class*="date"], [class*="posted"], [class*="Posted"]',
          );

          const dateText = dateEl?.textContent || '';
          const href = linkEl?.href || '';
          const jobId =
            href.match(/\/role\/([a-zA-Z0-9-]+)/)?.[1] ||
            href.match(/\/jobs\/([a-zA-Z0-9-]+)/)?.[1] ||
            `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          return {
            jobId: `wf-${jobId}`,
            title: titleEl?.textContent?.trim() || '',
            company: companyEl?.textContent?.trim() || '',
            location: locEl?.textContent?.trim() || 'Remote',
            salary: salaryEl?.textContent?.trim() || '',
            url: href || '',
            platform: 'Wellfound',
            postedDate: parsePostedDate(dateText),
          };
        })
        .filter((j) => j.title && j.company && j.jobId);
    });

    if (jobs.length === 0) {
      const bodySnippet = await page.evaluate(() =>
        document.body.innerText.substring(0, 300),
      );
      console.log(`[Wellfound] No jobs found. Body snippet: ${bodySnippet}`);
    }

    // Validate: filter out jobs missing title or url (Req 10.3, 10.4)
    const validJobs = jobs.filter((j) => {
      if (!j.title || !j.url) {
        console.log(`[Wellfound] Discarded job ${j.jobId}: missing ${!j.title ? 'title' : ''}${!j.title && !j.url ? ', ' : ''}${!j.url ? 'url' : ''}`);
        return false;
      }
      return true;
    });

    console.log(`[Wellfound] ${validJobs.length} valid jobs found (${jobs.length - validJobs.length} discarded)`);
    return validJobs;
  } catch (error) {
    console.error('[Wellfound] Scraper failed:', error.message);
    console.error('[Wellfound] Stack trace:', error.stack);
    return [];
  } finally {
    await page.close().catch((e) => console.error('[Wellfound] Page close error:', e));
  }
}
