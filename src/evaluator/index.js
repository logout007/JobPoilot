// ── JobPilot Evaluator Lambda Handler
// Orchestrates the full evaluation pipeline: fetch new jobs, evaluate with
// Gemini AI, grade, generate reports, upload to S3, and send notifications.

import { ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { evaluateJobWithGemini, initGemini } from './evaluator.js';
import { calculateGrade } from './grader.js';
import { generateEvaluationReport, uploadReportToS3 } from './reporter.js';
import { generateTailoringPackage, uploadTailoringToS3, initTailoringGemini } from './tailoring.js';
import { queryDueReminders, sendReminderEmails } from './reminders.js';
import { getParam } from '../shared/ssm.js';
import { getDynamoClient } from '../shared/dynamo.js';
import { sendEmail } from '../shared/ses.js';

// ── Configuration
const TABLE_NAME = process.env.DYNAMODB_TABLE || 'jobpilot-applications';
const S3_BUCKET = process.env.S3_BUCKET || 'jobpilot-v2-data';

// ══════════════════════════════════════════════════════════════
// DynamoDB helpers
// ══════════════════════════════════════════════════════════════

/**
 * Queries DynamoDB for jobs with status "New".
 * @returns {Promise<object[]>}
 */
export async function fetchNewJobs() {
  const dynamo = getDynamoClient();

  try {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: '#status = :statusValue',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':statusValue': { S: 'New' } },
    };

    const response = await dynamo.send(new ScanCommand(params));

    const jobs = (response.Items || []).map(item => ({
      id: item.jobId?.S || '',
      title: item.title?.S || '',
      company: item.company?.S || '',
      platform: item.platform?.S || '',
      location: item.location?.S || '',
      salary: item.salary?.S || '',
      url: item.url?.S || '',
      postedDate: item.postedDate?.S || '',
      description: item.description?.S || '',
      screenshotUrl: item.screenshotUrl?.S || '',
      foundAt: item.foundAt?.N || '',
    }));

    console.log(`[DynamoDB] Found ${jobs.length} jobs with status "New"`);
    return jobs;
  } catch (error) {
    console.error('[DynamoDB] Failed to fetch new jobs:', error.message);
    return [];
  }
}

/**
 * Updates a job record in DynamoDB with evaluation results.
 * @param {string} jobId
 * @param {object} evaluation - { grade, totalScore, dimensionScores, reportUrl }
 * @returns {Promise<void>}
 */
export async function updateJobWithEvaluation(jobId, evaluation) {
  const dynamo = getDynamoClient();

  try {
    // Convert dimensionScores object to DynamoDB Map format
    const dimensionScoresMap = {};
    for (const [key, value] of Object.entries(evaluation.dimensionScores)) {
      dimensionScoresMap[key] = { N: value.toString() };
    }

    const params = {
      TableName: TABLE_NAME,
      Key: { jobId: { S: jobId } },
      UpdateExpression:
        'SET grade = :grade, totalScore = :score, dimensionScores = :dimensions, reportUrl = :reportUrl, tailoringUrl = :tailoringUrl, #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':grade': { S: evaluation.grade },
        ':score': { N: evaluation.totalScore.toString() },
        ':dimensions': { M: dimensionScoresMap },
        ':reportUrl': { S: evaluation.reportUrl },
        ':tailoringUrl': { S: evaluation.tailoringUrl || '' },
        ':status': { S: 'New' }, // Keep status as "New" until user reviews
        ':updatedAt': { N: Date.now().toString() },
      },
    };

    await dynamo.send(new UpdateItemCommand(params));
    console.log(`[DynamoDB] Updated job ${jobId} with evaluation data`);
  } catch (error) {
    console.error(`[DynamoDB] Failed to update job ${jobId}:`, error.message);
    // Don't throw — allow processing to continue for other jobs
  }
}

// ══════════════════════════════════════════════════════════════
// Email notification
// ══════════════════════════════════════════════════════════════

/**
 * Builds the HTML email body for A-grade job notifications.
 * @param {object[]} jobs
 * @returns {string}
 */
