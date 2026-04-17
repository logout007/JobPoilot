// ============================================================
// JobPilot V3 — Job Scanner Lambda Handler
// Purpose: Scrape 12 job platforms, capture screenshots,
//          extract descriptions, save to DynamoDB.
// Scheduler: AWS EventBridge cron(30 3 * * ? *) → 09:00 IST daily
// ============================================================

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// ── Scrapers (one per platform)
import scrapeLinkedIn from './scrapers/linkedin.js';
import scrapeNaukri from './scrapers/naukri.js';
import scrapeIndeed from './scrapers/indeed.js';
import scrapeShine from './scrapers/shine.js';
import scrapeInternshala from './scrapers/internshala.js';
import scrapeWellfound from './scrapers/wellfound.js';
import scrapeTimesJobs from './scrapers/timesjobs.js';
import scrapeUnstop from './scrapers/unstop.js';
import scrapeUplers from './scrapers/uplers.js';
import scrapeTuring from './scrapers/turing.js';
import scrapeRemoteCo from './scrapers/remoteco.js';
import scrapeWeWorkRemotely from './scrapers/weworkremotely.js';

// ── Scanner helpers
import { captureScreenshot, uploadScreenshotToS3 } from './screenshot.js';
import { extractJobDescription } from './extractor.js';
import { delay } from './stealth.js';

// ── Shared utilities
import { getParam } from '../shared/ssm.js';
import { saveJobRecord } from '../shared/dynamo.js';
import { withRetry } from '../shared/retry.js';

