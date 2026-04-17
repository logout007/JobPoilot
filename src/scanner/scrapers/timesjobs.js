// ── TimesJobs scraper

import { stealthPage, delay } from '../stealth.js';

const SCRAPER_TIMEOUT_MS = 45_000;

export const SELECTORS = {
  jobCard: {
    primary: '.job-bx',
    fallbacks: ['li.clearfix'],
  },
  title: {
    primary: '.jobTitle',
    fallbacks: ['h2 a'],
  },
  company: {
    primary: '.jobComp',
    fallbacks: ['h3.joblist-comp-name'],
  },
  location: {
    primary: '.location',
    fallbacks: ['.loc'],
  },
  salary: {
    primary: '.salary',
    fallbacks: [],
  },
  url: {
    primary: 'h2 a',
    fallbacks: ['.jobTitle'],
  },
  postedDate: {
    primary: '.sim-posted',
    fallbacks: ['.posted', '[class*="date"]', 'span[class*="posted"]'],
  },
};

/**
 * Scrapes TimesJobs job listings.
 * @param {import('puppeteer-core').Browser} browser
 * @param {object} credentials — not used for TimesJobs (public scrape)
 * @returns {Promise<Array<object>>}
 */
export default async function scrape(browser, credentials) {
  const page = await browser.newPage();
  await stealthPage(page);

  try {
    await page.goto(
      'https://www.timesjobs.com/candidate/job-search.html?searchType=personalizedSearch&from=submit&txtKeywords=full+stack+developer',
      { waitUntil: 'domcontentloaded', timeout: SCRAPER_TIMEOUT_MS },
    );
    await delay(2000);

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

      return Array.from(document.querySelectorAll('.job-bx, li.clearfix'))
        .slice(0, 25)
        .map((card) => {
          const titleEl = card.querySelector('.jobTitle, h2 a');
          const companyEl = card.querySelector('.jobComp, h3.joblist-comp-name');
          const locEl = card.querySelector('.location, .loc');
          const salaryEl = card.querySelector('.salary');
          const linkEl = card.querySelector('h2 a, .jobTitle');
          const dateEl = card.querySelector(
            '.sim-posted, .posted, [class*="date"], span[class*="posted"]',
          );

          const dateText = dateEl?.textContent?.trim() || '';
          const href = linkEl?.href || '';
          const jobId =
            href.match(/\/job\/([a-zA-Z0-9-]+)/)?.[1] ||
            href.match(/jobid=([a-zA-Z0-9-]+)/)?.[1] ||
            `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          return {
            jobId: `tj-${jobId}`,
            title: titleEl?.textContent?.trim() || '',
            company: companyEl?.textContent?.trim() || '',
            location: locEl?.textContent?.trim() || '',
            salary: salaryEl?.textContent?.trim() || '',
            url: href,
            platform: 'TimesJobs',
            postedDate: parsePostedDate(dateText),
          };
        })
        .filter((j) => j.title && j.company && j.jobId);
    });

    // Validate: filter out jobs missing title or url (Req 10.3, 10.4)
    const validJobs = jobs.filter((j) => {
      if (!j.title || !j.url) {
        console.log(`[TimesJobs] Discarded job ${j.jobId}: missing ${!j.title ? 'title' : ''}${!j.title && !j.url ? ', ' : ''}${!j.url ? 'url' : ''}`);
        return false;
      }
      return true;
    });

    console.log(`[TimesJobs] ${validJobs.length} valid jobs found (${jobs.length - validJobs.length} discarded)`);
    return validJobs;
  } catch (error) {
    console.error('[TimesJobs] Scraper failed:', error.message);
    console.error('[TimesJobs] Stack trace:', error.stack);
    return [];
  } finally {
    await page.close().catch((e) => console.error('[TimesJobs] Page close error:', e));
  }
}
