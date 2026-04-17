# Implementation Plan: JobPilot V2 Recommendation System

## Overview

Implement JobPilot V2 as a "Find & Recommend" system that scrapes 12 job platforms, captures screenshots, evaluates jobs using AI across 10 dimensions, assigns A-F grades, generates detailed evaluation reports, and presents everything in a web dashboard. The implementation is organized into four phases: Backend Core, Platform Scrapers, Dashboard UI, and Polish & Optimization.

---

## Phase 1: Backend Core (Foundation)

### Task 1: Project Setup and Dependencies
- [x] 1.1 Update `package.json` with new dependencies
  - Add `@aws-sdk/client-s3` for S3 operations
  - Add `marked` for markdown rendering in dashboard
  - Update `@google/genai` to latest version
  - Ensure `@sparticuz/chromium`, `puppeteer-core`, `@aws-sdk/client-dynamodb`, `@aws-sdk/client-ssm`, `@aws-sdk/client-ses` are present
  - _Requirements: 17.1, 17.3_

- [x] 1.2 Create new Lambda handler structure
  - Create `scanner-handler.js` for Job_Scanner Lambda
  - Create `evaluator-handler.js` for Job_Evaluator Lambda
  - Create `api-handler.js` for API Gateway Lambda
  - _Requirements: 17.1_

---

### Task 2: Screenshot Capture System
- [x] 2.1 Implement `captureScreenshot(page, jobId)` in `scanner-handler.js`
  - Set viewport to 1280x800 pixels
  - Capture full-page screenshot as PNG buffer
  - Return screenshot buffer
  - _Requirements: 2.1, 2.5_

- [x] 2.2 Implement `uploadScreenshotToS3(buffer, jobId)` in `scanner-handler.js`
  - Generate S3 key: `/screenshots/{YYYY-MM-DD}/{jobId}.png`
  - Upload buffer to S3 with `public-read` ACL
  - Return S3 URL
  - Handle upload failures gracefully (log and return empty string)
  - _Requirements: 2.2, 2.3, 2.4, 22.1, 22.2_

---

### Task 3: Job Description Extraction
- [x] 3.1 Implement `extractJobDescription(page)` in `scanner-handler.js`
  - Extract full text content from job description section
  - Try multiple common selectors: `.description`, `[data-job-description]`, `.job-details`, etc.
  - Return extracted text (max 5000 characters)
  - Return empty string on failure without throwing
  - _Requirements: 24.1, 24.2, 24.4_

---

### Task 4: DynamoDB Schema Update
- [x] 4.1 Update `saveJobRecord(job)` function for new schema
  - Add fields: `postedDate`, `grade`, `totalScore`, `dimensionScores` (map), `screenshotUrl`, `reportUrl`, `description`, `status`
  - Set `status` to "New" for new records
  - Keep existing fields: `jobId`, `title`, `company`, `platform`, `location`, `salary`, `url`, `foundAt`, `expiresAt`
  - Use conditional write: `attribute_not_exists(jobId)`
  - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [x] 4.2 Implement `updateJobStatus(jobId, status)` function
  - Update DynamoDB item with new status
  - Add `updatedAt` timestamp
  - Return success/failure boolean
  - _Requirements: 27.1, 27.3, 27.4, 27.5_

---

### Task 5: 10-Dimension Evaluation System
- [x] 5.1 Implement `evaluateJobWithGemini(job, userProfile, cvText)` in `evaluator-handler.js`
  - Build structured prompt with User_Profile, job details, and full job description
  - Request JSON response with 10 dimension scores (0-5 scale), notes, strengths, red flags, and STAR stories
  - Use temperature 0.3 for consistency
  - Parse response and validate all fields present
  - _Requirements: 3.1-3.11, 21.1, 21.2, 21.3, 21.4_

