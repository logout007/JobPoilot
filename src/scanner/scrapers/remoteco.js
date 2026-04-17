// ── Remote.co scraper

import { stealthPage, autoScroll, delay } from '../stealth.js';

const SCRAPER_TIMEOUT_MS = 45_000;

export const SELECTORS = {
  jobCard: {
    primary: '.job_listing',
    fallbacks: ['.job', '[class*="job-card"]', '[class*="JobCard"]', 'article.job', 'li.job'],
  },
  title: {
    primary: '.job-title',
    fallbacks: ['.position', 'h3', 'h2', '[class*="title"]', '[class*="Title"]'],
  },
  company: {
    primary: '.company-name',
    fallbacks: ['.company', '[class*="company"]', '[class*="Company"]'],
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
    primary: 'a[href*="/remote-jobs/"]',
    fallbacks: ['a'],
  },
  postedDate: {
    primary: '.date',
    fallbacks: ['[class*="date"]', '[class*="Date"]', '[class*="posted"]', 'time'],
  },
};

/**
 * Scrapes Remote.co job listings.
 * @param {import('puppeteer-core').Browser} browser
 * @param {object} credentials — not used for Remote.co (public scrape)
 * @returns {Promise<Array<object>>}
 */
export default async function scrape(browser, credentials) {
  const page = await browser.newPage();
  await stealthPage(page);

  try {
    await page.goto('https://remote.co/remote-jobs/developer/', {
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
          '.job_listing, .job, [class*="job-card"], [class*="JobCard"], article.job, li.job',
        ),
      )
        .slice(0, 25)
        .map((card) => {
          const titleEl = card.querySelector(
            '.job-title, .position, h3, h2, [class*="title"], [class*="Title"]',
          );
          const companyEl = card.querySelector(
            '.company-name, .company, [class*="company"], [class*="Company"]',
          );
          const locEl = card.querySelector(
            '.location, [class*="location"], [class*="Location"]',
          );
          const salaryEl = card.querySelector(
            '.salary, [class*="salary"], [class*="Salary"], [class*="compensation"]',
          );
          const linkEl =
            card.querySelector('a[href*="/remote-jobs/"]') ||
            card.querySelector('a');
          const dateEl = card.querySelector(
            '.date, [class*="date"], [class*="Date"], [class*="posted"], time',
          );

          const href = linkEl?.href || '';
          const jobIdMatch = href.match(
            /\/remote-jobs\/[^\/]+\/([a-zA-Z0-9-]+)/,
          );
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
              title.toLowerCase().includes('software') ||
              title.toLowerCase().includes('web'));

          if (!isRelevant) return null;

          return {
            jobId: `rc-${jobId}`,
            title,
            company: companyEl?.textContent?.trim() || 'Remote Company',
            location: locEl?.textContent?.trim() || 'Remote',
            salary: salaryEl?.textContent?.trim() || '',
            url: href.startsWith('http') ? href : `https://remote.co${href}`,
            platform: 'Remote.co',
            postedDate: parsePostedDate(dateText),
          };
        })
        .filter((j) => j && j.title && j.company && j.jobId);
    });

    // Validate: filter out jobs missing title or url (Req 10.3, 10.4)
    const validJobs = jobs.filter((j) => {
      if (!j.title || !j.url) {
        console.log(`[Remote.co] Discarded job ${j.jobId}: missing ${!j.title ? 'title' : ''}${!j.title && !j.url ? ', ' : ''}${!j.url ? 'url' : ''}`);
        return false;
      }
      return true;
    });

    console.log(`[Remote.co] ${validJobs.length} valid jobs found (${jobs.length - validJobs.length} discarded)`);
    return validJobs;
  } catch (error) {
    console.error('[Remote.co] Scraper failed:', error.message);
    console.error('[Remote.co] Stack trace:', error.stack);
    return [];
  } finally {
    await page.close().catch((e) => console.error('[Remote.co] Page close error:', e));
  }
}
