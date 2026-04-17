// ── Turing scraper

import { stealthPage, autoScroll, delay } from '../stealth.js';

const SCRAPER_TIMEOUT_MS = 45_000;

export const SELECTORS = {
  jobCard: {
    primary: '[class*="JobCard"]',
    fallbacks: ['[class*="job-card"]', '[class*="job_card"]', '.job-listing', '[data-job-id]', 'a[href*="/jobs/"]'],
  },
  title: {
    primary: '[class*="title"]',
    fallbacks: ['[class*="Title"]', 'h2', 'h3', 'h4'],
  },
  company: {
    primary: '[class*="company"]',
    fallbacks: ['[class*="Company"]', '[class*="client"]'],
  },
  location: {
    primary: '[class*="location"]',
    fallbacks: ['[class*="Location"]'],
  },
  salary: {
    primary: '[class*="salary"]',
    fallbacks: ['[class*="Salary"]', '[class*="compensation"]', '[class*="pay"]'],
  },
  url: {
    primary: 'a[href*="/jobs/"]',
    fallbacks: [],
  },
  postedDate: {
    primary: '[class*="date"]',
    fallbacks: ['[class*="Date"]', '[class*="posted"]', '[class*="Posted"]', 'time'],
  },
};

/**
 * Scrapes Turing job listings.
 * @param {import('puppeteer-core').Browser} browser
 * @param {object} credentials — not used for Turing (public scrape)
 * @returns {Promise<Array<object>>}
 */
export default async function scrape(browser, credentials) {
  const page = await browser.newPage();
  await stealthPage(page);

  try {
    await page.goto('https://www.turing.com/jobs', {
      waitUntil: 'domcontentloaded',
      timeout: SCRAPER_TIMEOUT_MS,
    });
    await delay(3000);
    await autoScroll(page, 3);

    const jobs = await page.evaluate(() => {
      const parsePostedDate = (dateText) => {
        if (!dateText) return new Date().toISOString().split('T')[0];
        const text = dateText.toLowerCase().trim();
        const now = new Date();
        if (text.includes('just posted') || text.includes('today')) {
          return now.toISOString().split('T')[0];
        }
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
          '[class*="JobCard"], [class*="job-card"], [class*="job_card"], .job-listing, [data-job-id], a[href*="/jobs/"]',
        ),
      )
        .slice(0, 25)
        .map((card) => {
          const titleEl = card.querySelector(
            '[class*="title"], [class*="Title"], h2, h3, h4',
          );
          const companyEl = card.querySelector(
            '[class*="company"], [class*="Company"], [class*="client"]',
          );
          const locEl = card.querySelector(
            '[class*="location"], [class*="Location"]',
          );
          const salaryEl = card.querySelector(
            '[class*="salary"], [class*="Salary"], [class*="compensation"], [class*="pay"]',
          );
          const linkEl = card.querySelector('a[href*="/jobs/"]') || card;
          const dateEl = card.querySelector(
            '[class*="date"], [class*="Date"], [class*="posted"], [class*="Posted"], time',
          );

          const href = linkEl?.href || '';
          const jobIdMatch = href.match(/\/jobs\/([a-zA-Z0-9-]+)/);
          const jobId = jobIdMatch
            ? jobIdMatch[1]
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
              title.toLowerCase().includes('typescript') ||
              title.toLowerCase().includes('javascript') ||
              title.toLowerCase().includes('python') ||
              title.toLowerCase().includes('software'));

          if (!isRelevant) return null;

          return {
            jobId: `tu-${jobId}`,
            title,
            company: companyEl?.textContent?.trim() || 'Turing Client',
            location: locEl?.textContent?.trim() || 'Remote',
            salary: salaryEl?.textContent?.trim() || '',
            url: href.startsWith('http') ? href : `https://www.turing.com${href}`,
            platform: 'Turing',
            postedDate: parsePostedDate(dateText),
          };
        })
        .filter((j) => j && j.title && j.company && j.jobId);
    });

    // Validate: filter out jobs missing title or url (Req 10.3, 10.4)
    const validJobs = jobs.filter((j) => {
      if (!j.title || !j.url) {
        console.log(`[Turing] Discarded job ${j.jobId}: missing ${!j.title ? 'title' : ''}${!j.title && !j.url ? ', ' : ''}${!j.url ? 'url' : ''}`);
        return false;
      }
      return true;
    });

    console.log(`[Turing] ${validJobs.length} valid jobs found (${jobs.length - validJobs.length} discarded)`);
    return validJobs;
  } catch (error) {
    console.error('[Turing] Scraper failed:', error.message);
    console.error('[Turing] Stack trace:', error.stack);
    return [];
  } finally {
    await page.close().catch((e) => console.error('[Turing] Page close error:', e));
  }
}