- [x] 5.2 Implement `calculateGrade(dimensionScores)` in `evaluator-handler.js`
  - Define weights: Skills Match (20%), Experience (15%), Salary (15%), Location (10%), Culture (10%), Growth (10%), Tech Stack (10%), Role Clarity (5%), Team Size (3%), Work-Life (2%)
  - Calculate weighted total: Σ(score × weight)
  - Assign grade: A (4.5-5.0), B (4.0-4.49), C (3.5-3.99), D (3.0-3.49), F (<3.0)
  - Return grade and totalScore
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 5.3 Implement fallback for Gemini API failures
  - On API error or unparseable JSON, assign default scores: all dimensions = 3.0
  - Calculate grade as C (3.0 total)
  - Add note: "Evaluation failed - default grade assigned"
  - Log raw response for debugging
  - _Requirements: 19.3, 21.6_

---

### Task 6: Evaluation Report Generation
- [x] 6.1 Implement `generateEvaluationReport(job, evaluation)` in `evaluator-handler.js`
  - Create markdown template with all required sections
  - Job Details: title, company, platform, location, salary, posted date
  - Overall Grade: letter grade, score, recommendation (Strong Apply/Consider/Skip)
  - Dimension Scores: table with score, weight, weighted value, notes
  - Strengths: 3-5 bullet points
  - Red Flags: concerns or "None identified"
  - Key Requirements Match: checklist with ✅/⚠️ indicators
  - Application Strategy: highlight, emphasize, address sections
  - Interview Prep: 3-4 STAR story suggestions
  - Next Steps: actionable checklist
  - _Requirements: 5.1-5.10, 28.1-28.4, 29.1-29.5_

- [x] 6.2 Implement `uploadReportToS3(markdown, jobId)` in `evaluator-handler.js`
  - Generate S3 key: `/reports/{YYYY-MM-DD}/{jobId}.md`
  - Upload markdown to S3 with `public-read` ACL
  - Return S3 URL
  - Handle upload failures gracefully
  - _Requirements: 5.11, 23.1, 23.2_

---

### Task 7: Email Notifications for A-Grade Jobs
- [x] 7.1 Implement `sendAGradeNotification(jobs, notifyEmail)` in `evaluator-handler.js`
  - Filter jobs with grade "A"
  - Build email body with job title, company, platform, score, top 3 strengths, dashboard link
  - Send single batched email via SES
  - Handle SES failures gracefully (log and continue)
  - _Requirements: 14.1, 14.2, 14.3, 14.4_

---

### Task 8: Job Scanner Main Handler
- [x] 8.1 Wire Job_Scanner pipeline in `scanner-handler.js`
  - Fetch SSM parameters: credentials, user profile, CV text
  - Launch Chromium with stealth settings
  - Run all 12 platform scrapers in parallel via `Promise.allSettled`
  - For each job: extract description, capture screenshot, upload to S3
  - Deduplicate jobs by `company::title` key
  - Save Job_Records to DynamoDB with status "New"
  - Close browser in `finally` block
  - Log summary: platforms scraped, jobs found, duplicates removed, errors
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 15.1, 15.2, 15.3, 25.6_

- [x] 8.2 Implement rate limiting and error handling
  - Continue on individual scraper failures
  - Log platform name, error message, stack trace
  - Return partial results if some platforms fail
  - _Requirements: 19.1, 19.2, 19.5_

---

### Task 9: Job Evaluator Main Handler
- [x] 9.1 Wire Job_Evaluator pipeline in `evaluator-handler.js`
  - Fetch SSM parameters: Gemini API key, user profile, CV text, notify email
  - Query DynamoDB for jobs with status "New"
  - Process jobs sequentially (respect 15 RPM Gemini limit)
  - For each job: evaluate with Gemini, calculate grade, generate report, upload to S3
  - Update Job_Record with grade, scores, report URL
  - Collect A-grade jobs for notification
  - Send batched A-grade email
  - Log summary: jobs evaluated, grades distribution, errors
  - _Requirements: 3.1-3.11, 4.1-4.7, 5.1-5.11, 21.5_

---

### Task 10: Checkpoint - Backend Core Complete
- [x] 10.1 Test Job_Scanner locally
  - Mock SSM, S3, DynamoDB
  - Verify screenshot capture works
  - Verify job description extraction works
  - Verify deduplication works
  - Verify error handling works

