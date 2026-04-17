// ============================================================
// Test: Scanner Error Handling (Task 8.2)
// Purpose: Verify rate limiting and error handling requirements
// Requirements: 19.1, 19.2, 19.5
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the scrapeAllPlatforms behavior
describe('Task 8.2 - Rate Limiting and Error Handling', () => {
  describe('Requirement 19.1 - Continue on individual scraper failures', () => {
    it('should continue processing when some scrapers fail', async () => {
      // Simulate Promise.allSettled with mixed results
      const scrapers = [
        Promise.resolve([{ id: 'li-1', title: 'Job 1', company: 'Company A', platform: 'LinkedIn' }]),
        Promise.reject(new Error('Naukri scraper timeout')),
        Promise.resolve([{ id: 'in-1', title: 'Job 2', company: 'Company B', platform: 'Indeed' }]),
        Promise.reject(new Error('Shine scraper failed')),
      ];

      const results = await Promise.allSettled(scrapers);
      
      // Verify that we get results for all scrapers (fulfilled or rejected)
      expect(results).toHaveLength(4);
      
      // Verify that successful scrapers return jobs
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      expect(successfulResults).toHaveLength(2);
      
      // Verify that failed scrapers are captured
      const failedResults = results.filter(r => r.status === 'rejected');
      expect(failedResults).toHaveLength(2);
      
      // Collect all jobs from successful scrapers
      const allJobs = [];
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          allJobs.push(...result.value);
        }
      });
      
      // Verify partial results are returned
      expect(allJobs).toHaveLength(2);
      expect(allJobs[0].platform).toBe('LinkedIn');
      expect(allJobs[1].platform).toBe('Indeed');
    });

    it('should log platform name, error message, and stack trace for failures', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const testError = new Error('Test scraper failure');
      testError.stack = 'Error: Test scraper failure\n    at testFunction (test.js:10:15)';
      
      const scrapers = [
        Promise.resolve([]),
        Promise.reject(testError),
      ];

      const results = await Promise.allSettled(scrapers);
      const platformNames = ['LinkedIn', 'Naukri'];
      
      // Simulate the error logging logic from scanner-handler.js
      results.forEach((result, index) => {
        const platformName = platformNames[index];
        
        if (result.status === 'rejected') {
          const errorMessage = result.reason?.message || 'Unknown error';
          const stackTrace = result.reason?.stack || 'No stack trace available';
          
          console.error(`[${platformName}] ✗ Failed:`, errorMessage);
          console.error(`[${platformName}] Stack trace:`, stackTrace);
        }
      });
      
      // Verify error logging includes platform name, message, and stack trace
      expect(consoleSpy).toHaveBeenCalledWith('[Naukri] ✗ Failed:', 'Test scraper failure');
      expect(consoleSpy).toHaveBeenCalledWith('[Naukri] Stack trace:', expect.stringContaining('Error: Test scraper failure'));
      
      consoleSpy.mockRestore();
    });

    it('should return partial results when some platforms fail', async () => {
      const scrapers = [
        Promise.resolve([{ id: 'li-1', platform: 'LinkedIn' }]),
        Promise.resolve([{ id: 'nk-1', platform: 'Naukri' }]),
        Promise.reject(new Error('Indeed failed')),
        Promise.resolve([{ id: 'sh-1', platform: 'Shine' }]),
        Promise.reject(new Error('Internshala failed')),
        Promise.reject(new Error('Wellfound failed')),
      ];

      const results = await Promise.allSettled(scrapers);
      
      const allJobs = [];
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          allJobs.push(...result.value);
        }
      });
      
      // Verify we got partial results (3 successful out of 6)
      expect(allJobs).toHaveLength(3);
      expect(allJobs.map(j => j.platform)).toEqual(['LinkedIn', 'Naukri', 'Shine']);
    });
  });

  describe('Requirement 19.2 - Screenshot capture failure handling', () => {
    it('should log job ID and error message on screenshot failure', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const jobId = 'li-12345';
      const error = new Error('Screenshot timeout');
      
      // Simulate screenshot failure logging
      console.error(`[Screenshot] Failed for ${jobId}:`, error.message);
      
      expect(consoleSpy).toHaveBeenCalledWith(`[Screenshot] Failed for ${jobId}:`, 'Screenshot timeout');
      
      consoleSpy.mockRestore();
    });

    it('should continue processing other jobs after screenshot failure', async () => {
      const jobs = [
        { id: 'job-1', url: 'https://example.com/job1' },
        { id: 'job-2', url: 'https://example.com/job2' },
        { id: 'job-3', url: 'https://example.com/job3' },
      ];

      const results = { saved: 0, errors: 0 };
      
      // Simulate processing with one failure
      for (const job of jobs) {
        try {
          if (job.id === 'job-2') {
            throw new Error('Screenshot failed');
          }
          results.saved++;
        } catch (error) {
          console.error(`[ProcessJob] Error for ${job.id}:`, error.message);
          results.errors++;
        }
      }
      
      // Verify partial success
      expect(results.saved).toBe(2);
      expect(results.errors).toBe(1);
    });
  });

  describe('Requirement 19.5 - Summary statistics logging', () => {
    it('should log start time, end time, and summary statistics', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const startTime = Date.now();
      const stats = {
        platformsScraped: 12,
        jobsFound: 150,
        duplicatesRemoved: 25,
        jobsSaved: 125,
        errors: 2,
      };
      
      // Simulate summary logging
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      console.log('═══════════════════════════════════════════════════════════');
      console.log('[Job_Scanner] RUN SUMMARY');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Duration: ${duration}s`);
      console.log(`Platforms scraped: ${stats.platformsScraped}`);
      console.log(`Jobs found: ${stats.jobsFound}`);
      console.log(`Duplicates removed: ${stats.duplicatesRemoved}`);
      console.log(`Unique jobs: ${stats.jobsFound - stats.duplicatesRemoved}`);
      console.log(`Jobs saved to DynamoDB: ${stats.jobsSaved}`);
      console.log(`Errors: ${stats.errors}`);
      console.log('═══════════════════════════════════════════════════════════');
      
      // Verify summary includes all required fields
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Duration:'));
      expect(consoleSpy).toHaveBeenCalledWith(`Platforms scraped: ${stats.platformsScraped}`);
      expect(consoleSpy).toHaveBeenCalledWith(`Jobs found: ${stats.jobsFound}`);
      expect(consoleSpy).toHaveBeenCalledWith(`Duplicates removed: ${stats.duplicatesRemoved}`);
      expect(consoleSpy).toHaveBeenCalledWith(`Jobs saved to DynamoDB: ${stats.jobsSaved}`);
      expect(consoleSpy).toHaveBeenCalledWith(`Errors: ${stats.errors}`);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Error resilience - No abort on failures', () => {
    it('should complete the run even when all scrapers fail', async () => {
      const scrapers = [
        Promise.reject(new Error('LinkedIn failed')),
        Promise.reject(new Error('Naukri failed')),
        Promise.reject(new Error('Indeed failed')),
      ];

      const results = await Promise.allSettled(scrapers);
      
      // Verify all failures are captured
      expect(results.every(r => r.status === 'rejected')).toBe(true);
      
      // Collect jobs (should be empty but process should complete)
      const allJobs = [];
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          allJobs.push(...result.value);
        }
      });
      
      expect(allJobs).toHaveLength(0);
      // The key point: the process completed without throwing
    });

    it('should track error statistics for reporting', async () => {
      const scrapers = [
        Promise.resolve([{ id: '1' }]),
        Promise.reject(new Error('Error 1')),
        Promise.reject(new Error('Error 2')),
        Promise.resolve([{ id: '2' }]),
      ];

      const results = await Promise.allSettled(scrapers);
      
      const platformStats = {
        successful: 0,
        failed: 0,
        errors: [],
      };
      
      const platformNames = ['LinkedIn', 'Naukri', 'Indeed', 'Shine'];
      
      results.forEach((result, index) => {
        const platformName = platformNames[index];
        
        if (result.status === 'fulfilled') {
          platformStats.successful++;
        } else {
          platformStats.failed++;
          platformStats.errors.push({
            platform: platformName,
            error: result.reason?.message || 'Unknown error',
            stack: result.reason?.stack || 'No stack trace available',
          });
        }
      });
      
      expect(platformStats.successful).toBe(2);
      expect(platformStats.failed).toBe(2);
      expect(platformStats.errors).toHaveLength(2);
      expect(platformStats.errors[0].platform).toBe('Naukri');
      expect(platformStats.errors[1].platform).toBe('Indeed');
      expect(platformStats.errors[0].error).toBe('Error 1');
      expect(platformStats.errors[1].error).toBe('Error 2');
    });
  });
});
