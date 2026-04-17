// ── Analytics route handlers
// Computes aggregate metrics from Job_Records for the analytics dashboard.

import { ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { getDynamoClient } from '../../shared/dynamo.js';

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'jobpilot-applications';

/**
 * Scans all records from DynamoDB, handling pagination via LastEvaluatedKey.
 * @returns {Promise<object[]>}
 */
async function scanAllRecords() {
  const dynamo = getDynamoClient();
  const allItems = [];
  let lastKey = undefined;

  do {
    const params = { TableName: TABLE_NAME };
    if (lastKey) {
      params.ExclusiveStartKey = lastKey;
    }

    const response = await dynamo.send(new ScanCommand(params));
    const items = (response.Items || []).map(item => unmarshall(item));
    allItems.push(...items);
    lastKey = response.LastEvaluatedKey;
  } while (lastKey);

  return allItems;
}

/**
 * GET /analytics/grades — grade counts grouped by date for the last 30 days.
 * @returns {{ statusCode: number, body: string }}
 */
export async function handleGetGrades() {
  try {
    const records = await scanAllRecords();
    return {
      statusCode: 200,
      body: JSON.stringify(computeGradeTrends(records)),
    };
  } catch (error) {
    console.error('[Analytics] Failed to compute grade trends:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

/**
 * Computes grade trend data from records.
 * Exported for testing.
 * @param {object[]} records
 * @returns {object[]}
 */
export function computeGradeTrends(records) {
  // Group by foundAt date
  const dateMap = {};
  for (const record of records) {
    const foundAt = record.foundAt || '';
    const date = typeof foundAt === 'string' ? foundAt.slice(0, 10) : '';
    if (!date) continue;

    if (!dateMap[date]) {
      dateMap[date] = { date, A: 0, B: 0, C: 0, D: 0, F: 0 };
    }

    const grade = record.grade || '';
    if (dateMap[date][grade] !== undefined) {
      dateMap[date][grade]++;
    }
  }

  // Get last 30 days
  const now = new Date();
  const result = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    result.push(dateMap[dateStr] || { date: dateStr, A: 0, B: 0, C: 0, D: 0, F: 0 });
  }

  return result;
}

/**
 * GET /analytics/platforms — per-platform aggregated metrics.
 * @returns {{ statusCode: number, body: string }}
 */
export async function handleGetPlatforms() {
  try {
    const records = await scanAllRecords();
    return {
      statusCode: 200,
      body: JSON.stringify(computePlatformMetrics(records)),
    };
  } catch (error) {
    console.error('[Analytics] Failed to compute platform metrics:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

/**
 * Computes per-platform metrics from records.
 * Exported for testing.
 * @param {object[]} records
 * @returns {object[]}
 */
export function computePlatformMetrics(records) {
  const platformMap = {};

  for (const record of records) {
    const platform = record.platform || 'Unknown';
    if (!platformMap[platform]) {
      platformMap[platform] = { platform, total: 0, totalScore: 0, aGradeCount: 0, appliedCount: 0 };
    }

    const entry = platformMap[platform];
    entry.total++;
    entry.totalScore += (typeof record.totalScore === 'number' ? record.totalScore : 0);
    if (record.grade === 'A') entry.aGradeCount++;
    if (record.status === 'Applied') entry.appliedCount++;
  }

  return Object.values(platformMap).map(p => ({
    platform: p.platform,
    total: p.total,
    avgScore: p.total > 0 ? Math.round((p.totalScore / p.total) * 100) / 100 : 0,
    aGradeCount: p.aGradeCount,
    conversionRate: p.total > 0 ? Math.round((p.appliedCount / p.total) * 100 * 100) / 100 : 0,
  }));
}

/**
 * GET /analytics/funnel — funnel stage counts and conversion rates.
 * @returns {{ statusCode: number, body: string }}
 */
export async function handleGetFunnel() {
  try {
    const records = await scanAllRecords();
    return {
      statusCode: 200,
      body: JSON.stringify(computeFunnelMetrics(records)),
    };
  } catch (error) {
    console.error('[Analytics] Failed to compute funnel metrics:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

/**
 * Computes funnel metrics from records.
 * Exported for testing.
 * @param {object[]} records
 * @returns {object}
 */
export function computeFunnelMetrics(records) {
  let found = 0;
  let reviewed = 0;
  let applied = 0;
  let rejected = 0;
  let archived = 0;
  let totalAppliedDays = 0;
  let appliedWithDates = 0;

  for (const record of records) {
    const status = record.status || '';

    // All records count as "found"
    found++;

    switch (status) {
      case 'Reviewed':
        reviewed++;
        break;
      case 'Applied':
        applied++;
        reviewed++; // Applied implies reviewed
        // Compute days from found to applied
        if (record.foundAt && record.updatedAt) {
          const foundDate = new Date(typeof record.foundAt === 'string' ? record.foundAt : Number(record.foundAt));
          const appliedDate = new Date(typeof record.updatedAt === 'number' ? record.updatedAt : Number(record.updatedAt));
          if (!isNaN(foundDate.getTime()) && !isNaN(appliedDate.getTime())) {
            const days = (appliedDate.getTime() - foundDate.getTime()) / (1000 * 60 * 60 * 24);
            if (days >= 0) {
              totalAppliedDays += days;
              appliedWithDates++;
            }
          }
        }
        break;
      case 'Rejected':
        rejected++;
        break;
      case 'Archived':
        archived++;
        break;
      // 'New' status — just counted as found
    }
  }

  const newToAppliedDays = appliedWithDates > 0
    ? Math.round((totalAppliedDays / appliedWithDates) * 100) / 100
    : 0;

  return {
    found,
    reviewed,
    applied,
    rejected,
    archived,
    newToAppliedDays,
  };
}