- [x] 10.2 Test Job_Evaluator locally
  - Mock Gemini API responses
  - Verify 10-dimension scoring works
  - Verify grade calculation works
  - Verify report generation works
  - Verify A-grade notifications work

---

## Phase 2: Platform Scrapers (12 Platforms)

### Task 11: Update Existing Scrapers (LinkedIn, Naukri, Indeed)
- [x] 11.1 Update `scrapeLinkedIn(browser)` in `scanner-handler.js`
  - Remove auto-apply logic
  - Add `postedDate` extraction
  - Return jobs array with all required fields
  - _Requirements: 12.1_

- [x] 11.2 Update `scrapeNaukri(browser)` in `scanner-handler.js`
  - Remove auto-apply logic
  - Add `postedDate` extraction
  - Fix selectors based on previous debugging
  - _Requirements: 12.2_

- [x] 11.3 Update `scrapeIndeed(browser)` in `scanner-handler.js`
  - Remove auto-apply logic
  - Add `postedDate` extraction
  - Fix Cloudflare detection issues
  - _Requirements: 12.3_

---

### Task 12: Fix Existing Scrapers (Shine, Internshala, Wellfound, TimesJobs, Unstop)
- [x] 12.1 Fix `scrapeShine(browser)` in `scanner-handler.js`
  - Update selectors to handle CSS modules (`.jobCardNova_bigCard__W2xn3`)
  - Use attribute selectors or partial class matching
  - Add `postedDate` extraction
  - _Requirements: 12.4_

- [x] 12.2 Fix `scrapeInternshala(browser)` in `scanner-handler.js`
  - Fix selectors to target actual job cards, not nav items
  - Add `postedDate` extraction
  - _Requirements: 12.5_

- [x] 12.3 Fix `scrapeWellfound(browser)` in `scanner-handler.js`
  - Handle bot detection (empty body issue)
  - Add stealth techniques
  - Add `postedDate` extraction
  - _Requirements: 12.6_

- [x] 12.4 Fix `scrapeTimesJobs(browser)` in `scanner-handler.js`
  - Fix URL to show search results instead of homepage
  - Add `postedDate` extraction
  - _Requirements: 12.7_

- [x] 12.5 Fix `scrapeUnstop(browser)` in `scanner-handler.js`
  - Fix selectors to find job cards
  - Add `postedDate` extraction
  - _Requirements: 12.8_

---

### Task 13: New Platform Scrapers (Uplers, Turing, Remote.co, We Work Remotely)
- [x] 13.1 Implement `scrapeUplers(browser)` in `scanner-handler.js`
  - Navigate to Uplers remote jobs search
  - Extract jobs matching MERN/Node.js/TypeScript
  - Return jobs array with all required fields
  - _Requirements: 12.9_

- [x] 13.2 Implement `scrapeTuring(browser)` in `scanner-handler.js`
  - Navigate to Turing jobs search
  - Extract remote jobs matching profile
  - Return jobs array with all required fields
  - _Requirements: 12.10_

- [x] 13.3 Implement `scrapeRemoteCo(browser)` in `scanner-handler.js`
  - Navigate to Remote.co jobs search
  - Extract remote jobs matching profile
  - Return jobs array with all required fields
  - _Requirements: 12.11_

- [x] 13.4 Implement `scrapeWeWorkRemotely(browser)` in `scanner-handler.js`
  - Navigate to We Work Remotely jobs search
  - Extract remote jobs matching profile
  - Return jobs array with all required fields
  - _Requirements: 12.12_

---

### Task 14: Checkpoint - All Scrapers Complete
- [x] 14.1 Test each scraper individually
  - Verify job extraction works
  - Verify selectors are correct
  - Verify error handling works
  - Log sample output for each platform

- [x] 14.2 Test all scrapers together
  - Run full Job_Scanner pipeline
  - Verify parallel execution works
  - Verify deduplication works across platforms
  - Check for memory leaks

---

## Phase 3: Dashboard UI

### Task 15: API Gateway Setup
- [x] 15.1 Implement `api-handler.js` Lambda functions
  - `GET /jobs` - Return all jobs from DynamoDB
  - `GET /jobs/{jobId}` - Return single job
  - `PUT /jobs/{jobId}/status` - Update job status
  - Add CORS headers for S3 origin
  - _Requirements: 20.1, 20.2, 20.3, 20.4_

