# Design Document — JobPilot V3 Enhancements

## Overview

V3 builds on the existing V2 Lambda trio (Scanner, Evaluator, API) without replacing them. Changes are additive: new fields on Job_Records, new API endpoints, new Gemini calls in the Evaluator, retry wrappers around scrapers, and a restructured file system. The dashboard gains an Analytics tab and CV tailoring modals.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  EventBridge  cron(30 3 * * ? *)  09:00 IST                     │
└────────────────────┬────────────────────────────────────────────┘
                     │ invoke
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Lambda: jobpilot-scanner  (src/scanner/index.js)               │
│  • withRetry wrapper around each scraper (3 attempts, exp back-off) │
│  • Resilient selector lists per platform                        │
│  • Screenshot + description extraction unchanged                │
└────────────────────┬────────────────────────────────────────────┘
                     │ writes Job_Records (status=New)
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  DynamoDB: jobpilot-applications                                │
│  New fields: tailoringUrl, notes[], reminderDate                │
│  New GSI: reminderDate-index (for daily reminder queries)       │
└──────┬──────────────────────────────────────────────────────────┘
       │ reads New jobs + reads reminderDate=today
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Lambda: jobpilot-evaluator  (src/evaluator/index.js)           │
│  • Improved Gemini prompt with rubrics + few-shot examples      │
│  • JSON schema validation + one correction retry                │
│  • NEW: tailoring.js — CV snippet + cover opening generation    │
│  • NEW: reminders.js — query due reminders, send SES, clear     │
└────────────────────┬────────────────────────────────────────────┘
                     │ uploads to S3
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  S3: jobpilot-assets                                            │
│  /screenshots/{date}/{jobId}.png  (existing)                    │
│  /reports/{date}/{jobId}.md       (existing)                    │
│  /tailoring/{date}/{jobId}.md     (NEW)                         │
│  /public/dashboard.html           (renamed)                     │
└────────────────────┬────────────────────────────────────────────┘
                     │ served via API Gateway
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Lambda: jobpilot-api  (src/api/index.js)                       │
│  Existing: GET /jobs, GET /jobs/{id}, PUT /jobs/{id}/status     │
│  NEW: POST /jobs/{id}/notes                                     │
│  NEW: PUT  /jobs/{id}/reminder                                  │
│  NEW: GET  /analytics/grades                                    │
│  NEW: GET  /analytics/platforms                                 │
│  NEW: GET  /analytics/funnel                                    │
└────────────────────┬────────────────────────────────────────────┘
                     │ fetched by
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  dashboard.html  (public/dashboard.html)                        │
│  Jobs tab (existing) + Analytics tab (NEW)                      │
│  CV Tailoring modal (NEW)                                       │
│  Notes panel per job card (NEW)                                 │
│  Reminder date picker per job card (NEW)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Target File Structure

```
jobpilot/
├── src/
│   ├── scanner/
│   │   ├── index.js              ← Lambda handler entry point
│   │   ├── screenshot.js         ← captureScreenshot, uploadScreenshotToS3
│   │   ├── extractor.js          ← extractJobDescription
│   │   └── scrapers/
│   │       ├── linkedin.js
│   │       ├── naukri.js
│   │       ├── indeed.js
│   │       ├── shine.js
│   │       ├── internshala.js
│   │       ├── wellfound.js
│   │       ├── timesjobs.js
│   │       ├── unstop.js
│   │       ├── uplers.js
│   │       ├── turing.js
│   │       ├── remoteco.js
│   │       └── weworkremotely.js
│   ├── evaluator/
│   │   ├── index.js              ← Lambda handler entry point
│   │   ├── evaluator.js          ← evaluateJobWithGemini, prompt building
│   │   ├── grader.js             ← calculateGrade
│   │   ├── reporter.js           ← generateEvaluationReport, uploadReportToS3
│   │   ├── tailoring.js          ← generateTailoringPackage, uploadTailoringToS3
│   │   └── reminders.js          ← queryDueReminders, sendReminderEmails
│   ├── api/
│   │   ├── index.js              ← Lambda handler entry point + router
│   │   └── routes/
│   │       ├── jobs.js           ← /jobs, /jobs/{id}, /jobs/{id}/status, /jobs/{id}/notes, /jobs/{id}/reminder
│   │       └── analytics.js      ← /analytics/grades, /analytics/platforms, /analytics/funnel
│   └── shared/
│       ├── dynamo.js             ← DynamoDB client + helpers (saveJobRecord, updateJobStatus, etc.)
│       ├── s3.js                 ← S3 client + upload helpers
│       ├── ssm.js                ← getParam
│       ├── ses.js                ← sendEmail helper
│       └── retry.js              ← withRetry(fn, maxAttempts, baseDelayMs)
├── infra/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── terraform.tfvars          ← gitignored
├── tests/
│   ├── scanner/
│   │   ├── screenshot.test.js
│   │   ├── extractor.test.js
│   │   └── scrapers/
│   │       └── scraper-error-handling.test.js
│   ├── evaluator/
│   │   ├── evaluator.test.js     ← evaluateJobWithGemini tests
│   │   ├── grader.test.js        ← calculateGrade tests
│   │   ├── reporter.test.js      ← generateEvaluationReport tests
│   │   ├── tailoring.test.js     ← generateTailoringPackage tests
│   │   └── reminders.test.js     ← reminder query + send tests
│   ├── api/
│   │   ├── jobs.test.js
│   │   └── analytics.test.js
│   └── shared/
│       └── retry.test.js
├── public/
│   └── dashboard.html
├── docs/
│   ├── DEPLOYMENT_GUIDE.md
│   ├── TESTING_GUIDE.md
│   ├── ARCHITECTURE.md
│   └── QUICK_REFERENCE.md
├── package.json
├── vitest.config.js
├── .gitignore
└── README.md
```

