# Implementation Plan: JobPilot V3 Enhancements

## Overview

Four work streams executed in dependency order:
1. **File Restructure** (must be first — everything else imports from new paths)
2. **Scraper & Evaluator Hardening** (retry logic, selector resilience, prompt quality)
3. **New Features** (CV tailoring, notes, reminders, analytics)
4. **Dashboard & Infrastructure** (UI additions, new API endpoints, Terraform updates)

---

## Phase 1: Professional Monorepo Structure

### Task 1: Create directory skeleton
- [x] 1.1 Create all new directories
  - Create `src/scanner/scrapers/`, `src/evaluator/`, `src/api/routes/`, `src/shared/`
  - Create `infra/`, `public/`, `docs/`
  - Create `tests/scanner/scrapers/`, `tests/evaluator/`, `tests/api/`, `tests/shared/`
  - _Requirements: 12.1–12.7_

### Task 2: Extract shared utilities
- [x] 2.1 Create `src/shared/ssm.js`
  - Extract `getParam(name)` from `scanner-handler.js`
  - Export as named export
  - _Requirements: 12.2_

- [x] 2.2 Create `src/shared/dynamo.js`
  - Extract `saveJobRecord`, `updateJobStatus`, `checkAlreadyApplied` from existing handlers
  - Export all as named exports
  - _Requirements: 12.2_

- [x] 2.3 Create `src/shared/s3.js`
  - Extract `uploadScreenshotToS3`, `uploadReportToS3` upload helpers (generic `uploadToS3(buffer, key, contentType)`)
  - Export as named exports
  - _Requirements: 12.2_

- [x] 2.4 Create `src/shared/ses.js`
  - Extract SES `sendEmail(to, subject, body)` helper from `evaluator-handler.js`
  - Export as named export
  - _Requirements: 12.2_

- [x] 2.5 Create `src/shared/retry.js`
  - Implement `withRetry(fn, maxAttempts = 3, baseDelayMs = 2000)`
  - Exponential back-off: delay doubles each attempt (2s → 4s → 8s)
  - Log attempt number and platform/context label on each retry
  - Rethrow last error after all attempts exhausted
  - _Requirements: 9.5, 9.6, 12.2_

### Task 3: Migrate scanner
- [x] 3.1 Create `src/scanner/screenshot.js`
  - Move `captureScreenshot` and `uploadScreenshotToS3` from `scanner-handler.js`
  - Import `uploadToS3` from `src/shared/s3.js`
  - _Requirements: 12.3_

- [x] 3.2 Create `src/scanner/extractor.js`
  - Move `extractJobDescription` from `scanner-handler.js`
  - _Requirements: 12.3_

- [x] 3.3 Create one file per scraper in `src/scanner/scrapers/`
  - Files: `linkedin.js`, `naukri.js`, `indeed.js`, `shine.js`, `internshala.js`, `wellfound.js`, `timesjobs.js`, `unstop.js`, `uplers.js`, `turing.js`, `remoteco.js`, `weworkremotely.js`
  - Each file exports a single default function: `export default async function scrape(browser, credentials)`
  - Move selector constants to named exports at top of each file (e.g. `export const SELECTORS = { primary: '...', fallbacks: [...] }`)
  - _Requirements: 10.5, 12.3_

- [x] 3.4 Create `src/scanner/index.js`
  - Import all scrapers, shared utilities, screenshot, extractor
  - Wire the full scanner pipeline (same logic as `scanner-handler.js`)
  - Wrap each scraper call with `withRetry` from `src/shared/retry.js`
  - Export `handler` as named export
  - _Requirements: 12.3_

### Task 4: Migrate evaluator
- [x] 4.1 Create `src/evaluator/grader.js`
  - Move `calculateGrade(dimensionScores)` from `evaluator-handler.js`
  - _Requirements: 12.4_

- [x] 4.2 Create `src/evaluator/reporter.js`
  - Move `generateEvaluationReport` and `uploadReportToS3` from `evaluator-handler.js`
  - Import `uploadToS3` from `src/shared/s3.js`
  - _Requirements: 12.4_

- [x] 4.3 Create `src/evaluator/evaluator.js`
  - Move `evaluateJobWithGemini` from `evaluator-handler.js`
  - _Requirements: 12.4_