- [x] 15.2 Add pagination to `/jobs` endpoint
  - Support `limit` and `lastEvaluatedKey` query parameters
  - Return paginated results
  - _Requirements: 20.1_

- [x] 15.3 Add filtering to `/jobs` endpoint
  - Support `grade` query parameter (A/B/C/D/F)
  - Support `status` query parameter (New/Reviewed/Applied/Rejected/Archived)
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

---

### Task 16: Dashboard HTML Structure
- [x] 16.1 Create `dashboard-v2.html` with Tailwind CDN
  - Add header with logo and stats
  - Add filter buttons section (grade and status)
  - Add sort dropdown
  - Add search input
  - Add job cards container
  - Add loading state skeleton
  - Add empty state message
  - _Requirements: 7.1, 7.3, 7.4, 7.5, 18.1_

- [x] 16.2 Implement responsive layout
  - Mobile: single column, stacked cards
  - Tablet: 2 columns
  - Desktop: 3 columns
  - Touch-friendly buttons (44x44px minimum)
  - _Requirements: 18.1, 18.2, 18.3_

---

### Task 17: Dashboard Statistics Display
- [x] 17.1 Implement stats cards in dashboard
  - Total Jobs Found
  - A-Grade Jobs
  - B-Grade Jobs
  - Jobs Applied
  - Jobs Pending Review (status "New")
  - Last Scan / Next Scan timestamps
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

---

### Task 18: Dashboard Job Cards
- [x] 18.1 Implement job card component
  - Grade badge (color-coded: A=green, B=blue, C=yellow, D=orange, F=red)
  - Job title and company
  - Platform badge
  - Salary and location
  - Posted date (relative: "2 hours ago")
  - Screenshot thumbnail (lazy loaded)
  - Top 3 strengths (green chips)
  - Red flags (yellow/red chips)
  - Action buttons: Apply, View Report, Mark Applied, Reject, Archive
  - _Requirements: 7.1, 22.3_

- [x] 18.2 Implement screenshot modal
  - Click thumbnail to open full-size screenshot
  - Modal with close button
  - Keyboard navigation (ESC to close)
  - _Requirements: 22.4_

---

### Task 19: Dashboard Filtering System
- [x] 19.1 Implement grade filter buttons
  - Buttons: A, B, C, D, F, All
  - Show count badge on each button
  - Highlight active filter
  - Filter jobs client-side
  - _Requirements: 8.1, 8.2, 8.5_

- [x] 19.2 Implement status filter buttons
  - Buttons: New, Reviewed, Applied, Rejected, Archived, All
  - Show count badge on each button
  - Highlight active filter
  - Filter jobs client-side
  - _Requirements: 8.3, 8.4, 8.5_

- [x] 19.3 Implement combined filtering
  - Allow grade + status filters simultaneously
  - Update counts dynamically
  - _Requirements: 8.6_

---

### Task 20: Dashboard Sorting System
- [x] 20.1 Implement sort dropdown
  - Options: Score (High to Low), Score (Low to High), Date (Newest), Date (Oldest), Platform (A-Z)
  - Sort jobs client-side
  - Persist selection in localStorage
  - _Requirements: 9.1, 9.2, 9.3_

---

### Task 21: Dashboard Search Functionality
- [x] 21.1 Implement search input
  - Real-time filtering as user types
  - Search across: title, company, platform
  - Show count of matching jobs
  - Clear button to reset search
  - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5_

---

### Task 22: Dashboard Job Actions
- [x] 22.1 Implement "Apply on Platform" button
  - Open job URL in new tab
  - Track click event
  - _Requirements: 10.1_

- [x] 22.2 Implement "View Full Report" button
  - Fetch markdown report from S3
  - Render markdown in modal with proper formatting
  - Use `marked` library for rendering
  - _Requirements: 10.2, 23.3_

- [x] 22.3 Implement "Mark Applied" button
  - Call API to update status to "Applied"
  - Update UI immediately (optimistic update)
  - Show success toast
  - _Requirements: 10.3, 27.3_

