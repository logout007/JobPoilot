// ── Reminder processing
// Queries DynamoDB for jobs with due reminders and sends SES notification emails.
// Clears reminderDate after successful send; retains on failure for next-day retry.

import { ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { getDynamoClient } from '../shared/dynamo.js';
import { sendEmail } from '../shared/ses.js';

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'jobpilot-applications';
const S3_BUCKET = process.env.S3_BUCKET || 'jobpilot-v2-data';

/**
 * Queries DynamoDB for Job_Records where reminderDate equals today's date.
 * @returns {Promise<object[]>} Array of job records with due reminders.
 */
export async function queryDueReminders() {
  const dynamo = getDynamoClient();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    const allItems = [];
    let lastKey = undefined;

    do {
      const params = {
        TableName: TABLE_NAME,
        FilterExpression: 'reminderDate = :today',
        ExpressionAttributeValues: {
          ':today': { S: today },
        },
      };

      if (lastKey) {
        params.ExclusiveStartKey = lastKey;
      }

      const response = await dynamo.send(new ScanCommand(params));
      const items = (response.Items || []).map(item => unmarshall(item));
      allItems.push(...items);
      lastKey = response.LastEvaluatedKey;
    } while (lastKey);

    console.log(`[Reminders] Found ${allItems.length} jobs with reminders due today (${today})`);
    return allItems;
  } catch (error) {
    console.error('[Reminders] Failed to query due reminders:', error.message);
    return [];
  }
}

/**
 * Builds the HTML email body for a reminder notification.
 * @param {object} job - The job record.
 * @returns {string} HTML email body.
 */
function buildReminderEmail(job) {
  const dashboardUrl = `https://${S3_BUCKET}.s3.ap-south-1.amazonaws.com/index.html`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1f2937;">🔔 JobPilot Reminder</h2>
    <p style="color: #374151;">You have a follow-up reminder for the following job:</p>
    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <h3 style="margin: 0 0 8px 0; color: #111827;">${job.title || 'Unknown Title'}</h3>
      <p style="margin: 4px 0; color: #6b7280;">Company: ${job.company || 'Unknown'}</p>
      <p style="margin: 4px 0; color: #6b7280;">Platform: ${job.platform || 'Unknown'}</p>
      <p style="margin: 4px 0; color: #6b7280;">Status: ${job.status || 'Unknown'}</p>
    </div>
    <a href="${dashboardUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">View in Dashboard</a>
    <p style="margin-top: 24px; color: #9ca3af; font-size: 12px;">This is an automated reminder from JobPilot.</p>
  </div>
</body>
</html>`;
}

/**
 * Clears the reminderDate field on a job record in DynamoDB.
 * @param {string} jobId
 * @returns {Promise<void>}
 */
async function clearReminderDate(jobId) {
  const dynamo = getDynamoClient();

  await dynamo.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: { jobId: { S: jobId } },
    UpdateExpression: 'SET reminderDate = :empty',
    ExpressionAttributeValues: {
      ':empty': { S: '' },
    },
  }));
}

/**
 * Sends reminder emails for each job and clears reminderDate on success.
 * On SES failure, logs the error and retains reminderDate for next-day retry.
 * @param {object[]} jobs - Array of job records with due reminders.
 * @param {string} notifyEmail - Recipient email address.
 * @returns {Promise<void>}
 */
export async function sendReminderEmails(jobs, notifyEmail) {
  for (const job of jobs) {
    const jobId = job.jobId || job.id || '';
    try {
      const subject = `JobPilot Reminder: ${job.title || 'Job'} at ${job.company || 'Unknown'}`;
      const body = buildReminderEmail(job);

      await sendEmail(notifyEmail, subject, body);
      console.log(`[Reminders] Sent reminder for job ${jobId}`);

      // Clear reminderDate on successful send
      await clearReminderDate(jobId);
      console.log(`[Reminders] Cleared reminderDate for job ${jobId}`);
    } catch (error) {
      // Do NOT clear reminderDate — retain for next-day retry
      console.error(`[Reminders] Failed to send reminder for job ${jobId}:`, error.message);
    }
  }
}
