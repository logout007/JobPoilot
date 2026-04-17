// ── LinkedIn scraper

import { stealthPage, autoScroll, delay } from '../stealth.js';

const SCRAPER_TIMEOUT_MS = 45_000;

export const SELECTORS = {
  jobCard: {
    primary: '.jobs-search__results-list li',
    fallbacks: ['.scaffold-layout__list-item', '.job-card-container', '[data-job-id]', '.jobs-search-results__list-item'],
  },
  title: {
    primary: '.base-search-card__title',
    fallbacks: ['.job-card-list__title', '[class*="job-title"]', 'h3 a', '.job-card-container__link'],
  },
  company: {
    primary: '.base-search-card__subtitle',
    fallbacks: ['.job-card-container__company-name', '[class*="company-name"]', '.job-card-container__primary-description'],
  },
  location: {
    primary: '.job-search-card__location',
    fallbacks: ['.job-card-container__metadata-item', '[class*="location"]'],
  },
  salary: {
    primary: '.job-search-card__salary-info',
    fallbacks: ['[class*="salary"]', '[class*="compensation"]'],
  },
  url: {
    primary: 'a.base-card__full-link',
    fallbacks: ['a.job-card-list__title-link', 'a[href*="/jobs/view/"]'],
  },
  postedDate: {
    primary: '.job-search-card__listdate',
    fallbacks: ['.job-card-container__listdate', 'time', '[class*="posted"]', '[class*="date"]'],
  },
};

/**
 * Scrapes LinkedIn job listings.
 * @param {import('puppeteer-core').Browser} browser
 * @param {{ linkedin?: { email: string, password: string } }} credentials
 * @returns {Promise<Array<object>>}
 */
export default async function scrape(browser, credentials) {
  const page = await browser.newPage();
  await stealthPage(page);

  try {
    const q = encodeURIComponent('Node.js TypeScript Full Stack MERN');
    await page.goto(
      `https://www.linkedin.com/jobs/search/?keywords=${q}&location=India&f_TPR=r86400&sortBy=DD`,
      { waitUntil: 'domcontentloaded', timeout: SCRAPER_TIMEOUT_MS },
    );
    await delay(2500);
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
          '.jobs-search__results-list li, .scaffold-layout__list-item, .job-card-container, [data-job-id], .jobs-search-results__list-item',
        ),
      )
        .slice(0, 25)
        .map((card) => {
          const titleEl = card.querySelector(
            '.base-search-card__title, .job-card-list__title, [class*="job-title"], h3 a, .job-card-container__link',
          );
          const companyEl = card.querySelector(
            '.base-search-card__subtitle, .job-card-container__company-name, [class*="company-name"], .job-card-container__primary-description',
          );
          const locEl = card.querySelector(
            '.job-search-card__location, .job-card-container__metadata-item, [class*="location"]',
          );
          const linkEl = card.querySelector(
            'a.base-card__full-link, a.job-card-list__title-link, a[href*="/jobs/view/"]',
          );
          const dateEl = card.querySelector(
            '.job-search-card__listdate, .job-card-container__listdate, time, [class*="posted"], [class*="date"]',
          );
          const salaryEl = card.querySelector(
            '.job-search-card__salary-info, [class*="salary"], [class*="compensation"]',
          );

          const id =
            linkEl?.href?.match(/\/jobs\/view\/(\d+)/)?.[1] ||
            card.getAttribute('data-job-id');
          const dateText =
            dateEl?.textContent || dateEl?.getAttribute('datetime') || '';

          return {
            jobId: `li-${id || Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: titleEl?.textContent?.trim() || '',
            company: companyEl?.textContent?.trim() || '',
            location: locEl?.textContent?.trim() || 'India',
            salary: salaryEl?.textContent?.trim() || '',
            url: linkEl?.href || '',
            platform: 'LinkedIn',
            postedDate: parsePostedDate(dateText),
          };
        })
        .filter((j) => j.title && j.company && j.jobId);
    });

    // Validate: filter out jobs missing title or url (Req 10.3, 10.4)
    const validJobs = jobs.filter((j) => {
      if (!j.title || !j.url) {
        console.log(`[LinkedIn] Discarded job ${j.jobId}: missing ${!j.title ? 'title' : ''}${!j.title && !j.url ? ', ' : ''}${!j.url ? 'url' : ''}`);
        return false;
      }
      return true;
    });

    console.log(`[LinkedIn] ${validJobs.length} valid jobs found (${jobs.length - validJobs.length} discarded)`);
    return validJobs;
  } catch (error) {
    console.error('[LinkedIn] Scraper failed:', error.message);
    console.error('[LinkedIn] Stack trace:', error.stack);
    return [];
  } finally {
    await page.close().catch((e) => console.error('[LinkedIn] Page close error:', e));
  }
}
