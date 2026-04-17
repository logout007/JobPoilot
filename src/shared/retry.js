// ── Retry utility with exponential back-off
// Retries an async function up to maxAttempts times.
// Rethrows the last error after all attempts are exhausted.

/**
 * Returns a promise that resolves after the given number of milliseconds.
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retries an async function with exponential back-off.
 *
 * - Attempt 1: immediate call
 * - Attempt 2: wait baseDelayMs (default 2s)
 * - Attempt 3: wait baseDelayMs * 2 (default 4s)
 * - ...and so on, doubling each time.
 *
 * On final failure the last error is rethrown.
 *
 * @template T
 * @param {() => Promise<T>} fn - The async function to retry.
 * @param {number} maxAttempts - Maximum number of attempts (default 3).
 * @param {number} baseDelayMs - Base delay in ms; doubles each retry (default 2000).
 * @param {string} [label] - Optional label for log messages (e.g. platform name).
 * @returns {Promise<T>}
 */
export async function withRetry(fn, maxAttempts = 3, baseDelayMs = 2000, label = '') {
  let lastError;
  const tag = label ? `[Retry:${label}]` : '[Retry]';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.log(`${tag} Attempt ${attempt}/${maxAttempts} failed: ${error.message}`);

      if (attempt < maxAttempts) {
        const waitMs = baseDelayMs * Math.pow(2, attempt - 1);
        await delay(waitMs);
      }
    }
  }

  throw lastError;
}
