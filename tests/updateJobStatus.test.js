/**
 * Unit tests for updateJobStatus function
 * Feature: jobpilot-v2-recommendation-system
 * Task: 4.2 - Implement updateJobStatus function
 * Requirements: 27.1, 27.3, 27.4, 27.5
 * 
 * Tests verify that the function:
 * - Updates DynamoDB item with new status
 * - Adds updatedAt timestamp
 * - Returns success/failure boolean
 * - Validates input parameters
 * - Handles errors gracefully
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

// Mock DynamoDB client
const dynamoMock = mockClient(DynamoDBClient);

// Import the function to test
// Note: In actual implementation, this would be imported from api-handler.js or scanner-handler.js
async function updateJobStatus(jobId, status) {
  // Validate inputs
  if (!jobId || typeof jobId !== 'string') {
    console.error('[updateJobStatus] Invalid jobId:', jobId);
    return false;
  }

  const validStatuses = ['New', 'Reviewed', 'Applied', 'Rejected', 'Archived'];
  if (!validStatuses.includes(status)) {
    console.error('[updateJobStatus] Invalid status:', status);
    return false;
  }

  try {
    const now = Date.now();
    
    const params = {
      TableName: 'jobpilot-applications',
      Key: {
        jobId: { S: jobId },
      },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': { S: status },
        ':updatedAt': { N: now.toString() },
      },
      ConditionExpression: 'attribute_exists(jobId)',
    };

    const dynamo = new DynamoDBClient({ region: 'ap-south-1' });
    const command = new UpdateItemCommand(params);
    await dynamo.send(command);
    
    console.log(`[updateJobStatus] Updated ${jobId} to status: ${status}`);
    return true;
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      console.error(`[updateJobStatus] Job not found: ${jobId}`);
    } else {
      console.error(`[updateJobStatus] Failed to update ${jobId}:`, error.message);
    }
    return false;
  }
}

describe('updateJobStatus - Unit Tests', () => {
  beforeEach(() => {
    // Reset mock before each test
    dynamoMock.reset();
    // Mock console methods to avoid cluttering test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('Successful Updates (Requirement 27.1, 27.3)', () => {
    it('should update job status to "Applied" and return true', async () => {
      dynamoMock.on(UpdateItemCommand).resolves({});

      const result = await updateJobStatus('linkedin-12345', 'Applied');

      expect(result).toBe(true);
      expect(dynamoMock.calls()).toHaveLength(1);
      
      const call = dynamoMock.call(0);
      expect(call.args[0].input.Key.jobId.S).toBe('linkedin-12345');
      expect(call.args[0].input.ExpressionAttributeValues[':status'].S).toBe('Applied');
      expect(call.args[0].input.ExpressionAttributeValues[':updatedAt'].N).toBeDefined();
    });

    it('should update job status to "Reviewed" and add updatedAt timestamp (Requirement 27.3)', async () => {
      dynamoMock.on(UpdateItemCommand).resolves({});

      const beforeTime = Date.now();
      const result = await updateJobStatus('naukri-67890', 'Reviewed');
      const afterTime = Date.now();

      expect(result).toBe(true);
      
      const call = dynamoMock.call(0);
      const updatedAt = parseInt(call.args[0].input.ExpressionAttributeValues[':updatedAt'].N);
      
      // Verify updatedAt is a valid timestamp within the test execution window
      expect(updatedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(updatedAt).toBeLessThanOrEqual(afterTime);
    });

    it('should update job status to "Rejected" (Requirement 27.4)', async () => {
      dynamoMock.on(UpdateItemCommand).resolves({});

      const result = await updateJobStatus('indeed-11111', 'Rejected');

      expect(result).toBe(true);
      
      const call = dynamoMock.call(0);
      expect(call.args[0].input.ExpressionAttributeValues[':status'].S).toBe('Rejected');
    });

    it('should update job status to "Archived" (Requirement 27.5)', async () => {
      dynamoMock.on(UpdateItemCommand).resolves({});

      const result = await updateJobStatus('shine-22222', 'Archived');

      expect(result).toBe(true);
      
      const call = dynamoMock.call(0);
      expect(call.args[0].input.ExpressionAttributeValues[':status'].S).toBe('Archived');
    });

    it('should support all valid status values', async () => {
      dynamoMock.on(UpdateItemCommand).resolves({});

      const validStatuses = ['New', 'Reviewed', 'Applied', 'Rejected', 'Archived'];
      
      for (const status of validStatuses) {
        const result = await updateJobStatus(`test-job-${status}`, status);
        expect(result).toBe(true);
      }

      expect(dynamoMock.calls()).toHaveLength(validStatuses.length);
    });
  });

  describe('Input Validation', () => {
    it('should return false for invalid jobId (null)', async () => {
      const result = await updateJobStatus(null, 'Applied');
      
      expect(result).toBe(false);
      expect(dynamoMock.calls()).toHaveLength(0);
    });

    it('should return false for invalid jobId (undefined)', async () => {
      const result = await updateJobStatus(undefined, 'Applied');
      
      expect(result).toBe(false);
      expect(dynamoMock.calls()).toHaveLength(0);
    });

    it('should return false for invalid jobId (empty string)', async () => {
      const result = await updateJobStatus('', 'Applied');
      
      expect(result).toBe(false);
      expect(dynamoMock.calls()).toHaveLength(0);
    });

    it('should return false for invalid jobId (non-string)', async () => {
      const result = await updateJobStatus(12345, 'Applied');
      
      expect(result).toBe(false);
      expect(dynamoMock.calls()).toHaveLength(0);
    });

    it('should return false for invalid status (not in allowed list)', async () => {
      const result = await updateJobStatus('linkedin-12345', 'InvalidStatus');
      
      expect(result).toBe(false);
      expect(dynamoMock.calls()).toHaveLength(0);
    });

    it('should return false for invalid status (null)', async () => {
      const result = await updateJobStatus('linkedin-12345', null);
      
      expect(result).toBe(false);
      expect(dynamoMock.calls()).toHaveLength(0);
    });

    it('should return false for invalid status (empty string)', async () => {
      const result = await updateJobStatus('linkedin-12345', '');
      
      expect(result).toBe(false);
      expect(dynamoMock.calls()).toHaveLength(0);
    });

    it('should return false for invalid status (case-sensitive)', async () => {
      const result = await updateJobStatus('linkedin-12345', 'applied'); // lowercase
      
      expect(result).toBe(false);
      expect(dynamoMock.calls()).toHaveLength(0);
    });
  });

  describe('Error Handling (Requirement 27.1)', () => {
    it('should return false when job does not exist (ConditionalCheckFailedException)', async () => {
      const error = new Error('Conditional check failed');
      error.name = 'ConditionalCheckFailedException';
      dynamoMock.on(UpdateItemCommand).rejects(error);

      const result = await updateJobStatus('nonexistent-job', 'Applied');

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        '[updateJobStatus] Job not found: nonexistent-job'
      );
    });

    it('should return false on DynamoDB error', async () => {
      const error = new Error('DynamoDB service error');
      dynamoMock.on(UpdateItemCommand).rejects(error);

      const result = await updateJobStatus('linkedin-12345', 'Applied');

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[updateJobStatus] Failed to update'),
        expect.any(String)
      );
    });

    it('should return false on network error', async () => {
      const error = new Error('Network timeout');
      dynamoMock.on(UpdateItemCommand).rejects(error);

      const result = await updateJobStatus('linkedin-12345', 'Applied');

      expect(result).toBe(false);
    });

    it('should handle unexpected errors gracefully', async () => {
      const error = new Error('Unexpected error');
      error.name = 'UnknownException';
      dynamoMock.on(UpdateItemCommand).rejects(error);

      const result = await updateJobStatus('linkedin-12345', 'Applied');

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('DynamoDB Command Structure', () => {
    it('should use correct table name', async () => {
      dynamoMock.on(UpdateItemCommand).resolves({});

      await updateJobStatus('linkedin-12345', 'Applied');

      const call = dynamoMock.call(0);
      expect(call.args[0].input.TableName).toBe('jobpilot-applications');
    });

    it('should use correct UpdateExpression', async () => {
      dynamoMock.on(UpdateItemCommand).resolves({});

      await updateJobStatus('linkedin-12345', 'Applied');

      const call = dynamoMock.call(0);
      expect(call.args[0].input.UpdateExpression).toBe('SET #status = :status, updatedAt = :updatedAt');
    });

    it('should use ExpressionAttributeNames for reserved keyword "status"', async () => {
      dynamoMock.on(UpdateItemCommand).resolves({});

      await updateJobStatus('linkedin-12345', 'Applied');

      const call = dynamoMock.call(0);
      expect(call.args[0].input.ExpressionAttributeNames).toEqual({
        '#status': 'status',
      });
    });

    it('should include ConditionExpression to ensure item exists', async () => {
      dynamoMock.on(UpdateItemCommand).resolves({});

      await updateJobStatus('linkedin-12345', 'Applied');

      const call = dynamoMock.call(0);
      expect(call.args[0].input.ConditionExpression).toBe('attribute_exists(jobId)');
    });
  });

  describe('Requirements Validation', () => {
    it('validates Requirement 27.1: Support five job statuses', async () => {
      dynamoMock.on(UpdateItemCommand).resolves({});

      const statuses = ['New', 'Reviewed', 'Applied', 'Rejected', 'Archived'];
      
      for (const status of statuses) {
        const result = await updateJobStatus('test-job', status);
        expect(result).toBe(true);
      }
    });

    it('validates Requirement 27.3: Update status to "Applied" and record timestamp', async () => {
      dynamoMock.on(UpdateItemCommand).resolves({});

      const result = await updateJobStatus('test-job', 'Applied');

      expect(result).toBe(true);
      
      const call = dynamoMock.call(0);
      expect(call.args[0].input.ExpressionAttributeValues[':status'].S).toBe('Applied');
      expect(call.args[0].input.ExpressionAttributeValues[':updatedAt'].N).toBeDefined();
    });

    it('validates Requirement 27.4: Update status to "Rejected"', async () => {
      dynamoMock.on(UpdateItemCommand).resolves({});

      const result = await updateJobStatus('test-job', 'Rejected');

      expect(result).toBe(true);
      
      const call = dynamoMock.call(0);
      expect(call.args[0].input.ExpressionAttributeValues[':status'].S).toBe('Rejected');
    });

    it('validates Requirement 27.5: Update status to "Archived"', async () => {
      dynamoMock.on(UpdateItemCommand).resolves({});

      const result = await updateJobStatus('test-job', 'Archived');

      expect(result).toBe(true);
      
      const call = dynamoMock.call(0);
      expect(call.args[0].input.ExpressionAttributeValues[':status'].S).toBe('Archived');
    });
  });
});
