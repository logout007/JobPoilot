// ============================================================
// Unit Tests for Reminder processing
// Tests queryDueReminders and sendReminderEmails
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDynamoSend = vi.fn();
const mockSendEmail = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({ send: mockDynamoSend })),
  ScanCommand: vi.fn(),
  UpdateItemCommand: vi.fn(),
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  unmarshall: vi.fn((item) => {
    const result = {};
    for (const [key, value] of Object.entries(item)) {
      if (value.S !== undefined) result[key] = value.S;
      else if (value.N !== undefined) result[key] = Number(value.N);
      else result[key] = value;
    }
    return result;
  }),
}));

vi.mock('../../src/shared/ses.js', () => ({
  sendEmail: (...args) => mockSendEmail(...args),
}));

describe('reminders', () => {
  let queryDueReminders;
  let sendReminderEmails;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../src/evaluator/reminders.js');
    queryDueReminders = mod.queryDueReminders;
    sendReminderEmails = mod.sendReminderEmails;
  });

  describe('queryDueReminders', () => {
    it('should filter by today\'s date', async () => {
      const { ScanCommand } = await import('@aws-sdk/client-dynamodb');
      const today = new Date().toISOString().split('T')[0];

      mockDynamoSend.mockResolvedValue({
        Items: [
          { jobId: { S: 'job-1' }, title: { S: 'Dev' }, reminderDate: { S: today } },
        ],
      });

      const result = await queryDueReminders();

      expect(result).toHaveLength(1);
      expect(result[0].jobId).toBe('job-1');

      // Verify the scan used today's date in the filter
      const scanParams = ScanCommand.mock.calls[0][0];
      expect(scanParams.FilterExpression).toBe('reminderDate = :today');
      expect(scanParams.ExpressionAttributeValues[':today'].S).toBe(today);
    });

    it('should return empty array on DynamoDB error', async () => {
      mockDynamoSend.mockRejectedValue(new Error('DynamoDB error'));

      const result = await queryDueReminders();
      expect(result).toEqual([]);
    });

    it('should handle pagination via LastEvaluatedKey', async () => {
      mockDynamoSend
        .mockResolvedValueOnce({
          Items: [{ jobId: { S: 'job-1' }, title: { S: 'Dev 1' } }],
          LastEvaluatedKey: { jobId: { S: 'job-1' } },
        })
        .mockResolvedValueOnce({
          Items: [{ jobId: { S: 'job-2' }, title: { S: 'Dev 2' } }],
        });

      const result = await queryDueReminders();
      expect(result).toHaveLength(2);
      expect(mockDynamoSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendReminderEmails', () => {
    it('should send one email per job', async () => {
      mockSendEmail.mockResolvedValue(undefined);
      mockDynamoSend.mockResolvedValue({}); // for clearReminderDate

      const jobs = [
        { jobId: 'job-1', title: 'Dev 1', company: 'Corp A', platform: 'LinkedIn', status: 'Applied' },
        { jobId: 'job-2', title: 'Dev 2', company: 'Corp B', platform: 'Indeed', status: 'New' },
      ];

      await sendReminderEmails(jobs, 'user@example.com');

      expect(mockSendEmail).toHaveBeenCalledTimes(2);
      expect(mockSendEmail.mock.calls[0][0]).toBe('user@example.com');
      expect(mockSendEmail.mock.calls[1][0]).toBe('user@example.com');
    });

    it('should clear reminderDate after successful send', async () => {
      const { UpdateItemCommand } = await import('@aws-sdk/client-dynamodb');

      mockSendEmail.mockResolvedValue(undefined);
      mockDynamoSend.mockResolvedValue({});

      const jobs = [
        { jobId: 'job-1', title: 'Dev', company: 'Corp', platform: 'LinkedIn', status: 'New' },
      ];

      await sendReminderEmails(jobs, 'user@example.com');

      // Should have called DynamoDB to clear reminderDate
      expect(mockDynamoSend).toHaveBeenCalledTimes(1);
      const updateParams = UpdateItemCommand.mock.calls[0][0];
      expect(updateParams.Key.jobId.S).toBe('job-1');
      expect(updateParams.UpdateExpression).toContain('reminderDate');
      expect(updateParams.ExpressionAttributeValues[':empty'].S).toBe('');
    });

    it('should retain reminderDate after SES failure', async () => {
      mockSendEmail.mockRejectedValue(new Error('SES send failed'));

      const jobs = [
        { jobId: 'job-1', title: 'Dev', company: 'Corp', platform: 'LinkedIn', status: 'New' },
      ];

      await sendReminderEmails(jobs, 'user@example.com');

      // Should NOT have called DynamoDB to clear reminderDate
      expect(mockDynamoSend).not.toHaveBeenCalled();
    });
  });
});