---

## Components and Interfaces

### `src/shared/retry.js`

```js
/**
 * Retries an async function with exponential back-off.
 * @param {() => Promise<T>} fn - The async function to retry.
 * @param {number} maxAttempts - Maximum number of attempts (default 3).
 * @param {number} baseDelayMs - Base delay in ms; doubles each retry (default 2000).
 * @returns {Promise<T>}
 */
export async function withRetry(fn, maxAttempts = 3, baseDelayMs = 2000)
```

- Attempt 1: immediate
- Attempt 2: wait `baseDelayMs` (2s)
- Attempt 3: wait `baseDelayMs * 2` (4s)
- On final failure: rethrow the last error

### `src/evaluator/tailoring.js`

```js
/**
 * Generates a CV snippet + cover opening tailored to the job.
 * @param {JobRecord} job
 * @param {string} cvText
 * @param {string[]} topSkills - Top 5 relevant skills from evaluation
 * @returns {Promise<{ cvSnippet: string, coverOpening: string }>}
 */
export async function generateTailoringPackage(job, cvText, topSkills)

/**
 * Uploads the tailoring markdown to S3.
 * @param {{ cvSnippet: string, coverOpening: string }} tailoring
 * @param {string} jobId
 * @returns {Promise<string>} S3 URL
 */
export async function uploadTailoringToS3(tailoring, jobId)
```

### `src/evaluator/reminders.js`

```js
/**
 * Queries DynamoDB for jobs with reminderDate = today.
 * @returns {Promise<JobRecord[]>}
 */
export async function queryDueReminders()

/**
 * Sends SES reminder emails and clears reminderDate on success.
 * @param {JobRecord[]} jobs
 * @param {string} notifyEmail
 * @returns {Promise<void>}
 */
export async function sendReminderEmails(jobs, notifyEmail)
```

### `src/api/routes/analytics.js`

```js
/**
 * GET /analytics/grades
 * Returns grade counts grouped by date for the last 30 days.
 * @returns {{ date: string, A: number, B: number, C: number, D: number, F: number }[]}
 */

/**
 * GET /analytics/platforms
 * Returns per-platform aggregated metrics.
 * @returns {{ platform: string, total: number, avgScore: number, aGradeCount: number, conversionRate: number }[]}
 */

/**
 * GET /analytics/funnel
 * Returns funnel stage counts and conversion rates.
 * @returns {{ found: number, reviewed: number, applied: number, rejected: number, archived: number, newToAppliedDays: number }}
 */
```

---

## Data Model Changes

### Job_Record — New Fields

| Field          | DynamoDB Type | Description                                              |
|----------------|---------------|----------------------------------------------------------|
| `tailoringUrl` | S             | S3 URL of the Tailoring_Package markdown file            |
| `notes`        | L             | List of `{ text: S, createdAt: S }` maps                 |
| `reminderDate` | S             | ISO 8601 date string (YYYY-MM-DD) for follow-up reminder |

