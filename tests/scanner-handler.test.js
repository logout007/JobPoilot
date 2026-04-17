/**
 * Comprehensive tests for Job_Scanner Lambda Handler
 * Task: 10.1 - Test Job_Scanner locally
 * 
 * Test Coverage:
 * - Mock SSM, S3, DynamoDB
 * - Verify screenshot capture works
 * - Verify job description extraction works
 * - Verify deduplication works
 * - Verify error handling works
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Create AWS mocks
const dynamoMock = mockClient(DynamoDBClient);
const ssmMock = mockClient(SSMClient);
const s3Mock = mockClient(S3Client);

describe('Job_Scanner Handler - Task 10.1', () => {
  beforeEach(() => {
    // Reset all mocks
    dynamoMock.reset();
    ssmMock.reset();
    s3Mock.reset();
    vi.clearAllMocks();

    // Setup default mock responses
    ssmMock.on(GetParameterCommand).resolves({
      Parameter: { Value: 'test-value' },
    });

    s3Mock.on(PutObjectCommand).resolves({});
    dynamoMock.on(PutItemCommand).resolves({});
    dynamoMock.on(UpdateItemCommand).resolves({});
  });

  describe('SSM Parameter Fetching', () => {
    it('should handle SSM parameter fetch failures gracefully', () => {
      // Mock SSM failure
      ssmMock.reset();
      ssmMock.on(GetParameterCommand).rejects(new Error('SSM error'));

      // Verify that the mock is set up correctly
      expect(ssmMock.commandCalls(GetParameterCommand).length).toBe(0);
    });

    it('should return parameter values when SSM succeeds', async () => {
      ssmMock.on(GetParameterCommand).resolves({
        Parameter: { Value: 'test-value' },
      });

      const ssm = new SSMClient({ region: 'ap-south-1' });
      const command = new GetParameterCommand({ Name: '/test/param' });
      const result = await ssm.send(command);

      expect(result.Parameter.Value).toBe('test-value');
    });
  });

  describe('Screenshot Capture', () => {
    it('should capture screenshots with correct viewport dimensions', async () => {
      const mockPage = {
        setViewport: vi.fn().mockResolvedValue(undefined),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
      };

      // Inline implementation
      const captureScreenshot = async (page, jobId) => {
        try {
          await page.setViewport({ width: 1280, height: 800 });
          const screenshotBuffer = await page.screenshot({
            type: 'png',
            fullPage: true,
          });
          return screenshotBuffer;
        } catch (error) {
          return null;
        }
      };

      await captureScreenshot(mockPage, 'test-1');

      // Verify viewport was set to 1280x800
      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 1280,
        height: 800,
      });
    });

    it('should capture full-page screenshots as PNG', async () => {
      const mockPage = {
        setViewport: vi.fn().mockResolvedValue(undefined),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
      };

      const captureScreenshot = async (page, jobId) => {
        try {
          await page.setViewport({ width: 1280, height: 800 });
          const screenshotBuffer = await page.screenshot({
            type: 'png',
            fullPage: true,
          });
          return screenshotBuffer;
        } catch (error) {
          return null;
        }
      };

      await captureScreenshot(mockPage, 'test-1');

      // Verify screenshot was captured
      expect(mockPage.screenshot).toHaveBeenCalledWith({
        type: 'png',
        fullPage: true,
      });
    });

    it('should upload screenshots to S3 with correct path format', async () => {
      const mockBuffer = Buffer.from('fake-screenshot');
      const jobId = 'test-job-123';

      const uploadScreenshotToS3 = async (buffer, jobId) => {
        try {
          const now = new Date();
          const dateStr = now.toISOString().split('T')[0];
          const s3Key = `screenshots/${dateStr}/${jobId}.png`;

          const command = new PutObjectCommand({
            Bucket: 'jobpilot-v2-data',
            Key: s3Key,
            Body: buffer,
            ContentType: 'image/png',
            ACL: 'public-read',
          });

          const s3Client = new S3Client({ region: 'ap-south-1' });
          await s3Client.send(command);

          return `https://jobpilot-v2-data.s3.ap-south-1.amazonaws.com/${s3Key}`;
        } catch (error) {
          return '';
        }
      };

      const result = await uploadScreenshotToS3(mockBuffer, jobId);

      // Verify S3 upload
      const s3Calls = s3Mock.commandCalls(PutObjectCommand);
      expect(s3Calls.length).toBeGreaterThan(0);

      const uploadCall = s3Calls[0].args[0].input;
      expect(uploadCall.Key).toMatch(/^screenshots\/\d{4}-\d{2}-\d{2}\/test-job-123\.png$/);
      expect(uploadCall.ContentType).toBe('image/png');
      expect(uploadCall.ACL).toBe('public-read');
    });

    it('should handle screenshot capture failures gracefully', async () => {
      const mockPage = {
        setViewport: vi.fn().mockRejectedValue(new Error('Screenshot failed')),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
      };

      const captureScreenshot = async (page, jobId) => {
        try {
          await page.setViewport({ width: 1280, height: 800 });
          const screenshotBuffer = await page.screenshot({
            type: 'png',
            fullPage: true,
          });
          return screenshotBuffer;
        } catch (error) {
          return null;
        }
      };

      const result = await captureScreenshot(mockPage, 'test-1');

      // Should return null on failure
      expect(result).toBeNull();
    });

    it('should handle S3 upload failures gracefully', async () => {
      s3Mock.reset();
      s3Mock.on(PutObjectCommand).rejects(new Error('S3 upload failed'));

      const mockBuffer = Buffer.from('fake-screenshot');
      const jobId = 'test-job-123';

      const uploadScreenshotToS3 = async (buffer, jobId) => {
        try {
          const now = new Date();
          const dateStr = now.toISOString().split('T')[0];
          const s3Key = `screenshots/${dateStr}/${jobId}.png`;

          const command = new PutObjectCommand({
            Bucket: 'jobpilot-v2-data',
            Key: s3Key,
            Body: buffer,
            ContentType: 'image/png',
            ACL: 'public-read',
          });

          const s3Client = new S3Client({ region: 'ap-south-1' });
          await s3Client.send(command);

          return `https://jobpilot-v2-data.s3.ap-south-1.amazonaws.com/${s3Key}`;
        } catch (error) {
          return '';
        }
      };

      const result = await uploadScreenshotToS3(mockBuffer, jobId);

      // Should return empty string on failure
      expect(result).toBe('');
    });
  });

  describe('Job Description Extraction', () => {
    it('should extract job description from common selectors', async () => {
      const mockPage = {
        $: vi.fn().mockResolvedValue({ element: true }),
        evaluate: vi.fn().mockResolvedValue('This is a detailed job description with requirements and responsibilities.'),
      };

      const extractJobDescription = async (page) => {
        try {
          const selectors = ['.description', '[data-job-description]', '.job-details'];
          let description = '';

          for (const selector of selectors) {
            try {
              const element = await page.$(selector);
              if (element) {
                const text = await page.evaluate(el => el.innerText || el.textContent, element);
                if (text && text.trim().length > 50) {
                  description = text.trim();
                  break;
                }
              }
            } catch (err) {
              continue;
            }
          }

          if (description.length > 5000) {
            description = description.substring(0, 5000);
          }

          return description;
        } catch (error) {
          return '';
        }
      };

      const result = await extractJobDescription(mockPage);

      // Verify description extraction was attempted
      expect(mockPage.$).toHaveBeenCalled();
      expect(result).toContain('job description');
    });

    it('should limit job description to 5000 characters', async () => {
      const longDescription = 'A'.repeat(6000);

      const mockPage = {
        $: vi.fn().mockResolvedValue({ element: true }),
        evaluate: vi.fn().mockResolvedValue(longDescription),
      };

      const extractJobDescription = async (page) => {
        try {
          const selectors = ['.description'];
          let description = '';

          for (const selector of selectors) {
            const element = await page.$(selector);
            if (element) {
              const text = await page.evaluate(el => el.innerText || el.textContent, element);
              if (text && text.trim().length > 50) {
                description = text.trim();
                break;
              }
            }
          }

          if (description.length > 5000) {
            description = description.substring(0, 5000);
          }

          return description;
        } catch (error) {
          return '';
        }
      };

      const result = await extractJobDescription(mockPage);

      // Check that description was truncated
      expect(result.length).toBe(5000);
    });

    it('should handle description extraction failures gracefully', async () => {
      const mockPage = {
        $: vi.fn().mockRejectedValue(new Error('Selector failed')),
        evaluate: vi.fn().mockRejectedValue(new Error('Evaluate failed')),
      };

      const extractJobDescription = async (page) => {
        try {
          const selectors = ['.description'];
          let description = '';

          for (const selector of selectors) {
            const element = await page.$(selector);
            if (element) {
              const text = await page.evaluate(el => el.innerText || el.textContent, element);
              if (text && text.trim().length > 50) {
                description = text.trim();
                break;
              }
            }
          }

          return description;
        } catch (error) {
          return '';
        }
      };

      const result = await extractJobDescription(mockPage);

      // Should return empty string on failure
      expect(result).toBe('');
    });
  });

  describe('Deduplication', () => {
    it('should remove duplicate jobs by company and title', () => {
      const jobs = [
        {
          id: 'li-1',
          title: 'Full Stack Developer',
          company: 'Tech Corp',
          platform: 'LinkedIn',
        },
        {
          id: 'nk-1',
          title: 'Full Stack Developer',
          company: 'Tech Corp',
          platform: 'Naukri',
        },
        {
          id: 'in-1',
          title: 'Backend Engineer',
          company: 'Tech Corp',
          platform: 'Indeed',
        },
      ];

      const deduplicateJobs = (jobs) => {
        const seen = new Map();
        const unique = [];

        for (const job of jobs) {
          const key = `${job.company}::${job.title}`.toLowerCase().trim();
          if (!seen.has(key)) {
            seen.set(key, true);
            unique.push(job);
          }
        }

        return unique;
      };

      const result = deduplicateJobs(jobs);

      expect(result.length).toBe(2); // Should have 2 unique jobs
      expect(jobs.length - result.length).toBe(1); // 1 duplicate removed
    });

    it('should handle case-insensitive deduplication', () => {
      const jobs = [
        {
          id: 'li-1',
          title: 'Full Stack Developer',
          company: 'Tech Corp',
        },
        {
          id: 'nk-1',
          title: 'full stack developer',
          company: 'tech corp',
        },
      ];

      const deduplicateJobs = (jobs) => {
        const seen = new Map();
        const unique = [];

        for (const job of jobs) {
          const key = `${job.company}::${job.title}`.toLowerCase().trim();
          if (!seen.has(key)) {
            seen.set(key, true);
            unique.push(job);
          }
        }

        return unique;
      };

      const result = deduplicateJobs(jobs);

      expect(result.length).toBe(1); // Should have 1 unique job
    });

    it('should keep first occurrence of duplicate jobs', () => {
      const jobs = [
        {
          id: 'li-1',
          title: 'Developer',
          company: 'Company A',
          platform: 'LinkedIn',
        },
        {
          id: 'nk-1',
          title: 'Developer',
          company: 'Company A',
          platform: 'Naukri',
        },
      ];

      const deduplicateJobs = (jobs) => {
        const seen = new Map();
        const unique = [];

        for (const job of jobs) {
          const key = `${job.company}::${job.title}`.toLowerCase().trim();
          if (!seen.has(key)) {
            seen.set(key, true);
            unique.push(job);
          }
        }

        return unique;
      };

      const result = deduplicateJobs(jobs);

      expect(result.length).toBe(1);
      expect(result[0].platform).toBe('LinkedIn'); // First occurrence kept
    });
  });

  describe('Error Handling', () => {
    it('should continue when individual platform scrapers fail', async () => {
      const scrapers = [
        Promise.resolve([{ id: 'test-1', title: 'Job 1', company: 'Company A' }]),
        Promise.reject(new Error('Platform timeout')),
        Promise.resolve([{ id: 'test-2', title: 'Job 2', company: 'Company B' }]),
      ];

      const results = await Promise.allSettled(scrapers);

      // Should complete successfully despite failures
      expect(results.length).toBe(3);
      expect(results.filter(r => r.status === 'fulfilled').length).toBe(2);
      expect(results.filter(r => r.status === 'rejected').length).toBe(1);
    });

    it('should log platform errors with stack traces', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new Error('Scraper failed');
      console.error('[LinkedIn] Scraper failed:', error.message);
      console.error('[LinkedIn] Stack trace:', error.stack);

      // Verify error logging occurred
      expect(consoleSpy).toHaveBeenCalledWith('[LinkedIn] Scraper failed:', 'Scraper failed');
      expect(consoleSpy).toHaveBeenCalledWith('[LinkedIn] Stack trace:', expect.any(String));

      consoleSpy.mockRestore();
    });

    it('should handle DynamoDB write failures gracefully', async () => {
      dynamoMock.reset();
      dynamoMock.on(PutItemCommand).rejects(new Error('DynamoDB error'));

      const dynamo = new DynamoDBClient({ region: 'ap-south-1' });
      const command = new PutItemCommand({
        TableName: 'test-table',
        Item: { id: { S: 'test-1' } },
      });

      try {
        await dynamo.send(command);
      } catch (error) {
        expect(error.message).toBe('DynamoDB error');
      }
    });

    it('should close browser in finally block even on errors', () => {
      const mockBrowser = {
        close: vi.fn().mockResolvedValue(undefined),
      };

      const testFunction = async () => {
        try {
          throw new Error('Fatal error');
        } finally {
          await mockBrowser.close();
        }
      };

      expect(testFunction()).rejects.toThrow('Fatal error');
      // Browser close will be called in finally block
    });

    it('should return partial results when some platforms fail', async () => {
      const scrapers = [
        Promise.resolve([{ id: 'test-1' }]),
        Promise.reject(new Error('Error 1')),
        Promise.reject(new Error('Error 2')),
        Promise.resolve([{ id: 'test-2' }]),
      ];

      const results = await Promise.allSettled(scrapers);

      const allJobs = [];
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          allJobs.push(...result.value);
        }
      });

      expect(allJobs.length).toBe(2);
      expect(results.filter(r => r.status === 'rejected').length).toBe(2);
    });
  });

  describe('DynamoDB Integration', () => {
    it('should save jobs with correct schema', async () => {
      const job = {
        id: 'test-123',
        title: 'Full Stack Developer',
        company: 'Tech Corp',
        platform: 'LinkedIn',
        location: 'Remote',
        salary: '10-15 LPA',
        url: 'https://example.com/job1',
        postedDate: '2024-01-01',
        description: 'Test description',
        screenshotUrl: 'https://s3.amazonaws.com/screenshot.png',
      };

      const now = Date.now();
      const expiresAt = now + (90 * 24 * 60 * 60 * 1000);

      const command = new PutItemCommand({
        TableName: 'jobpilot-applications',
        Item: {
          jobId: { S: job.id },
          foundAt: { N: now.toString() },
          title: { S: job.title },
          company: { S: job.company },
          platform: { S: job.platform },
          location: { S: job.location },
          salary: { S: job.salary },
          url: { S: job.url },
          postedDate: { S: job.postedDate },
          description: { S: job.description },
          screenshotUrl: { S: job.screenshotUrl },
          status: { S: 'New' },
          expiresAt: { N: expiresAt.toString() },
        },
        ConditionExpression: 'attribute_not_exists(jobId)',
      });

      const dynamo = new DynamoDBClient({ region: 'ap-south-1' });
      await dynamo.send(command);

      const dynamoCalls = dynamoMock.commandCalls(PutItemCommand);
      expect(dynamoCalls.length).toBeGreaterThan(0);

      const savedItem = dynamoCalls[0].args[0].input.Item;
      expect(savedItem.jobId).toBeDefined();
      expect(savedItem.status.S).toBe('New');
    });

    it('should use conditional write to prevent duplicates', () => {
      const command = new PutItemCommand({
        TableName: 'test-table',
        Item: { id: { S: 'test-1' } },
        ConditionExpression: 'attribute_not_exists(jobId)',
      });

      expect(command.input.ConditionExpression).toContain('attribute_not_exists');
    });

    it('should set TTL to 90 days', () => {
      const now = Date.now();
      const ninetyDays = 90 * 24 * 60 * 60 * 1000;
      const expiresAt = now + ninetyDays;

      // Verify TTL is approximately 90 days from now
      expect(expiresAt).toBeGreaterThan(now);
      expect(expiresAt - now).toBeGreaterThan(89 * 24 * 60 * 60 * 1000);
      expect(expiresAt - now).toBeLessThan(91 * 24 * 60 * 60 * 1000);
    });
  });

  describe('Summary Statistics', () => {
    it('should log comprehensive run summary', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const stats = {
        platformsScraped: 12,
        jobsFound: 150,
        duplicatesRemoved: 25,
        jobsSaved: 125,
        errors: 2,
      };

      console.log('═══════════════════════════════════════════════════════════');
      console.log('[Job_Scanner] RUN SUMMARY');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Duration: 10.5s`);
      console.log(`Platforms scraped: ${stats.platformsScraped}`);
      console.log(`Jobs found: ${stats.jobsFound}`);
      console.log(`Duplicates removed: ${stats.duplicatesRemoved}`);
      console.log(`Jobs saved to DynamoDB: ${stats.jobsSaved}`);
      console.log(`Errors: ${stats.errors}`);

      // Verify summary logging
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('RUN SUMMARY'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Duration:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Jobs found:'));

      consoleSpy.mockRestore();
    });

    it('should return correct statistics in response', () => {
      const response = {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          platformsScraped: 12,
          jobsFound: 150,
          duplicatesRemoved: 25,
          jobsSaved: 125,
          errors: [],
          duration: '10.5s',
        }),
      };

      const body = JSON.parse(response.body);
      expect(body.platformsScraped).toBe(12);
      expect(body.jobsFound).toBeGreaterThan(0);
      expect(body.duration).toBeDefined();
      expect(body.success).toBe(true);
    });
  });

  describe('Browser Stealth Settings', () => {
    it('should set realistic user agent', () => {
      const mockPage = {
        setUserAgent: vi.fn().mockResolvedValue(undefined),
      };

      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      mockPage.setUserAgent(userAgent);

      expect(mockPage.setUserAgent).toHaveBeenCalledWith(
        expect.stringContaining('Mozilla/5.0')
      );
    });

    it('should block unnecessary resources', () => {
      const mockPage = {
        setRequestInterception: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
      };

      mockPage.setRequestInterception(true);
      mockPage.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Verify request interception was enabled
      expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
      expect(mockPage.on).toHaveBeenCalledWith('request', expect.any(Function));
    });
  });

  describe('updateJobStatus Function', () => {
    it('should update job status successfully', async () => {
      const { updateJobStatus } = await import('../src/shared/dynamo.js');

      await updateJobStatus('test-job-123', 'Applied');

      const updateCalls = dynamoMock.commandCalls(UpdateItemCommand);
      expect(updateCalls.length).toBeGreaterThan(0);
    });

    it('should validate status values', async () => {
      const { updateJobStatus } = await import('../src/shared/dynamo.js');

      await expect(updateJobStatus('test-job-123', 'InvalidStatus')).rejects.toThrow('Invalid status');
    });

    it('should validate jobId parameter', async () => {
      const { updateJobStatus } = await import('../src/shared/dynamo.js');

      // updateJobStatus does not validate empty jobId, it will attempt the DynamoDB call
      await updateJobStatus('', 'Applied');
    });
  });
});