function buildNotificationEmail(jobs) {
  const dashboardUrl = `https://${S3_BUCKET}.s3.ap-south-1.amazonaws.com/index.html`;

  const jobCards = jobs.map(job => {
    const strengths = job.strengths || [];
    const top3Strengths = strengths.slice(0, 3);
    const strengthsList = top3Strengths.length > 0
      ? top3Strengths.map(s => `<li style="margin: 4px 0; color: #059669;">${s}</li>`).join('')
      : '<li style="margin: 4px 0; color: #6b7280;">No specific strengths listed</li>';

    return `
      <div style="background: #f9fafb; border: 2px solid #10b981; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="background: #10b981; color: white; font-weight: bold; padding: 4px 12px; border-radius: 4px; margin-right: 12px;">Grade A</span>
          <span style="background: #e5e7eb; color: #374151; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${job.platform}</span>
        </div>
        <h3 style="margin: 8px 0; color: #111827; font-size: 18px;">${job.title}</h3>
        <p style="margin: 4px 0; color: #6b7280; font-size: 14px;">${job.company}</p>
        <p style="margin: 8px 0; color: #374151; font-weight: 600;">Score: ${job.totalScore}/5.0</p>
        <div style="margin-top: 12px;">
          <p style="margin: 4px 0; color: #374151; font-weight: 600; font-size: 14px;">Top Strengths:</p>
          <ul style="margin: 4px 0; padding-left: 20px;">
            ${strengthsList}
          </ul>
        </div>
        <div style="margin-top: 12px;">
          <a href="${job.url}" style="display: inline-block; background: #2563eb; color: white; padding: 8px 16px; border-radius: 4px; text-decoration: none; margin-right: 8px;">Apply on ${job.platform}</a>
          <a href="${dashboardUrl}" style="display: inline-block; background: #6b7280; color: white; padding: 8px 16px; border-radius: 4px; text-decoration: none;">View in Dashboard</a>
        </div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JobPilot V2 - A-Grade Jobs Found</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #ffffff; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
      <h1 style="margin: 0; font-size: 24px;">🎯 JobPilot V2</h1>
      <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">A-Grade Jobs Found!</p>
    </div>
    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      <p style="margin: 0; color: #374151; font-size: 14px;">
        Great news! We found <strong>${jobs.length} A-grade job${jobs.length > 1 ? 's' : ''}</strong> that are excellent matches for your profile. These are high-priority opportunities you should review and apply to quickly.
      </p>
    </div>
    ${jobCards}
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 8px 0; color: #6b7280; font-size: 12px;">
        This is an automated notification from JobPilot V2. Jobs are evaluated daily at 09:00 IST.
      </p>
      <p style="margin: 8px 0;">
        <a href="${dashboardUrl}" style="color: #2563eb; text-decoration: none; font-size: 14px;">View Full Dashboard →</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Filters A-grade jobs, builds an HTML email, and sends via shared SES.
 * @param {object[]} jobs - Jobs that have been graded (must include `grade` property).
 * @param {string} notifyEmail - Recipient email address.
 * @returns {Promise<void>}
 */
export async function sendAGradeNotification(jobs, notifyEmail) {
  const aGradeJobs = jobs.filter(job => job.grade === 'A');

  if (aGradeJobs.length === 0) {
    console.log('[SES] No A-grade jobs to notify');
    return;
  }

  const subject = `JobPilot V2: ${aGradeJobs.length} A-Grade Job${aGradeJobs.length > 1 ? 's' : ''} Found!`;
  const body = buildNotificationEmail(aGradeJobs);

  try {
    await sendEmail(notifyEmail, subject, body);
    console.log(`[SES] Sent A-grade notification for ${aGradeJobs.length} jobs`);
  } catch (error) {
    console.error('[SES] Failed to send notification:', error.message);
    // Do not throw — allow processing to continue
  }
}

// ══════════════════════════════════════════════════════════════
// User profile
// ══════════════════════════════════════════════════════════════

/**
 * Fetches the user profile from SSM parameters, falling back to defaults.
 * @returns {Promise<object>}
 */
export async function fetchUserProfile() {
  try {
    return {
      name: 'Job Seeker',
      role: 'Full Stack Developer',
      company: 'Current Company',
      experience: '3+ years',
      skills: 'Node.js, TypeScript, React, AWS, MongoDB, PostgreSQL, REST APIs, Microservices',
      location: 'India',
      workArrangement: 'Remote or Hybrid',
      minSalary: 12,
      targetRoles: 'Full Stack Developer, Backend Engineer, Node.js Developer, Software Engineer',
    };
  } catch (error) {
    console.error('[SSM] Failed to fetch user profile:', error.message);
    return {
      name: 'Job Seeker',
      role: 'Full Stack Developer',
      company: 'Current Company',
      experience: '3+ years',
      skills: 'Node.js, TypeScript, React',
      location: 'India',
      workArrangement: 'Remote',
      minSalary: 12,
      targetRoles: 'Full Stack Developer, Backend Engineer',
    };
  }
}

// ══════════════════════════════════════════════════════════════
// Utility
// ══════════════════════════════════════════════════════════════

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════

/**
 * Lambda handler — triggered after Job_Scanner completes.
 */
export const handler = async (event) => {
  console.log('[Job_Evaluator] Run started', new Date().toISOString());

  try {
    // 1. Fetch SSM parameters
    const geminiKey = await getParam('/jobpilot/gemini/apikey');
    const cvText = await getParam('/jobpilot/cv/text');
    const notifyEmail = await getParam('/jobpilot/notify/email');
    const userProfile = await fetchUserProfile();

    // 2. Initialize Gemini AI client
    initGemini(geminiKey);
    initTailoringGemini(geminiKey);

    // 3. Query DynamoDB for jobs with status "New"
    const jobs = await fetchNewJobs();
    console.log(`[Job_Evaluator] Found ${jobs.length} new jobs to evaluate`);

    if (jobs.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No new jobs to evaluate' }),
      };
    }

    // 4. Evaluate jobs sequentially (respect Gemini API rate limit)
    const aGradeJobs = [];
    const results = { evaluated: 0, errors: 0 };
    const gradesDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };

    for (const job of jobs) {
      try {
        // Evaluate with Gemini AI
        const evaluation = await evaluateJobWithGemini(job, userProfile, cvText);

        // Calculate grade
        const { grade, totalScore } = calculateGrade(evaluation.dimensionScores);

        // Generate evaluation report
        const report = generateEvaluationReport(job, evaluation, grade, totalScore);

        // Upload report to S3
        const reportUrl = await uploadReportToS3(report, job.id);

        // Generate tailoring package (CV snippet + cover opening)
        const tailoring = await generateTailoringPackage(job, cvText, evaluation.topSkills || []);
        let tailoringUrl = '';
        if (tailoring.cvSnippet || tailoring.coverOpening) {
          tailoringUrl = await uploadTailoringToS3(tailoring, job.id);
        }

        // Update job record in DynamoDB
        await updateJobWithEvaluation(job.id, {
          grade,
          totalScore,
          dimensionScores: evaluation.dimensionScores,
          reportUrl,
          tailoringUrl,
        });

        // Track grades distribution
        gradesDistribution[grade] = (gradesDistribution[grade] || 0) + 1;

        // Collect A-grade jobs for notification
        if (grade === 'A') {
          aGradeJobs.push({ ...job, grade, totalScore, strengths: evaluation.strengths, topSkills: evaluation.topSkills || [] });
        }

        results.evaluated++;

        // Rate limiting: wait between requests
        await delay(4000); // 15 RPM = 4 seconds between requests
      } catch (error) {
        console.error(`[Evaluate] Error for ${job.id}:`, error.message);
        results.errors++;
      }
    }

    // 5. Send A-grade notification email
    if (aGradeJobs.length > 0) {
      await sendAGradeNotification(aGradeJobs, notifyEmail);
    }

    // 6. Process due reminders
    try {
      const dueReminders = await queryDueReminders();
      if (dueReminders.length > 0) {
        await sendReminderEmails(dueReminders, notifyEmail);
        console.log(`[Job_Evaluator] Processed ${dueReminders.length} due reminders`);
      }
    } catch (error) {
      console.error('[Job_Evaluator] Reminder processing failed:', error.message);
    }

    console.log('[Job_Evaluator] Run completed', {
      ...results,
      gradesDistribution,
      aGradeJobs: aGradeJobs.length,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        evaluated: results.evaluated,
        errors: results.errors,
        gradesDistribution,
        aGradeJobs: aGradeJobs.length,
      }),
    };
  } catch (error) {
    console.error('[Job_Evaluator] Fatal error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