- [x] 22.4 Implement "Reject" button
  - Call API to update status to "Rejected"
  - Remove from default view
  - Show undo option (5 seconds)
  - _Requirements: 10.4, 27.4_

- [x] 22.5 Implement "Archive" button
  - Call API to update status to "Archived"
  - Remove from default view
  - Show undo option (5 seconds)
  - _Requirements: 10.5, 27.5_

- [x] 22.6 Implement auto-status update on report view
  - When user views full report, update status from "New" to "Reviewed"
  - Update silently in background
  - _Requirements: 27.2_

---

### Task 23: Dashboard Loading States
- [x] 23.1 Implement loading spinner for initial data fetch
  - Show skeleton UI while loading
  - Smooth transition to content
  - _Requirements: 26.1_

- [x] 23.2 Implement loading states for actions
  - Disable button and show spinner during API call
  - Re-enable on success/failure
  - _Requirements: 26.2_

- [x] 23.3 Implement error states
  - Show error message on API failure
  - Provide retry button
  - Log errors to console
  - _Requirements: 26.3_

---

### Task 24: Dashboard Data Fetching
- [x] 24.1 Implement `fetchJobs()` function
  - Call API Gateway `/jobs` endpoint
  - Handle pagination (load more button)
  - Cache results in memory
  - Refresh every 5 minutes
  - _Requirements: 7.2_

- [x] 24.2 Implement `updateJobStatus(jobId, status)` function
  - Call API Gateway `/jobs/{jobId}/status` endpoint
  - Handle success/failure
  - Update local cache
  - _Requirements: 10.3, 10.4, 10.5_

---

### Task 25: Checkpoint - Dashboard Complete
- [x] 25.1 Test dashboard locally
  - Mock API responses
  - Test all filters and sorting
  - Test all actions
  - Test responsive layout on different screen sizes
  - Test keyboard navigation

- [x] 25.2 Test dashboard with real data
  - Deploy to S3
  - Connect to API Gateway
  - Test with real job data
  - Verify screenshots load correctly
  - Verify reports render correctly

---

## Phase 4: Infrastructure & Polish

### Task 26: Terraform Infrastructure Updates
- [x] 26.1 Update `main.tf` for two Lambda functions
  - Define `jobpilot-scanner` Lambda (Node.js 20, 2048 MB, 900s timeout)
  - Define `jobpilot-evaluator` Lambda (Node.js 20, 1024 MB, 600s timeout)
  - Define `jobpilot-api` Lambda (Node.js 20, 512 MB, 30s timeout)
  - _Requirements: 17.1_

- [x] 26.2 Update DynamoDB table schema
  - Keep existing table name: `jobpilot-applications`
  - Ensure TTL enabled on `expiresAt`
  - Add GSI for querying by status: `status-foundAt-index`
  - _Requirements: 17.2_

- [x] 26.3 Update S3 bucket configuration
  - Enable static website hosting
  - Add folders: `/screenshots`, `/reports`
  - Set lifecycle policies: delete objects older than 90 days
  - Enable public read access for dashboard
  - _Requirements: 17.3, 22.5, 23.4_

- [x] 26.4 Create API Gateway
  - Define REST API with 3 endpoints
  - Connect to `jobpilot-api` Lambda
  - Enable CORS for S3 origin
  - Add rate limiting: 100 requests per minute
  - _Requirements: 17.4, 20.4, 20.5_

- [x] 26.5 Update EventBridge Scheduler
  - Keep existing cron: `cron(30 3 * * ? *)`
  - Update target to `jobpilot-scanner` Lambda
  - Add second rule to trigger `jobpilot-evaluator` 5 minutes after scanner
  - _Requirements: 16.1, 17.5_

- [x] 26.6 Update IAM roles and policies
  - Scanner: DynamoDB write, S3 write, SSM read, CloudWatch logs
  - Evaluator: DynamoDB read/write, S3 write, SES send, SSM read, CloudWatch logs
  - API: DynamoDB read/write, CloudWatch logs
  - _Requirements: 17.6_