// ══════════════════════════════════════════════════════════════
// MAIN HANDLER — Triggered by EventBridge at 09:00 IST daily
// ══════════════════════════════════════════════════════════════
export const handler = async (event) => {
  const startTime = Date.now();
  console.log('[Job_Scanner] Run started', new Date().toISOString());

  let browser;
  const stats = {
    platformsScraped: 0,
    jobsFound: 0,
    duplicatesRemoved: 0,
    jobsSaved: 0,
    errors: [],
  };

  try {
    // 1. Fetch credentials and user profile from SSM
    const { credentials, userProfile, cvText } = await fetchSSMParameters();
    console.log('[Job_Scanner] User profile loaded:', userProfile.name);

    // 2. Launch Chromium with stealth settings
    browser = await launchBrowser();
    console.log('[Job_Scanner] Browser launched');

    // 3. Run all platform scrapers in parallel (each wrapped with retry)
    const jobs = await scrapeAllPlatforms(browser, credentials);
    stats.jobsFound = jobs.length;

    // 4. Deduplicate jobs across platforms
    const uniqueJobs = deduplicateJobs(jobs);
    stats.duplicatesRemoved = jobs.length - uniqueJobs.length;
    console.log(
      `[Job_Scanner] Deduplication: ${stats.duplicatesRemoved} duplicates removed, ${uniqueJobs.length} unique jobs`,
    );

    // 5. Process each job: extract description, capture screenshot, save to DynamoDB
    const results = await processJobs(browser, uniqueJobs);
    stats.jobsSaved = results.saved;
    stats.errors = results.errors;

    // 6. Log summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('[Job_Scanner] RUN SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Duration: ${duration}s`);
    console.log(`Platforms scraped: 12`);
    console.log(`Jobs found: ${stats.jobsFound}`);
    console.log(`Duplicates removed: ${stats.duplicatesRemoved}`);
    console.log(`Unique jobs: ${uniqueJobs.length}`);
    console.log(`Jobs saved to DynamoDB: ${stats.jobsSaved}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('═══════════════════════════════════════════════════════════');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        platformsScraped: 12,
        jobsFound: stats.jobsFound,
        duplicatesRemoved: stats.duplicatesRemoved,
        jobsSaved: stats.jobsSaved,
        errors: stats.errors,
        duration: `${duration}s`,
      }),
    };
  } catch (error) {
    console.error('[Job_Scanner] Fatal error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
    };
  } finally {
    if (browser) {
      await browser.close().catch((e) => console.error('[Browser] Close error:', e));
      console.log('[Job_Scanner] Browser closed');
    }
  }
};

// ══════════════════════════════════════════════════════════════
// BROWSER SETUP
// ══════════════════════════════════════════════════════════════
async function launchBrowser() {
  return await puppeteer.launch({
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    defaultViewport: { width: 1280, height: 800 },
  });
}

// ══════════════════════════════════════════════════════════════
// SSM PARAMETER FETCHING
// ══════════════════════════════════════════════════════════════
async function fetchSSMParameters() {
  try {
    console.log('[SSM] Fetching parameters...');

    const [
      linkedinEmail, linkedinPass,
      naukriEmail, naukriPass,
      shineEmail, shinePass,
      internshalaEmail, internshalaPass,
      wellfoundEmail, wellfoundPass,
      cvText,
      userProfile,
    ] = await Promise.all([
      getParam('/jobpilot/linkedin/email').catch(() => ''),
      getParam('/jobpilot/linkedin/password').catch(() => ''),
      getParam('/jobpilot/naukri/email').catch(() => ''),
      getParam('/jobpilot/naukri/password').catch(() => ''),
      getParam('/jobpilot/shine/email').catch(() => ''),
      getParam('/jobpilot/shine/password').catch(() => ''),
      getParam('/jobpilot/internshala/email').catch(() => ''),
      getParam('/jobpilot/internshala/password').catch(() => ''),
      getParam('/jobpilot/wellfound/email').catch(() => ''),
      getParam('/jobpilot/wellfound/password').catch(() => ''),
      getParam('/jobpilot/cv/text').catch(() => ''),
      getParam('/jobpilot/user/profile').catch(() =>
        JSON.stringify({
          name: 'Pinaki',
          role: 'Full Stack Developer',
          yearsOfExperience: 3,
          skills: 'Node.js, TypeScript, React, MongoDB',
          location: 'Kolkata, India',
          preferredWorkArrangement: 'Remote',
          minimumSalary: 12,
          targetRoles: 'Full Stack Developer, Backend Engineer',
        }),
      ),
    ]);

    console.log('[SSM] Parameters fetched successfully');

    return {
      credentials: {
        linkedin: { email: linkedinEmail, password: linkedinPass },
        naukri: { email: naukriEmail, password: naukriPass },
        shine: { email: shineEmail, password: shinePass },
        internshala: { email: internshalaEmail, password: internshalaPass },
        wellfound: { email: wellfoundEmail, password: wellfoundPass },
      },
      userProfile: JSON.parse(userProfile),
      cvText,
    };
  } catch (error) {
    console.error('[SSM] Failed to fetch parameters:', error.message);
    return {
      credentials: {},
      userProfile: {
        name: 'Pinaki',
        role: 'Full Stack Developer',
        yearsOfExperience: 3,
        skills: 'Node.js, TypeScript, React, MongoDB',
        location: 'Kolkata, India',
        preferredWorkArrangement: 'Remote',
        minimumSalary: 12,
        targetRoles: 'Full Stack Developer, Backend Engineer',
      },
      cvText: '',
    };
  }
}

// ══════════════════════════════════════════════════════════════
// PLATFORM SCRAPERS — each wrapped with withRetry
// ══════════════════════════════════════════════════════════════
async function scrapeAllPlatforms(browser, credentials) {
  console.log('[Job_Scanner] Starting all 12 platform scrapers in parallel...');

  const scrapers = [
    { name: 'LinkedIn',         fn: () => scrapeLinkedIn(browser, credentials) },
    { name: 'Naukri',           fn: () => scrapeNaukri(browser, credentials) },
    { name: 'Indeed',           fn: () => scrapeIndeed(browser, credentials) },
    { name: 'Shine',            fn: () => scrapeShine(browser, credentials) },
    { name: 'Internshala',      fn: () => scrapeInternshala(browser, credentials) },
    { name: 'Wellfound',        fn: () => scrapeWellfound(browser, credentials) },
    { name: 'TimesJobs',        fn: () => scrapeTimesJobs(browser, credentials) },
    { name: 'Unstop',           fn: () => scrapeUnstop(browser, credentials) },
    { name: 'Uplers',           fn: () => scrapeUplers(browser, credentials) },
    { name: 'Turing',           fn: () => scrapeTuring(browser, credentials) },
    { name: 'Remote.co',        fn: () => scrapeRemoteCo(browser, credentials) },
    { name: 'WeWorkRemotely',   fn: () => scrapeWeWorkRemotely(browser, credentials) },
  ];

  const results = await Promise.allSettled(
    scrapers.map(({ name, fn }) =>
      withRetry(
        async () => {
          console.log(`[${name}] Attempting scrape...`);
          return await fn();
        },
        3,
        2000,
        name,
      ).catch((err) => {
        console.error(`[${name}] All retries exhausted:`, err.message);
        return [];
      }),
    ),
  );

  const allJobs = [];
  const platformNames = scrapers.map((s) => s.name);

  results.forEach((result, index) => {
    const name = platformNames[index];
    if (result.status === 'fulfilled') {
      const jobs = result.value || [];
      allJobs.push(...jobs);
      console.log(`[${name}] ✓ ${jobs.length} jobs scraped`);
    } else {
      console.error(`[${name}] ✗ Failed:`, result.reason?.message || 'Unknown error');
    }
  });

  console.log(`[Job_Scanner] Scraping complete. Total jobs collected: ${allJobs.length}`);
  return allJobs;
}

// ══════════════════════════════════════════════════════════════
// DEDUPLICATION
// ══════════════════════════════════════════════════════════════

/**
 * Removes duplicate jobs across platforms.
 * Normalises a `company::title` key and retains the first occurrence.
 *
 * @param {Array<object>} jobs
 * @returns {Array<object>}
 */
export function deduplicateJobs(jobs) {
  const seen = new Map();
  const unique = [];

  for (const job of jobs) {
    const key = `${job.company}::${job.title}`.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, true);
      unique.push(job);
    }
  }

  console.log(`[Dedup] Removed ${jobs.length - unique.length} duplicates`);
  return unique;
}

// ══════════════════════════════════════════════════════════════
// JOB PROCESSING
// ══════════════════════════════════════════════════════════════

/**
 * For each job: navigate to its URL, extract description,
 * capture screenshot, upload to S3, and save to DynamoDB.
 */
async function processJobs(browser, jobs) {
  const results = { saved: 0, errors: 0 };

  for (const job of jobs) {
    let page;
    try {
      page = await browser.newPage();

      // Realistic user-agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );

      // Block heavy resources
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Navigate to job URL
      await page.goto(job.url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Human-like delay
      await delay(1000 + Math.random() * 2000);

      // Extract job description (skip if already extracted during scraping)
      if (!job.description || job.description.length < 100) {
        job.description = await extractJobDescription(page);
      }

      // Capture screenshot and upload to S3
      const screenshotBuffer = await captureScreenshot(page, job.jobId);
      if (screenshotBuffer) {
        job.screenshotUrl = await uploadScreenshotToS3(screenshotBuffer, job.jobId);
      } else {
        job.screenshotUrl = '';
      }

      // Save to DynamoDB
      await saveJobRecord(job);
      results.saved++;
    } catch (error) {
      console.error(`[ProcessJob] Error for ${job.jobId}:`, error.message);
      console.error(`[ProcessJob] Stack trace:`, error.stack);
      results.errors++;
    } finally {
      if (page) {
        await page.close().catch((e) => console.error('[Page] Close error:', e));
      }
    }
  }

  return results;
}