- [x] 4.4 Create `src/evaluator/index.js`
  - Import all evaluator modules and shared utilities
  - Wire the full evaluator pipeline
  - Export `handler` as named export
  - _Requirements: 12.4_

### Task 5: Migrate API handler
- [x] 5.1 Create `src/api/routes/jobs.js`
  - Move all `/jobs` route handlers from `api-handler.js`
  - Export route handler functions
  - _Requirements: 12.5_

- [x] 5.2 Create `src/api/index.js`
  - Import route handlers, implement URL-based router
  - Export `handler` as named export
  - _Requirements: 12.5_

### Task 6: Migrate infrastructure and static assets
- [x] 6.1 Move Terraform files to `infra/`
  - Move `main.tf` → `infra/main.tf`
  - Extract variables into `infra/variables.tf`
  - Extract outputs into `infra/outputs.tf`
  - Move `terraform.tfvars` → `infra/terraform.tfvars`
  - _Requirements: 12.6_

- [x] 6.2 Move dashboard to `public/`
  - Copy `dashboard-v2.html` → `public/dashboard.html`
  - _Requirements: 12.8_

- [x] 6.3 Consolidate documentation into `docs/`
  - Move `DEPLOYMENT_GUIDE.md`, `TESTING_GUIDE.md`, `QUICK_REFERENCE.md` → `docs/`
  - Consolidate all other `*.md` files (FINAL_SUMMARY, FIXES_APPLIED, etc.) into `docs/ARCHITECTURE.md`
  - Delete the originals from root
  - _Requirements: 12.10_

- [x] 6.4 Update `package.json` build scripts
  - Update all `Copy-Item` paths to reference `src/scanner/index.js`, `src/evaluator/index.js`, `src/api/index.js`
  - Update `deploy` script to reference `infra/` for terraform and `public/dashboard.html` for S3 upload
  - _Requirements: 12.11_

- [x] 6.5 Update `infra/main.tf` Lambda references
  - Update `handler` attribute: `scanner/index.handler`, `evaluator/index.handler`, `api/index.handler`
  - Update `filename` to reference new zip paths
  - _Requirements: 12.12_

- [x] 6.6 Delete legacy root-level files
  - Delete `handler.js`, `scanner-handler.js`, `evaluator-handler.js`, `api-handler.js`, `dashboard-api.js`
  - Delete `dashboard-v2.html`, `index.html`, `jobpilot-neobrutalist.html`
  - Delete `fix-timeouts.js`, `response.json`
  - _Requirements: 12.9_

- [x] 6.7 Update `vitest.config.js` test include paths
  - Update `include` glob to `tests/**/*.test.js`
  - _Requirements: 12.7_

### Task 7: Checkpoint — structure complete, tests pass
- [x] 7.1 Run `npm test` and confirm all existing tests pass with new import paths
  - Fix any broken imports in test files
  - Update test files to import from `src/` paths

---

## Phase 2: Scraper & Evaluator Hardening

### Task 8: Wrap scrapers with retry
- [x] 8.1 Apply `withRetry` to each scraper in `src/scanner/index.js`
  - Wrap each `scrape(browser, credentials)` call: `withRetry(() => scrape(browser, creds), 3, 2000)`
  - Log platform name + attempt number on each retry
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 8.2 Write `tests/shared/retry.test.js`
  - Test: success on first attempt returns result immediately
  - Test: success on second attempt after one failure
  - Test: exhaustion after 3 failures throws last error
  - Test: delay between attempts is approximately exponential (mock `setTimeout`)
  - _Requirements: 9.1–9.5_

### Task 9: Selector resilience
- [x] 9.1 Add `SELECTORS` constant to each scraper file
  - Define `primary` selector and `fallbacks` array for job card, title, company, location, salary, url, postedDate
  - _Requirements: 10.1, 10.5_

- [x] 9.2 Implement `extractWithFallback(page, selectors)` in `src/shared/selectors.js`
  - Try primary selector; if returns empty/null, try each fallback in order
  - Log warning with platform name and selector used when falling back
  - Return null if all selectors fail
  - _Requirements: 10.1, 10.2_

- [x] 9.3 Apply `extractWithFallback` in each scraper
  - Replace inline `page.$eval` / `page.$$eval` calls with `extractWithFallback`
  - _Requirements: 10.1_