### New DynamoDB GSI

| GSI Name              | Hash Key       | Projection | Purpose                          |
|-----------------------|----------------|------------|----------------------------------|
| `reminderDate-index`  | `reminderDate` | ALL        | Query jobs due for reminder today |

---

## Improved Gemini Evaluation Prompt Structure

```
SYSTEM: You are a precise job-fit evaluator. Output ONLY valid JSON. No markdown, no explanation.

USER:
## Candidate Profile
{name}, {role}, {experience} years, Skills: {skills}
Minimum salary: {minSalary}. Preferred work: {workArrangement}.

## Job Details
Title: {title} | Company: {company} | Platform: {platform}
Location: {location} | Salary: {salary}
Description: {fullDescription}

## Scoring Rubric (0–5 scale per dimension)
- skillsMatch (weight 20%): 5=all required skills present, 4=80%+ match, 3=60%+, 2=40%+, 1=<40%, 0=no match
- experienceLevel (weight 15%): 5=exact years match, 4=±1yr, 3=±2yr, 2=under by 3yr, 1=over by 3yr, 0=no match
- salaryRange (weight 15%): 5=exceeds min by 20%+, 4=exceeds by 10%, 3=at minimum, 2=within 10% below, 1=10-20% below, 0=>20% below
- [... rubric for all 10 dimensions ...]

## Few-Shot Examples
Example 1 (high match): { "skillsMatch": 5, "experienceLevel": 4, ... }
Example 2 (low match):  { "skillsMatch": 2, "experienceLevel": 1, ... }

## Required JSON Output Schema
{
  "dimensions": { "skillsMatch": N, "experienceLevel": N, ... },
  "notes": { "skillsMatch": "...", ... },
  "strengths": ["...", "...", "..."],
  "redFlags": ["..."],
  "starStories": [{ "title": "...", "scenario": "..." }],
  "topSkills": ["skill1", "skill2", "skill3", "skill4", "skill5"]
}
```

---

## Analytics Data Computation

All three analytics endpoints compute results from a full DynamoDB Scan (acceptable at free-tier scale — max ~1000 records before TTL cleanup). Results are not cached; each API call recomputes. If the table grows beyond 1MB, pagination is handled via `LastEvaluatedKey`.

### Grade Trends (`/analytics/grades`)
- Scan all records, group by `foundAt` date (first 10 chars of ISO string)
- For each date, count records per grade
- Return last 30 days only, sorted ascending by date
- Fill missing dates with zero counts

### Platform Performance (`/analytics/platforms`)
- Scan all records, group by `platform`
- Per platform: count total, average `totalScore`, count grade=A, count status=Applied
- `conversionRate = applied / total * 100`

### Funnel (`/analytics/funnel`)
- Scan all records
- Count by status: New+Reviewed = found, Reviewed = reviewed, Applied = applied
- Compute `newToAppliedDays`: average of `(appliedAt - foundAt)` in days for Applied records

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Scraper fails after 3 retries | Log platform + attempt count + final error; return `[]` |
| Gemini tailoring call fails | Log error; store `tailoringUrl: ''`; continue evaluation |
| Gemini JSON schema validation fails | Retry once with correction prompt; on second failure use defaults |
| Reminder SES send fails | Log error; retain `reminderDate` for next day retry |
| Analytics scan fails | Return `500` with error message; do not crash |
| Note text empty | Return `400` from API; dashboard shows validation message |

---

## Testing Strategy

### New Unit Tests
- `tests/shared/retry.test.js` — withRetry: success on first attempt, success on retry, exhaustion, delay timing
- `tests/evaluator/tailoring.test.js` — generateTailoringPackage: output structure, word count range, fallback on Gemini failure
- `tests/evaluator/reminders.test.js` — queryDueReminders: correct date filter; sendReminderEmails: SES call, reminderDate cleared
- `tests/api/analytics.test.js` — all three endpoints: correct aggregation, empty data, pagination

### Property-Based Tests (fast-check)
- **P11**: `withRetry` never exceeds `maxAttempts` calls regardless of failure pattern
- **P12**: Grade trend grouping — for any array of Job_Records, every record's grade appears in exactly one date bucket
- **P13**: Platform metrics — `conversionRate` is always in [0, 100] for any input
- **P14**: Funnel conversion rates — `reviewed/found` and `applied/reviewed` are always in [0, 1]
