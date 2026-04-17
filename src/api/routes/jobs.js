// ── Job route handlers
// Extracted from api-handler.js — handles /jobs endpoints.

import { ScanCommand, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { getDynamoClient } from '../../shared/dynamo.js';

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'jobpilot-applications';

/**
 * GET /jobs — list jobs with optional grade/status filters and pagination.
 * @param {object|null} queryParams - query string parameters
 * @returns {{ statusCode: number, body: string }}
 */
export async function handleGetJobs(queryParams) {
  const dynamo = getDynamoClient();

  const grade = queryParams?.grade;
  const status = queryParams?.status;
  const limit = parseInt(queryParams?.limit || '100', 10);
  const lastKey = queryParams?.lastEvaluatedKey;

  const params = {
    TableName: TABLE_NAME,
    Limit: limit,
  };

  const filterExpressions = [];
  const expressionAttributeValues = {};

  if (grade && grade !== 'All') {
    filterExpressions.push('grade = :grade');
    expressionAttributeValues[':grade'] = { S: grade };
  }

  if (status && status !== 'All') {
    filterExpressions.push('#status = :status');
    expressionAttributeValues[':status'] = { S: status };
    params.ExpressionAttributeNames = { '#status': 'status' };
  }

  if (filterExpressions.length > 0) {
    params.FilterExpression = filterExpressions.join(' AND ');
    params.ExpressionAttributeValues = expressionAttributeValues;
  }

  if (lastKey) {
    params.ExclusiveStartKey = JSON.parse(Buffer.from(lastKey, 'base64').toString());
  }

  const response = await dynamo.send(new ScanCommand(params));
  const jobs = response.Items?.map(item => unmarshall(item)) || [];

  const result = {
    jobs,
    count: jobs.length,
  };

  if (response.LastEvaluatedKey) {
    result.lastEvaluatedKey = Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64');
  }

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
}

/**
 * GET /jobs/{jobId} — get a single job by ID.
 * @param {string} jobId
 * @returns {{ statusCode: number, body: string }}
 */
export async function handleGetJob(jobId) {
  const dynamo = getDynamoClient();

  if (!jobId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'jobId is required' }),
    };
  }

  const response = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: { jobId: { S: jobId } },
    }),
  );

  if (!response.Item) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Job not found' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(unmarshall(response.Item)),
  };
}

/**
 * PUT /jobs/{jobId}/status — update a job's status.
 * @param {string} jobId
 * @param {string} body - JSON string with { status }
 * @returns {{ statusCode: number, body: string }}
 */
export async function handleUpdateJobStatus(jobId, body) {
  const dynamo = getDynamoClient();

  if (!jobId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'jobId is required' }),
    };
  }

  let requestBody;
  try {
    requestBody = JSON.parse(body || '{}');
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const { status } = requestBody;

  if (!status) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'status is required' }),
    };
  }

  const validStatuses = ['New', 'Reviewed', 'Applied', 'Rejected', 'Archived'];
  if (!validStatuses.includes(status)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      }),
    };
  }

  // Update the status
  try {
    await dynamo.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { jobId: { S: jobId } },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': { S: status },
          ':updatedAt': { N: Date.now().toString() },
        },
        ConditionExpression: 'attribute_exists(jobId)',
      }),
    );
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Job not found or update failed' }),
      };
    }
    throw error;
  }

  // Fetch updated job to return
  const response = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: { jobId: { S: jobId } },
    }),
  );

  const updatedJob = response.Item ? unmarshall(response.Item) : null;

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Status updated successfully',
      job: updatedJob,
    }),
  };
}

/**
 * POST /jobs/{jobId}/notes — append a note to a job's notes list.
 * @param {string} jobId
 * @param {string} body - JSON string with { text }
 * @returns {{ statusCode: number, body: string }}
 */
export async function handleAddNote(jobId, body) {
  const dynamo = getDynamoClient();

  if (!jobId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'jobId is required' }),
    };
  }

  let requestBody;
  try {
    requestBody = JSON.parse(body || '{}');
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const { text } = requestBody;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'text is required and must be non-empty' }),
    };
  }

  const note = {
    M: {
      text: { S: text.trim() },
      createdAt: { S: new Date().toISOString() },
    },
  };

  try {
    const result = await dynamo.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { jobId: { S: jobId } },
        UpdateExpression: 'SET notes = list_append(if_not_exists(notes, :empty), :note)',
        ExpressionAttributeValues: {
          ':empty': { L: [] },
          ':note': { L: [note] },
        },
        ReturnValues: 'ALL_NEW',
      }),
    );

    const updatedItem = result.Attributes ? unmarshall(result.Attributes) : {};
    const notes = updatedItem.notes || [];

    return {
      statusCode: 200,
      body: JSON.stringify({ notes }),
    };
  } catch (error) {
    console.error(`[API] Failed to add note to job ${jobId}:`, error.message);
    throw error;
  }
}

/**
 * PUT /jobs/{jobId}/reminder — set or update a reminder date on a job.
 * @param {string} jobId
 * @param {string} body - JSON string with { reminderDate } in YYYY-MM-DD format
 * @returns {{ statusCode: number, body: string }}
 */
export async function handleSetReminder(jobId, body) {
  const dynamo = getDynamoClient();

  if (!jobId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'jobId is required' }),
    };
  }

  let requestBody;
  try {
    requestBody = JSON.parse(body || '{}');
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const { reminderDate } = requestBody;

  if (!reminderDate || typeof reminderDate !== 'string') {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'reminderDate is required (YYYY-MM-DD format)' }),
    };
  }

  // Validate YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(reminderDate)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'reminderDate must be in YYYY-MM-DD format' }),
    };
  }

  try {
    await dynamo.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { jobId: { S: jobId } },
        UpdateExpression: 'SET reminderDate = :reminderDate, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':reminderDate': { S: reminderDate },
          ':updatedAt': { N: Date.now().toString() },
        },
        ConditionExpression: 'attribute_exists(jobId)',
      }),
    );
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Job not found' }),
      };
    }
    throw error;
  }

  // Fetch updated job to return
  const response = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: { jobId: { S: jobId } },
    }),
  );

  const updatedJob = response.Item ? unmarshall(response.Item) : null;

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Reminder set successfully',
      job: updatedJob,
    }),
  };
}
