// ── Shine scraper

import { stealthPage, delay } from '../stealth.js';

const SCRAPER_TIMEOUT_MS = 45_000;

export const SELECTORS = {
  jobCard: {
    primary: '[class*="jobCard"]',
    fallbacks: ['[class*="job-card"]', '.job-card', '.jobCard'],
  },
  title: {
    primary: '[class*="jobTitle"]',
    fallbacks: ['[class*="job-title"]', '.job-title', '.jobTitle'],
  },
  company: {
    primary: '[class*="companyName"]',
    fallbacks: ['[class*="company-name"]', '.company-name', '.companyName'],
  },
  location: {
    primary: '[class*="location"]',
    fallbacks: ['.location'],
  },
  salary: {
    primary: '[class*="salary"]',
    fallbacks: ['.salary'],
  },
  url: {
    primary: 'a',
    fallbacks: [],
  },
  postedDate: {
    primary: '[class*="date"]',
    fallbacks: ['[class*="posted"]', '.date', '.posted-date'],
  },
};

/**
 * Scrapes Shine job listings.
 * @param {import('puppeteer-core').Browser} browser
 * @param {{ shine?: { email: string, password: string } }} credentials
 * @returns {Promise<Array<object>>}
 */
export default async function scrape(browser, credentials) {
  const page = await browser.newPage();
  await stealthPage(page);

  try {
    await page.goto('https://www.shine.com/job-search/full-stack-developer-jobs', {
      waitUntil: 'domcontentloaded',
      timeout: SCRAPER_TIMEOUT_MS,
    });
    await delay(2000);

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
        if (hoursMatch) now.setHours(now.getHours() - parseInt(hoursMatch[1]));
        else if (daysMatch) now.setDate(now.getDate() - parseInt(daysMatch[1]));
        else if (text.includes('30+')) now.setDate(now.getDate() - 30);
        return now.toISOString().split('T')[0];
      };

      return Array.from(
        document.querySelectorAll(
          '[class*="jobCard"], [class*="job-card"], .job-card, .jobCard',
        ),
      )
        .slice(0, 25)
        .map((card) => {
          const titleEl = card.querySelector(
            '[class*="jobTitle"], [class*="job-title"], .job-title, .jobTitle',
          );
          const companyEl = card.querySelector(
            '[class*="companyName"], [class*="company-name"], .company-name, .companyName',
          );
          const locEl = card.querySelector('[class*="location"], .location');
          const salaryEl = card.querySelector('[class*="salary"], .salary');
          const linkEl = card.querySelector('a');
          const dateEl = card.querySelector(
            '[class*="date"], [class*="posted"], .date, .posted-date',
          );

          const dateText = dateEl?.textContent || '';
          const jobId =
            linkEl?.href?.match(/job\/([a-zA-Z0-9-]+)/)?.[1] ||
            `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          return {
            jobId: `sh-${jobId}`,
            title: titleEl?.textContent?.trim() || '',
            company: companyEl?.textContent?.trim() || '',
            location: locEl?.textContent?.trim() || '',
            salary: salaryEl?.textContent?.trim() || '',
            url: linkEl?.href || '',
            platform: 'Shine',
            postedDate: parsePostedDate(dateText),
          };
        })
        .filter((j) => j.title && j.company && j.jobId);
    });

    // Validate: filter out jobs missing title or url (Req 10.3, 10.4)
    const validJobs = jobs.filter((j) => {
      if (!j.title || !j.url) {
        console.log(`[Shine] Discarded job ${j.jobId}: missing ${!j.title ? 'title' : ''}${!j.title && !j.url ? ', ' : ''}${!j.url ? 'url' : ''}`);
        return false;
      }
      return true;
    });

    console.log(`[Shine] ${validJobs.length} valid jobs found (${jobs.length - validJobs.length} discarded)`);
    return validJobs;
  } catch (error) {
    console.error('[Shine] Scraper failed:', error.message);
    console.error('[Shine] Stack trace:', error.stack);
    return [];
  } finally {
    await page.close().catch((e) => console.error('[Shine] Page close error:', e));
  }
}
