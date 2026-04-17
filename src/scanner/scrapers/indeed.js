// ── Indeed scraper

import { stealthPage, autoScroll, delay } from '../stealth.js';

const SCRAPER_TIMEOUT_MS = 45_000;

export const SELECTORS = {
  jobCard: {
    primary: '.job_seen_beacon',
    fallbacks: ['.jobsearch-ResultsList > li'],
  },
  title: {
    primary: 'h2.jobTitle span',
    fallbacks: ['.jobTitle a'],
  },
  company: {
    primary: '.companyName',
    fallbacks: ['[data-testid="company-name"]'],
  },
  location: {
    primary: '.companyLocation',
    fallbacks: ['[data-testid="text-location"]'],
  },
  salary: {
    primary: '.salary-snippet',
    fallbacks: ['[class*="salary"]'],
  },
  url: {
    primary: 'h2.jobTitle a',
    fallbacks: ['a[href*="/rc/clk"]'],
  },
  postedDate: {
    primary: '.date',
    fallbacks: ['.jobsearch-JobMetadataFooter', '[class*="date"]'],
  },
};

/**
 * Scrapes Indeed job listings.
 * @param {import('puppeteer-core').Browser} browser
 * @param {object} credentials — not used for Indeed (public scrape)
 * @returns {Promise<Array<object>>}
 */
export default async function scrape(browser, credentials) {
  const page = await browser.newPage();
  await stealthPage(page);

  try {
    // Additional stealth techniques to avoid Cloudflare detection
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

    await page.goto('https://in.indeed.com/jobs?q=full+stack+developer&l=India', {
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
        const daysMatch = text.match(/(\d+)\s*day/);
        const hoursMatch = text.match(/(\d+)\s*hour/);
        if (hoursMatch) now.setHours(now.getHours() - parseInt(hoursMatch[1]));
        else if (daysMatch) now.setDate(now.getDate() - parseInt(daysMatch[1]));
        else if (text.includes('30+')) now.setDate(now.getDate() - 30);
        return now.toISOString().split('T')[0];
      };

      return Array.from(
        document.querySelectorAll('.job_seen_beacon, .jobsearch-ResultsList > li'),
      )
        .slice(0, 25)
        .map((card) => {
          const titleEl = card.querySelector('h2.jobTitle span, .jobTitle a');
          const companyEl = card.querySelector('.companyName');
          const locEl = card.querySelector('.companyLocation');
          const salaryEl = card.querySelector('.salary-snippet');
          const linkEl = card.querySelector('h2.jobTitle a');
          const dateEl = card.querySelector('.date, .jobsearch-JobMetadataFooter, [class*="date"]');

          const dateText = dateEl?.textContent || '';
          const jobId =
            linkEl?.href?.match(/jk=([a-zA-Z0-9]+)/)?.[1] ||
            `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          return {
            jobId: `in-${jobId}`,
            title: titleEl?.textContent?.trim() || '',
            company: companyEl?.textContent?.trim() || '',
            location: locEl?.textContent?.trim() || '',
            salary: salaryEl?.textContent?.trim() || '',
            url: linkEl?.href ? `https://in.indeed.com${linkEl.href}` : '',
            platform: 'Indeed',
            postedDate: parsePostedDate(dateText),
          };
        })
        .filter((j) => j.title && j.company && j.jobId);
    });

    // Validate: filter out jobs missing title or url (Req 10.3, 10.4)
    const validJobs = jobs.filter((j) => {
      if (!j.title || !j.url) {
        console.log(`[Indeed] Discarded job ${j.jobId}: missing ${!j.title ? 'title' : ''}${!j.title && !j.url ? ', ' : ''}${!j.url ? 'url' : ''}`);
        return false;
      }
      return true;
    });

    console.log(`[Indeed] ${validJobs.length} valid jobs found (${jobs.length - validJobs.length} discarded)`);
    return validJobs;
  } catch (error) {
    console.error('[Indeed] Scraper failed:', error.message);
    console.error('[Indeed] Stack trace:', error.stack);
    return [];
  } finally {
    await page.close().catch((e) => console.error('[Indeed] Page close error:', e));
  }
}
