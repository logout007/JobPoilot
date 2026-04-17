// ── Naukri scraper

import { stealthPage, autoScroll, delay } from '../stealth.js';

const SCRAPER_TIMEOUT_MS = 45_000;

export const SELECTORS = {
  jobCard: {
    primary: '.jobTuple',
    fallbacks: ['article.jobTuple', '.srp-jobtuple-wrapper'],
  },
  title: {
    primary: '.title',
    fallbacks: ['.jobTitle', '.row1 .title', 'a.title'],
  },
  company: {
    primary: '.companyInfo',
    fallbacks: ['.comp-name', '.row2 .companyInfo a'],
  },
  location: {
    primary: '.location',
    fallbacks: ['.locWdth', '.row2 .location'],
  },
  salary: {
    primary: '.salary',
    fallbacks: ['.sal', '.row2 .salary'],
  },
  url: {
    primary: 'a.title',
    fallbacks: ['a.jobTitle', '.row1 a.title'],
  },
  postedDate: {
    primary: '.job-post-day',
    fallbacks: ['.jobTupleFooter .fleft', '.type', '[class*="posted"]', '[class*="date"]'],
  },
};

/**
 * Scrapes Naukri job listings.
 * @param {import('puppeteer-core').Browser} browser
 * @param {{ naukri?: { email: string, password: string } }} credentials
 * @returns {Promise<Array<object>>}
 */
export default async function scrape(browser, credentials) {
  const page = await browser.newPage();
  await stealthPage(page);

  try {
    await page.goto('https://www.naukri.com/full-stack-developer-jobs', {
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
        document.querySelectorAll('.jobTuple, article.jobTuple, .srp-jobtuple-wrapper'),
      )
        .slice(0, 25)
        .map((card) => {
          const titleEl = card.querySelector('.title, .jobTitle, .row1 .title, a.title');
          const companyEl = card.querySelector('.companyInfo, .comp-name, .row2 .companyInfo a');
          const locEl = card.querySelector('.location, .locWdth, .row2 .location');
          const salaryEl = card.querySelector('.salary, .sal, .row2 .salary');
          const linkEl = card.querySelector('a.title, a.jobTitle, .row1 a.title');
          const dateEl = card.querySelector(
            '.job-post-day, .jobTupleFooter .fleft, .type, [class*="posted"], [class*="date"]',
          );

          const id =
            linkEl?.href?.match(/\/job-listings-([^?]+)/)?.[1] || Date.now();
          const dateText = dateEl?.textContent || '';

          return {
            jobId: `nk-${id}-${Math.random().toString(36).substr(2, 9)}`,
            title: titleEl?.textContent?.trim() || '',
            company: companyEl?.textContent?.trim() || '',
            location: locEl?.textContent?.trim() || '',
            salary: salaryEl?.textContent?.trim() || '',
            url: linkEl?.href || '',
            platform: 'Naukri',
            postedDate: parsePostedDate(dateText),
          };
        })
        .filter((j) => j.title && j.company && j.jobId);
    });

    // Validate: filter out jobs missing title or url (Req 10.3, 10.4)
    const validJobs = jobs.filter((j) => {
      if (!j.title || !j.url) {
        console.log(`[Naukri] Discarded job ${j.jobId}: missing ${!j.title ? 'title' : ''}${!j.title && !j.url ? ', ' : ''}${!j.url ? 'url' : ''}`);
        return false;
      }
      return true;
    });

    console.log(`[Naukri] ${validJobs.length} valid jobs found (${jobs.length - validJobs.length} discarded)`);
    return validJobs;
  } catch (error) {
    console.error('[Naukri] Scraper failed:', error.message);
    console.error('[Naukri] Stack trace:', error.stack);
    return [];
  } finally {
    await page.close().catch((e) => console.error('[Naukri] Page close error:', e));
  }
}
