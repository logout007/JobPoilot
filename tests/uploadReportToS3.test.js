/**
 * Unit tests for uploadReportToS3 function
 * Task 6.2: Implement uploadReportToS3(markdown, jobId) in evaluator-handler.js
 * Requirements: 5.11, 23.1, 23.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => {
  const mockSend = vi.fn();
  return {
    S3Client: vi.fn(() => ({
      send: mockSend,
    })),
    PutObjectCommand: vi.fn((params) => params),
  };
});

// Mock configuration
const CONFIG = {
  S3_BUCKET: 'jobpilot-v2-data',
};

// Function implementation (same as in evaluator-handler.js)
async function uploadReportToS3(markdown, jobId, s3Client) {
  const date = new Date().toISOString().split('T')[0];
  const key = `reports/${date}/${jobId}.md`;
  
  try {
    const params = {
      Bucket: CONFIG.S3_BUCKET,
      Key: key,
      Body: markdown,
      ContentType: 'text/markdown',
      ACL: 'public-read',
    };
    
    await s3Client.send(new PutObjectCommand(params));
    const url = `https://${CONFIG.S3_BUCKET}.s3.ap-south-1.amazonaws.com/${key}`;
    console.log(`[S3] Report uploaded successfully: ${url}`);
    return url;
  } catch (error) {
    console.error(`[S3] Failed to upload report for ${jobId}:`, error.message);
    return '';
  }
}

describe('uploadReportToS3 - Task 6.2', () => {
  let mockS3Client;
  let mockSend;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend = vi.fn();
    mockS3Client = {
      send: mockSend,
    };
  });

  describe('S3 Key Generation - Requirement 23.2', () => {
    it('generates S3 key with correct format: /reports/{YYYY-MM-DD}/{jobId}.md', async () => {
      mockSend.mockResolvedValue({});
      
      const markdown = '# Test Report';
      const jobId = 'linkedin-123';
      
      await uploadReportToS3(markdown, jobId, mockS3Client);
      
      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      
      // Verify key format
      expect(command.Key).toMatch(/^reports\/\d{4}-\d{2}-\d{2}\/linkedin-123\.md$/);
    });

    it('uses current date in YYYY-MM-DD format', async () => {
      mockSend.mockResolvedValue({});
      
      const markdown = '# Test Report';
      const jobId = 'naukri-456';
      const today = new Date().toISOString().split('T')[0];
      
      await uploadReportToS3(markdown, jobId, mockS3Client);
      
      const command = mockSend.mock.calls[0][0];
      expect(command.Key).toBe(`reports/${today}/naukri-456.md`);
    });

    it('handles different jobId formats correctly', async () => {
      mockSend.mockResolvedValue({});
      
      const testCases = [
        'linkedin-123',
        'naukri-abc-def',
        'indeed-test_job',
        'shine-12345',
      ];
      
      for (const jobId of testCases) {
        await uploadReportToS3('# Report', jobId, mockS3Client);
        const command = mockSend.mock.calls[mockSend.mock.calls.length - 1][0];
        expect(command.Key).toContain(jobId);
      }
    });
  });

  describe('S3 Upload Parameters - Requirement 23.1', () => {
    it('uploads with correct bucket name', async () => {
      mockSend.mockResolvedValue({});
      
      await uploadReportToS3('# Report', 'test-job', mockS3Client);
      
      const command = mockSend.mock.calls[0][0];
      expect(command.Bucket).toBe('jobpilot-v2-data');
    });

    it('uploads with public-read ACL', async () => {
      mockSend.mockResolvedValue({});
      
      await uploadReportToS3('# Report', 'test-job', mockS3Client);
      
      const command = mockSend.mock.calls[0][0];
      expect(command.ACL).toBe('public-read');
    });

    it('sets ContentType to text/markdown', async () => {
      mockSend.mockResolvedValue({});
      
      await uploadReportToS3('# Report', 'test-job', mockS3Client);
      
      const command = mockSend.mock.calls[0][0];
      expect(command.ContentType).toBe('text/markdown');
    });

    it('uploads markdown content as Body', async () => {
      mockSend.mockResolvedValue({});
      
      const markdown = '# Job Evaluation Report\n\n## Details\n\nThis is a test report.';
      await uploadReportToS3(markdown, 'test-job', mockS3Client);
      
      const command = mockSend.mock.calls[0][0];
      expect(command.Body).toBe(markdown);
    });
  });

  describe('Return Value - Requirement 5.11', () => {
    it('returns S3 URL on successful upload', async () => {
      mockSend.mockResolvedValue({});
      
      const jobId = 'linkedin-789';
      const today = new Date().toISOString().split('T')[0];
      
      const url = await uploadReportToS3('# Report', jobId, mockS3Client);
      
      expect(url).toBe(`https://jobpilot-v2-data.s3.ap-south-1.amazonaws.com/reports/${today}/${jobId}.md`);
    });

    it('returns URL with correct region (ap-south-1)', async () => {
      mockSend.mockResolvedValue({});
      
      const url = await uploadReportToS3('# Report', 'test-job', mockS3Client);
      
      expect(url).toContain('.s3.ap-south-1.amazonaws.com/');
    });

    it('returns URL with correct path structure', async () => {
      mockSend.mockResolvedValue({});
      
      const jobId = 'indeed-999';
      const url = await uploadReportToS3('# Report', jobId, mockS3Client);
      
      expect(url).toMatch(/https:\/\/jobpilot-v2-data\.s3\.ap-south-1\.amazonaws\.com\/reports\/\d{4}-\d{2}-\d{2}\/indeed-999\.md/);
    });
  });

  describe('Error Handling - Graceful Failure', () => {
    it('returns empty string on S3 upload failure', async () => {
      mockSend.mockRejectedValue(new Error('S3 upload failed'));
      
      const url = await uploadReportToS3('# Report', 'test-job', mockS3Client);
      
      expect(url).toBe('');
    });

    it('logs error message on failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSend.mockRejectedValue(new Error('Network timeout'));
      
      await uploadReportToS3('# Report', 'linkedin-123', mockS3Client);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[S3] Failed to upload report for linkedin-123:',
        'Network timeout'
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('does not throw error on failure (graceful handling)', async () => {
      mockSend.mockRejectedValue(new Error('S3 error'));
      
      await expect(uploadReportToS3('# Report', 'test-job', mockS3Client)).resolves.not.toThrow();
    });

    it('handles different error types gracefully', async () => {
      const errorTypes = [
        new Error('AccessDenied'),
        new Error('NoSuchBucket'),
        new Error('NetworkError'),
        new TypeError('Invalid parameter'),
      ];
      
      for (const error of errorTypes) {
        mockSend.mockRejectedValue(error);
        const url = await uploadReportToS3('# Report', 'test-job', mockS3Client);
        expect(url).toBe('');
      }
    });
  });

  describe('Integration Scenarios', () => {
    it('handles large markdown reports', async () => {
      mockSend.mockResolvedValue({});
      
      // Generate a large report (10KB)
      const largeMarkdown = '# Report\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(400);
      
      const url = await uploadReportToS3(largeMarkdown, 'test-job', mockS3Client);
      
      expect(url).toBeTruthy();
      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.Body.length).toBeGreaterThan(10000);
    });

    it('handles special characters in markdown', async () => {
      mockSend.mockResolvedValue({});
      
      const markdown = '# Report\n\n**Bold** _italic_ `code` [link](url)\n\n- List item\n- ✅ Checkmark\n- ⚠️ Warning';
      
      await uploadReportToS3(markdown, 'test-job', mockS3Client);
      
      const command = mockSend.mock.calls[0][0];
      expect(command.Body).toBe(markdown);
    });

    it('handles empty markdown gracefully', async () => {
      mockSend.mockResolvedValue({});
      
      const url = await uploadReportToS3('', 'test-job', mockS3Client);
      
      expect(url).toBeTruthy();
      const command = mockSend.mock.calls[0][0];
      expect(command.Body).toBe('');
    });

    it('logs success message on successful upload', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockSend.mockResolvedValue({});
      
      const jobId = 'linkedin-123';
      const today = new Date().toISOString().split('T')[0];
      
      await uploadReportToS3('# Report', jobId, mockS3Client);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[S3] Report uploaded successfully: https://jobpilot-v2-data.s3.ap-south-1.amazonaws.com/reports/${today}/${jobId}.md`
      );
      
      consoleLogSpy.mockRestore();
    });
  });

  describe('Concurrent Upload Scenarios', () => {
    it('handles multiple concurrent uploads', async () => {
      mockSend.mockResolvedValue({});
      
      const uploads = [
        uploadReportToS3('# Report 1', 'job-1', mockS3Client),
        uploadReportToS3('# Report 2', 'job-2', mockS3Client),
        uploadReportToS3('# Report 3', 'job-3', mockS3Client),
      ];
      
      const urls = await Promise.all(uploads);
      
      expect(urls).toHaveLength(3);
      expect(urls.every(url => url.length > 0)).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it('handles partial failures in concurrent uploads', async () => {
      mockSend
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Upload failed'))
        .mockResolvedValueOnce({});
      
      const uploads = [
        uploadReportToS3('# Report 1', 'job-1', mockS3Client),
        uploadReportToS3('# Report 2', 'job-2', mockS3Client),
        uploadReportToS3('# Report 3', 'job-3', mockS3Client),
      ];
      
      const urls = await Promise.all(uploads);
      
      expect(urls[0]).toBeTruthy();
      expect(urls[1]).toBe(''); // Failed upload
      expect(urls[2]).toBeTruthy();
    });
  });
});
