// ── DynamoDB helpers
// Shared client and record operations for the jobpilot-applications table.

import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'jobpilot-applications';
const REGION = 'ap-south-1';

const client = new DynamoDBClient({ region: REGION });

/**
 * Returns the shared DynamoDB client instance.
 * @returns {DynamoDBClient}
 */
export function getDynamoClient() {
  return client;
}

const VALID_STATUSES = ['New', 'Reviewed', 'Applied', 'Rejected', 'Archived'];

/**
 * Writes a new Job_Record to DynamoDB.
 * Uses a conditional expression to avoid overwriting existing records.
 * Sets expiresAt to 90 days from now and status to "New".
 * @param {object} job - The job data to save.
 * @returns {Promise<void>}
 */
export async function saveJobRecord(job) {
  const expiresAt = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;

  const item = {
    jobId: { S: job.jobId },
    foundAt: { N: String(job.foundAt || Date.now()) },
    title: { S: job.title || '' },
    company: { S: job.company || '' },
    platform: { S: job.platform || '' },
    location: { S: job.location || '' },
    salary: { S: job.salary || '' },
    url: { S: job.url || '' },
    postedDate: { S: job.postedDate || '' },
    description: { S: job.description || '' },
    grade: { S: job.grade || '' },
    totalScore: { N: String(job.totalScore ?? 0) },
    dimensionScores: { S: JSON.stringify(job.dimensionScores || {}) },
    screenshotUrl: { S: job.screenshotUrl || '' },
    reportUrl: { S: job.reportUrl || '' },
    tailoringUrl: { S: job.tailoringUrl || '' },
    status: { S: 'New' },
    notes: { L: [] },
    expiresAt: { N: String(expiresAt) },
  };

  // Only include reminderDate if it has a value — DynamoDB GSI keys cannot be empty strings
  if (job.reminderDate) {
    item.reminderDate = { S: job.reminderDate };
  }

  const command = new PutItemCommand({
    TableName: TABLE_NAME,
    Item: item,
    ConditionExpression: 'attribute_not_exists(jobId)',
  });

  await client.send(command);
}

/**
 * Updates the status of a Job_Record.
 * @param {string} jobId - The job ID.
 * @param {string} status - One of New, Reviewed, Applied, Rejected, Archived.
 * @returns {Promise<void>}
 * @throws {Error} If the status is not valid.
 */
export async function updateJobStatus(jobId, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status "${status}". Must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const command = new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: { jobId: { S: jobId } },
    UpdateExpression: 'SET #s = :status, updatedAt = :now',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: {
      ':status': { S: status },
      ':now': { S: new Date().toISOString() },
    },
  });

  await client.send(command);
}

/**
 * Checks whether a Job_Record with the given jobId already exists.
 * @param {string} jobId - The job ID to check.
 * @returns {Promise<boolean>} True if the record exists.
 */
export async function checkAlreadyApplied(jobId) {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'jobId = :id',
    ExpressionAttributeValues: { ':id': { S: jobId } },
    Limit: 1,
  });

  const response = await client.send(command);
  return (response.Items?.length ?? 0) > 0;
}