- [x] 9.4 Add job validation in each scraper
  - After extraction, filter out jobs where `title` or `url` is empty/null
  - Log discarded jobs with platform name and missing fields
  - _Requirements: 10.3, 10.4_

### Task 10: Improved Gemini evaluation prompt
- [x] 10.1 Rewrite the evaluation prompt in `src/evaluator/evaluator.js`
  - Add explicit scoring rubric for all 10 dimensions (as specified in design doc)
  - Add 2 few-shot examples (one high-match, one low-match) with expected JSON
  - Instruct Gemini to output ONLY valid JSON, no markdown fences
  - Add `topSkills` field to the required JSON output schema
  - _Requirements: 11.1, 11.2, 11.3_

- [x] 10.2 Add JSON schema validation after Gemini response parsing
  - Validate all 10 dimension keys present in `dimensions` object
  - Validate all dimension values are numbers in range [0, 5]
  - Validate `strengths`, `redFlags`, `starStories`, `topSkills` arrays present
  - _Requirements: 11.4_

- [x] 10.3 Add correction retry on schema validation failure
  - If validation fails, send a second Gemini call with the invalid response + correction instruction
  - If second call also fails validation, fall back to defaults
  - _Requirements: 11.5_

- [x] 10.4 Pass full job description (not truncated) to evaluation prompt
  - Remove the 5000-char truncation from the prompt builder
  - Pass `topSkills` from evaluation result to tailoring prompt
  - _Requirements: 11.6_

---

## Phase 3: New Features

### Task 11: CV Auto-Tailoring — generation
- [x] 11.1 Create `src/evaluator/tailoring.js`
  - Implement `generateTailoringPackage(job, cvText, topSkills)`
  - Build tailoring prompt: include full CV, job description, top 5 skills, request CV_Snippet (150–200 words) + Cover_Opening (2–3 sentences)
  - Parse response into `{ cvSnippet, coverOpening }`
  - On failure: log error, return `{ cvSnippet: '', coverOpening: '' }`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.8_

- [x] 11.2 Implement `uploadTailoringToS3(tailoring, jobId)` in `src/evaluator/tailoring.js`
  - Format as markdown: `## CV Snippet\n{cvSnippet}\n\n## Cover Opening\n{coverOpening}`
  - Upload to S3 key `/tailoring/{YYYY-MM-DD}/{jobId}.md`
  - Return S3 URL; return `''` on failure
  - _Requirements: 1.5, 1.6_

- [x] 11.3 Wire tailoring into `src/evaluator/index.js`
  - After evaluation completes, call `generateTailoringPackage` with `job`, `cvText`, `evaluation.topSkills`
  - Call `uploadTailoringToS3` and store URL in `tailoringUrl` field
  - Update Job_Record with `tailoringUrl`
  - _Requirements: 1.7, 1.8_

- [x] 11.4 Write `tests/evaluator/tailoring.test.js`
  - Test: output has `cvSnippet` and `coverOpening` string fields
  - Test: fallback returns empty strings on Gemini failure
  - Test: S3 upload called with correct key format
  - _Requirements: 1.1–1.8_

### Task 12: Application Tracking — Notes API
- [x] 12.1 Add `POST /jobs/{jobId}/notes` to `src/api/routes/jobs.js`
  - Parse `{ text }` from request body
  - Validate text is non-empty; return `400` if empty
  - Append `{ text, createdAt: new Date().toISOString() }` to `notes` list in DynamoDB using `UpdateExpression: 'SET notes = list_append(if_not_exists(notes, :empty), :note)'`
  - Return updated notes list
  - _Requirements: 3.7, 3.8, 3.9_

- [x] 12.2 Write `tests/api/jobs.test.js` — notes endpoint
  - Test: valid note appended and returned
  - Test: empty text returns 400
  - Test: DynamoDB update called with correct expression
  - _Requirements: 3.7–3.9_

### Task 13: Application Tracking — Reminders API
- [x] 13.1 Add `PUT /jobs/{jobId}/reminder` to `src/api/routes/jobs.js`
  - Parse `{ reminderDate }` from request body (YYYY-MM-DD format)
  - Update `reminderDate` attribute on Job_Record
  - Return updated job
  - _Requirements: 4.5_

