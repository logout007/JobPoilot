// ── Internshala scraper

import { stealthPage, autoScroll, delay } from '../stealth.js';

const SCRAPER_TIMEOUT_MS = 45_000;

export const SELECTORS = {
  jobCard: {
    primary: '.individual_internship',
    fallbacks: ['.job-card', '[class*="internship"]', '[class*="job-card"]', 'div[id*="internship"]'],
  },
  title: {
    primary: '.job-internship-name',
    fallbacks: ['.profile', '.profile h3', '.profile a', '[class*="profile"] h3', '[class*="heading"]', '[class*="title"]'],
  },
  company: {
    primary: '.company-name',
    fallbacks: ['.company', '[class*="company"]', '.link_display_like_text'],
  },
  location: {
    primary: '.location-link',
    fallbacks: ['.location', '[class*="location"]', '#location_names a'],
  },
  salary: {
    primary: '.stipend',
    fallbacks: ['[class*="stipend"]', '[class*="salary"]'],
  },
  url: {
    primary: 'a[href*="/job/"]',
    fallbacks: ['a[href*="/internship/"]', '.view_detail_button'],
  },
  postedDate: {
    primary: '[class*="status"]',
    fallbacks: ['[class*="posted"]', '[class*="date"]', '.status-success'],
  },
};

/**
 * Scrapes Internshala job listings.
 * @param {import('puppeteer-core').Browser} browser
 * @param {object} credentials — not used for Internshala (public scrape)
 * @returns {Promise<Array<object>>}
 */
export default async function scrape(browser, credentials) {
  const page = await browser.newPage();
  await stealthPage(page);

  try {
    await page.goto('https://internshala.com/jobs/full-stack-developer-jobs/', {
      waitUntil: 'domcontentloaded',
      timeout: SCRAPER_TIMEOUT_MS,
    });
    await delay(2000);
    await autoScroll(page, 2);

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
          '.individual_internship, .job-card, [class*="internship"], [class*="job-card"], div[id*="internship"]',
        ),
      )
        .slice(0, 25)
        .map((card) => {
          const titleEl = card.querySelector(
            '.job-internship-name, .profile, .profile h3, .profile a, [class*="profile"] h3, [class*="heading"], [class*="title"]',
          );
          const companyEl = card.querySelector(
            '.company-name, .company, [class*="company"], .link_display_like_text',
          );
          const locEl = card.querySelector(
            '.location-link, .location, [class*="location"], #location_names a',
          );
          const salaryEl = card.querySelector(
            '.stipend, [class*="stipend"], [class*="salary"]',
          );
          const dateEl = card.querySelector(
            '[class*="status"], [class*="posted"], [class*="date"], .status-success',
          );
          const linkEl = card.querySelector(
            'a[href*="/job/"], a[href*="/internship/"], .view_detail_button',
          );

          const title = titleEl?.textContent?.trim() || '';
          const company = companyEl?.textContent?.trim() || '';
          const location = locEl?.textContent?.trim() || '';
          const salary = salaryEl?.textContent?.trim() || '';
          const dateText = dateEl?.textContent?.trim() || '';

          let jobId = '';
          if (linkEl?.href) {
            const match = linkEl.href.match(/\/(job|internship)\/detail\/([^\/]+)/);
            jobId = match
              ? match[2]
              : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          } else {
            jobId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          }

          return {
            jobId: `is-${jobId}`,
            title,
            company,
            location,
            salary,
            url: linkEl?.href || '',
            platform: 'Internshala',
            postedDate: parsePostedDate(dateText),
          };
        })
        .filter((j) => j.title && j.company && j.jobId);
    });

    // Validate: filter out jobs missing title or url (Req 10.3, 10.4)
    const validJobs = jobs.filter((j) => {
      if (!j.title || !j.url) {
        console.log(`[Internshala] Discarded job ${j.jobId}: missing ${!j.title ? 'title' : ''}${!j.title && !j.url ? ', ' : ''}${!j.url ? 'url' : ''}`);
        return false;
      }
      return true;
    });

    console.log(`[Internshala] ${validJobs.length} valid jobs found (${jobs.length - validJobs.length} discarded)`);
    return validJobs;
  } catch (error) {
    console.error('[Internshala] Scraper failed:', error.message);
    console.error('[Internshala] Stack trace:', error.stack);
    return [];
  } finally {
    await page.close().catch((e) => console.error('[Internshala] Page close error:', e));
  }
}