- [x] 26.7 Add new SSM parameters
  - `/jobpilot/profile/name`
  - `/jobpilot/profile/role`
  - `/jobpilot/profile/experience`
  - `/jobpilot/profile/skills`
  - `/jobpilot/profile/location`
  - `/jobpilot/profile/work-arrangement`
  - `/jobpilot/profile/min-salary`
  - `/jobpilot/profile/target-roles`
  - _Requirements: 13.1, 17.7_

---

### Task 27: Build and Deployment Scripts
- [x] 27.1 Update `package.json` build script
  - Build three separate Lambda packages: `scanner.zip`, `evaluator.zip`, `api.zip`
  - Include only necessary dependencies for each
  - _Requirements: 17.1_

- [x] 27.2 Create deployment script
  - Run `npm run build`
  - Run `terraform apply`
  - Upload `dashboard-v2.html` to S3
  - Output dashboard URL and API Gateway URL
  - _Requirements: 17.1, 17.3_

---

### Task 28: Testing and Validation
- [x] 28.1 End-to-end test
  - Manually invoke Scanner Lambda
  - Verify jobs scraped from all platforms
  - Verify screenshots uploaded to S3
  - Verify jobs saved to DynamoDB with status "New"

- [x] 28.2 Test Evaluator Lambda
  - Manually invoke Evaluator Lambda
  - Verify jobs evaluated with Gemini
  - Verify grades assigned correctly
  - Verify reports generated and uploaded to S3
  - Verify A-grade email sent

- [x] 28.3 Test Dashboard
  - Open dashboard in browser
  - Verify jobs display correctly
  - Verify filters and sorting work
  - Verify actions work (mark applied, reject, archive)
  - Verify reports render correctly
  - Test on mobile device

---

### Task 29: Documentation
- [x] 29.1 Update README.md
  - Add V2 architecture overview
  - Add deployment instructions
  - Add usage guide
  - Add troubleshooting section

- [x] 29.2 Create user guide
  - How to use the dashboard
  - How to interpret grades and reports
  - How to customize user profile
  - How to add new platforms

---

### Task 30: Final Checkpoint - Production Ready
- [x] 30.1 Deploy to production
  - Run full deployment
  - Verify EventBridge triggers work
  - Monitor first scheduled run
  - Check CloudWatch logs for errors

- [x] 30.2 Monitor and optimize
  - Check Lambda execution times
  - Check DynamoDB read/write units
  - Check S3 storage usage
  - Optimize if needed

---

## Notes

- **Phase 1** (Backend Core) must be completed before Phase 2 (Scrapers)
- **Phase 2** (Scrapers) can be done incrementally - test each scraper individually
- **Phase 3** (Dashboard) can start after Phase 1 is complete (use mock data)
- **Phase 4** (Infrastructure) should be done last, after all code is tested
- Each checkpoint task should be completed before moving to the next phase
- All error handling should be comprehensive - never abort the entire run for a single failure
- All API calls should respect rate limits (Gemini: 15 RPM, API Gateway: 100 RPM)
- All S3 uploads should use `public-read` ACL for dashboard access
- All DynamoDB writes should use conditional expressions to prevent duplicates
- All Lambda functions should log start time, end time, and summary statistics

## Estimated Timeline

- **Phase 1 (Backend Core):** 8-10 hours
- **Phase 2 (Platform Scrapers):** 6-8 hours
- **Phase 3 (Dashboard UI):** 8-10 hours
- **Phase 4 (Infrastructure & Polish):** 4-6 hours

**Total:** 26-34 hours

## Success Criteria

- [ ] All 12 platforms scraping successfully
- [ ] Screenshots captured for every job
- [ ] Jobs evaluated with 10-dimension scoring
- [ ] A-F grades assigned correctly
- [ ] Evaluation reports generated with STAR stories
- [ ] Dashboard displays jobs with filters and sorting
- [ ] All actions work (apply, reject, archive, mark applied)
- [ ] A-grade email notifications sent
- [ ] System runs automatically daily at 09:00 IST
- [ ] No errors in CloudWatch logs
- [ ] Dashboard loads in <3 seconds
- [ ] Mobile responsive design works on all screen sizes