- [x] 13.2 Create `src/evaluator/reminders.js`
  - Implement `queryDueReminders()`: scan DynamoDB for records where `reminderDate = today` (using FilterExpression)
  - Implement `sendReminderEmails(jobs, notifyEmail)`: for each job, send SES email with title, company, platform, status, dashboard link; then clear `reminderDate` on success
  - On SES failure: log error, do NOT clear `reminderDate`
  - _Requirements: 4.6, 4.7, 4.8, 4.9_

- [x] 13.3 Wire reminders into `src/evaluator/index.js`
  - At the end of the evaluator run (after all jobs processed), call `queryDueReminders()` then `sendReminderEmails()`
  - _Requirements: 4.6_

- [x] 13.4 Write `tests/evaluator/reminders.test.js`
  - Test: `queryDueReminders` filters by today's date
  - Test: `sendReminderEmails` sends one email per job
  - Test: `reminderDate` cleared after successful send
  - Test: `reminderDate` retained after SES failure
  - _Requirements: 4.6–4.9_

### Task 14: Analytics API endpoints
- [x] 14.1 Create `src/api/routes/analytics.js`
  - Implement `GET /analytics/grades`: scan all records, group by `foundAt` date, count per grade, return last 30 days sorted ascending, fill missing dates with zeros
  - Implement `GET /analytics/platforms`: scan all records, group by `platform`, compute total/avgScore/aGradeCount/conversionRate
  - Implement `GET /analytics/funnel`: scan all records, count by status, compute `newToAppliedDays` average
  - Handle DynamoDB pagination via `LastEvaluatedKey`
  - _Requirements: 5.3, 5.5, 6.4, 7.5_

- [x] 14.2 Wire analytics routes into `src/api/index.js`
  - Add routing for `/analytics/grades`, `/analytics/platforms`, `/analytics/funnel`
  - _Requirements: 5.5, 6.4, 7.5_

- [x] 14.3 Write `tests/api/analytics.test.js`
  - Test: grades endpoint groups correctly by date
  - Test: platforms endpoint computes conversionRate correctly
  - Test: funnel endpoint counts statuses correctly
  - Test: empty table returns zeros not errors
  - _Requirements: 5.3–5.5, 6.1–6.4, 7.1–7.5_

---

## Phase 4: Dashboard & Infrastructure

### Task 15: Dashboard — CV Tailoring modal
- [x] 15.1 Add "View Tailoring" button to job cards in `public/dashboard.html`
  - Show button only when `job.tailoringUrl` is non-empty
  - Style with purple/violet color (distinct from other buttons)
  - _Requirements: 2.1, 2.6_

- [x] 15.2 Implement tailoring modal
  - Fetch markdown from `job.tailoringUrl` on button click
  - Render with `marked` library
  - Add "Copy CV Snippet" button — copies text between `## CV Snippet` and `## Cover Opening` headers
  - Add "Copy Cover Opening" button — copies text after `## Cover Opening` header
  - Show "Copied!" toast for 2 seconds on copy
  - _Requirements: 2.2, 2.3, 2.4, 2.5_

### Task 16: Dashboard — Notes panel
- [x] 16.1 Add collapsible Notes section to each job card
  - Show note count badge on collapsed state
  - Expand to show notes list (text + relative timestamp)
  - _Requirements: 3.1, 3.2_

- [x] 16.2 Implement add-note form
  - Text input + "Add Note" button inside expanded Notes section
  - On submit: call `POST /jobs/{jobId}/notes`, update UI with new note, clear input
  - Show validation message if input is empty
  - _Requirements: 3.3, 3.4, 3.9_

### Task 17: Dashboard — Reminder picker
- [x] 17.1 Add "Set Reminder" button to each job card
  - Show active reminder date badge if `job.reminderDate` is set
  - _Requirements: 4.1, 4.10_

- [x] 17.2 Implement reminder date picker
  - On button click, show `<input type="date">` with min=today
  - On confirm: call `PUT /jobs/{jobId}/reminder`, update UI badge
  - _Requirements: 4.2, 4.3_

