// ── Screenshot capture and S3 upload helpers for the scanner pipeline.

import { uploadToS3 } from '../shared/s3.js';

/**
 * Captures a full-page PNG screenshot of the current page.
 * Sets viewport to 1280×800 before capturing.
 * @param {import('puppeteer-core').Page} page - Puppeteer page instance.
 * @param {string} jobId - The job identifier (used for logging).
 * @returns {Promise<Buffer|null>} The PNG buffer, or null on error.
 */
export async function captureScreenshot(page, jobId) {
  try {
    // Set viewport to 1280x800 pixels
    await page.setViewport({ width: 1280, height: 800 });

    // Capture full-page screenshot as PNG buffer
    const screenshotBuffer = await page.screenshot({
      type: 'png',
      fullPage: true,
    });

    console.log(`[Screenshot] Captured for ${jobId}`);
    return screenshotBuffer;
  } catch (error) {
    console.error(`[Screenshot] Failed for ${jobId}:`, error.message);
    return null;
  }
}

/**
 * Uploads a screenshot buffer to S3 under `screenshots/{YYYY-MM-DD}/{jobId}.png`.
 * @param {Buffer} buffer - The PNG screenshot buffer.
 * @param {string} jobId - The job identifier.
 * @returns {Promise<string>} The public S3 URL, or '' on failure.
 */
export async function uploadScreenshotToS3(buffer, jobId) {
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `screenshots/${dateStr}/${jobId}.png`;
  return uploadToS3(buffer, key, 'image/png');
}
