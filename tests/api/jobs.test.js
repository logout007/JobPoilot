// ============================================================
// Unit Tests for Jobs API — Notes and Reminder endpoints
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({ send: mockSend })),
  ScanCommand: vi.fn(),
  GetItemCommand: vi.fn(),
  UpdateItemCommand: vi.fn(),
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  unmarshall: vi.fn((item) => {
    // Simple unmarshall mock
    const result = {};
    for (const [key, value] of Object.entries(item)) {
      if (value.S !== undefined) result[key] = value.S;
      else if (value.N !== undefined) result[key] = Number(value.N);
      else if (value.L !== undefined) result[key] = value.L.map(v => {
        if (v.M) {
          const m = {};
          for (const [mk, mv] of Object.entries(v.M)) {
            if (mv.S !== undefined) m[mk] = mv.S;
            else if (mv.N !== undefined) m[mk] = Number(mv.N);
          }
          return m;
        }
        return v;
      });
      else result[key] = value;
    }
    return result;
  }),
}));

describe('handleAddNote', () => {
  let handleAddNote;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../src/api/routes/jobs.js');
    handleAddNote = mod.handleAddNote;
  });

  it('should append a valid note and return the updated notes list', async () => {
    mockSend.mockResolvedValue({
      Attributes: {
        jobId: { S: 'job-123' },
        notes: {
          L: [
            { M: { text: { S: 'My note' }, createdAt: { S: '2025-01-15T10:00:00.000Z' } } },
          ],
        },
      },
    });

    const result = await handleAddNote('job-123', JSON.stringify({ text: 'My note' }));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.notes).toBeDefined();
    expect(Array.isArray(body.notes)).toBe(true);
    expect(body.notes.length).toBe(1);
    expect(body.notes[0].text).toBe('My note');
  });

  it('should return 400 when text is empty', async () => {
    const result = await handleAddNote('job-123', JSON.stringify({ text: '' }));
    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error).toContain('text is required');
  });

  it('should return 400 when text is whitespace only', async () => {
    const result = await handleAddNote('job-123', JSON.stringify({ text: '   ' }));
    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when text is missing', async () => {
    const result = await handleAddNote('job-123', JSON.stringify({}));
    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when body is invalid JSON', async () => {
    const result = await handleAddNote('job-123', 'not json');
    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error).toContain('Invalid JSON');
  });

  it('should call DynamoDB update with correct list_append expression', async () => {
    const { UpdateItemCommand } = await import('@aws-sdk/client-dynamodb');

    mockSend.mockResolvedValue({
      Attributes: {
        jobId: { S: 'job-123' },
        notes: { L: [{ M: { text: { S: 'Test note' }, createdAt: { S: '2025-01-15T10:00:00.000Z' } } }] },
      },
    });

    await handleAddNote('job-123', JSON.stringify({ text: 'Test note' }));

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArg = UpdateItemCommand.mock.calls[0][0];
    expect(callArg.UpdateExpression).toContain('list_append');
    expect(callArg.UpdateExpression).toContain('if_not_exists');
    expect(callArg.ExpressionAttributeValues[':empty']).toEqual({ L: [] });
  });
});

describe('handleSetReminder', () => {
  let handleSetReminder;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../src/api/routes/jobs.js');
    handleSetReminder = mod.handleSetReminder;
  });

  it('should set a reminder date and return the updated job', async () => {
    // First call: UpdateItemCommand succeeds
    mockSend.mockResolvedValueOnce({});
    // Second call: GetItemCommand returns updated job
    mockSend.mockResolvedValueOnce({
      Item: {
        jobId: { S: 'job-123' },
        title: { S: 'Developer' },
        reminderDate: { S: '2025-02-01' },
      },
    });

    const result = await handleSetReminder('job-123', JSON.stringify({ reminderDate: '2025-02-01' }));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.message).toBe('Reminder set successfully');
    expect(body.job.reminderDate).toBe('2025-02-01');
  });

  it('should return 400 when reminderDate is missing', async () => {
    const result = await handleSetReminder('job-123', JSON.stringify({}));
    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when reminderDate is not in YYYY-MM-DD format', async () => {
    const result = await handleSetReminder('job-123', JSON.stringify({ reminderDate: '01-15-2025' }));
    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error).toContain('YYYY-MM-DD');
  });
});