### Task 18: Dashboard — Analytics tab
- [x] 18.1 Add top navigation tabs to `public/dashboard.html`
  - "Jobs" tab (existing content) and "Analytics" tab
  - Tab switching without page reload
  - Persist active tab in localStorage
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 18.2 Implement grade trends chart
  - Fetch `GET /analytics/grades` on Analytics tab open
  - Render line chart using Chart.js CDN (one line per grade A–F, x-axis = date, y-axis = count)
  - _Requirements: 5.1, 5.2_

- [x] 18.3 Implement platform performance table
  - Fetch `GET /analytics/platforms`
  - Render table: Platform | Total | Avg Score | A-Grade | Conversion Rate
  - Highlight top-performing platform row
  - _Requirements: 6.1, 6.2_

- [x] 18.4 Implement application funnel visualization
  - Fetch `GET /analytics/funnel`
  - Render funnel: Found → Reviewed → Applied with conversion % between stages
  - Show Rejected and Archived counts separately
  - Show avg days New→Applied
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

### Task 19: Terraform — new resources
- [x] 19.1 Add `reminderDate-index` GSI to DynamoDB table in `infra/main.tf`
  - `hash_key = "reminderDate"`, `projection_type = "ALL"`
  - Add `reminderDate` attribute declaration
  - _Requirements: 4.6_

- [x] 19.2 Add new API Gateway routes in `infra/main.tf`
  - Add resources and methods for: `POST /jobs/{jobId}/notes`, `PUT /jobs/{jobId}/reminder`, `GET /analytics/grades`, `GET /analytics/platforms`, `GET /analytics/funnel`
  - Add CORS OPTIONS methods for each new route
  - _Requirements: 3.7, 4.5, 5.5, 6.4, 7.5_

- [x] 19.3 Add S3 lifecycle rule for `/tailoring/` prefix in `infra/main.tf`
  - Delete objects with prefix `tailoring/` older than 90 days
  - _Requirements: 1.6_

- [x] 19.4 Update Evaluator IAM policy in `infra/main.tf`
  - Add `dynamodb:Scan` permission (needed for reminder queries)
  - _Requirements: 4.6_

### Task 20: Property-based tests
- [x] 20.1 Add P11 — `withRetry` never exceeds maxAttempts
  - `fc.integer({ min: 1, max: 5 })` for maxAttempts; mock fn always throws; assert call count = maxAttempts
  - `// Feature: jobpilot-v3-enhancements, Property 11: withRetry never exceeds maxAttempts calls`
  - _Requirements: 9.1_

- [x] 20.2 Add P12 — Grade trend grouping completeness
  - Generate `fc.array(jobRecordArb)` with random `foundAt` dates; run grouping logic; assert every record appears in exactly one date bucket
  - `// Feature: jobpilot-v3-enhancements, Property 12: Grade trend grouping places every record in exactly one date bucket`
  - _Requirements: 5.3_

- [x] 20.3 Add P13 — Platform conversion rate bounds
  - Generate `fc.array(jobRecordArb)` grouped by platform; compute conversionRate; assert always in [0, 100]
  - `// Feature: jobpilot-v3-enhancements, Property 13: Platform conversion rate is always in [0, 100]`
  - _Requirements: 6.1_

- [x] 20.4 Add P14 — Funnel conversion rates in [0, 1]
  - Generate random status counts; compute funnel ratios; assert reviewed/found and applied/reviewed always in [0, 1]
  - `// Feature: jobpilot-v3-enhancements, Property 14: Funnel conversion rates are always in [0, 1]`
  - _Requirements: 7.2_

### Task 21: Final checkpoint
- [x] 21.1 Run `npm test` — all tests pass
- [x] 21.2 Verify `infra/main.tf` is valid (`terraform validate`)
- [x] 21.3 Confirm `public/dashboard.html` loads correctly with mock API data
- [x] 21.4 Update `README.md` with new structure overview and V3 feature summary

---

## Notes

- Phase 1 (restructure) must complete before any other phase — all imports change
- The `withRetry` utility is the foundation for both Phase 2 and Phase 3 reminder logic
- Analytics endpoints use full table scans — acceptable at free-tier scale (<1000 records with 90-day TTL)
- Chart.js is loaded via CDN in `dashboard.html` — no new npm dependency needed
- `terraform.tfvars` must be moved to `infra/` and `.gitignore` updated accordingly
- All existing tests must be updated to import from `src/` paths in Task 7.1
