# Requirements Document

## Introduction

JobPilot is an automated job application engine that runs daily at 09:00 IST via AWS EventBridge. It scrapes LinkedIn, Naukri.com, and Indeed India for MERN/Node.js/TypeScript roles in India, scores each listing against the user's CV using Gemma 4 27B (Google AI Studio free tier), and auto-applies to any job scoring ≥75%. All infrastructure runs on AWS free-tier services (Lambda, DynamoDB, SES, S3, SSM, EventBridge), targeting a total monthly cost of $0.00.

---

## Glossary

- **Engine**: The AWS Lambda function (`jobpilot-engine`) that orchestrates the full scrape → score → apply → notify pipeline.
- **Scraper**: A Puppeteer-based browser automation module responsible for logging in and extracting job listings from a single platform.
- **Scorer**: The Gemma 4 27B integration that evaluates a job listing against the candidate's CV and returns a numeric match score.
- **Applicator**: The platform-specific automation module that submits an application for a given job listing.
- **Job_Record**: A DynamoDB item representing a single job listing and its application outcome.
- **Digest**: The daily summary email sent via SES after each Engine run.
- **CV**: The candidate's curriculum vitae stored as plain text in AWS SSM Parameter Store.
- **MATCH_THRESHOLD**: The minimum Scorer score (default 75) above which the Applicator will attempt to apply.
- **MAX_APPLY_PER_RUN**: The maximum number of applications the Engine will submit in a single run (default 10).
- **APPLY_DELAY_MS**: The mandatory pause between consecutive application attempts (default 35,000 ms).
- **SSM**: AWS Systems Manager Parameter Store, used to store all secrets and configuration values.
- **Platform**: One of the three supported job boards — LinkedIn, Naukri, or Indeed India.

---

## Requirements

### Requirement 1: Scheduled Daily Execution

**User Story:** As a job seeker, I want the engine to run automatically every morning at 09:00 IST, so that I don't have to manually trigger job searches.

#### Acceptance Criteria

1. THE Engine SHALL be triggered by an AWS EventBridge Scheduler rule using the cron expression `cron(30 3 * * ? *)` (03:30 UTC = 09:00 IST).
2. THE Engine SHALL complete its full pipeline within 300 seconds (the Lambda timeout).
3. IF the Engine run exceeds 300 seconds, THEN THE Engine SHALL log a timeout warning and the partial results SHALL be persisted to DynamoDB before termination.
4. THE Engine SHALL support manual invocation via the AWS Lambda console or CLI in addition to the scheduled trigger.

---

### Requirement 2: Secret and Configuration Management

**User Story:** As a developer, I want all credentials and configuration stored securely, so that no sensitive data is exposed in source code or environment variables.

#### Acceptance Criteria

1. THE Engine SHALL retrieve all platform credentials (LinkedIn email/password, Naukri email/password) from AWS SSM Parameter Store using `SecureString` type parameters at runtime.
2. THE Engine SHALL retrieve the Gemma 4 API key from SSM Parameter Store using a `SecureString` parameter at runtime.
3. THE Engine SHALL retrieve the candidate CV text from SSM Parameter Store using a `SecureString` parameter at runtime.
4. THE Engine SHALL retrieve the notification email address from SSM Parameter Store at runtime.
5. IF any SSM parameter fetch fails, THEN THE Engine SHALL log the parameter name and error, and SHALL skip the dependent platform or feature rather than aborting the entire run.
6. THE Engine SHALL read runtime configuration (MATCH_THRESHOLD, MAX_APPLY_PER_RUN, APPLY_DELAY_MS, platform enable flags) from the `CONFIG` object defined in the handler source.

---

### Requirement 3: LinkedIn Job Scraping

**User Story:** As a job seeker, I want the engine to scrape LinkedIn for Easy Apply MERN/Node.js/TypeScript roles posted in the last 24 hours in India, so that I get fresh, relevant listings daily.

#### Acceptance Criteria

1. WHEN the LinkedIn Scraper is invoked, THE Scraper SHALL authenticate to LinkedIn using credentials retrieved from SSM.
2. WHEN authentication succeeds, THE Scraper SHALL navigate to the LinkedIn job search URL filtered by keywords `Node.js TypeScript Full Stack MERN`, location `India`, Easy Apply flag, and date posted within the last 24 hours.
3. THE Scraper SHALL extract up to 25 job listings per run, capturing: job ID, title, company name, location, job URL, and platform identifier `LinkedIn`.
4. IF LinkedIn authentication fails, THEN THE Scraper SHALL log the error and return an empty array without retrying.
5. IF the LinkedIn job search page fails to load within 30 seconds, THEN THE Scraper SHALL log a timeout error and return an empty array.
6. THE Scraper SHALL block image, font, and media resource requests to reduce page load time and Lambda memory usage.

---

### Requirement 4: Naukri.com Job Scraping

**User Story:** As a job seeker, I want the engine to scrape Naukri.com for Node.js roles with 3–7 years experience posted in the last 3 days, so that I reach India-specific listings not available on LinkedIn.

#### Acceptance Criteria

1. WHEN the Naukri Scraper is invoked, THE Scraper SHALL authenticate to Naukri.com using credentials retrieved from SSM.
2. WHEN authentication succeeds, THE Scraper SHALL navigate to the Naukri job search URL filtered by keyword `nodejs`, experience range 3–7 years, job age 3 days, and location India with remote/hybrid options.
3. THE Scraper SHALL extract up to 20 job listings per run, capturing: job ID, title, company name, location, salary, job URL, and platform identifier `Naukri`.
4. IF Naukri authentication fails, THEN THE Scraper SHALL log the error and return an empty array without retrying.
5. IF the Naukri job search page fails to load within 30 seconds, THEN THE Scraper SHALL log a timeout error and return an empty array.

---

### Requirement 5: Indeed India Job Scraping

**User Story:** As a job seeker, I want the engine to scrape Indeed India for Node.js/TypeScript/MERN roles posted in the last 3 days, so that I cover a third source of job listings without requiring a login.

#### Acceptance Criteria

1. WHEN the Indeed Scraper is invoked, THE Scraper SHALL navigate to `in.indeed.com` with search query `nodejs typescript mern full stack developer`, location `India`, and date filter of 3 days, without requiring authentication.
2. THE Scraper SHALL extract up to 20 job listings per run, capturing: job key (data-jk), title, company name, location, salary, job URL, and platform identifier `Indeed`.
3. IF a cookie consent prompt is detected on the Indeed page, THEN THE Scraper SHALL dismiss it before extracting listings.
4. IF the Indeed job search page fails to load within 30 seconds, THEN THE Scraper SHALL log a timeout error and return an empty array.

---

### Requirement 6: Cross-Platform Deduplication

**User Story:** As a job seeker, I want duplicate job listings removed before scoring, so that I don't waste Gemma 4 API quota or apply to the same role twice.

#### Acceptance Criteria

1. WHEN job listings from all Scrapers are combined, THE Engine SHALL deduplicate the combined list by normalising and comparing the composite key of `company name + job title` (case-insensitive, trimmed).
2. THE Engine SHALL retain the first occurrence of a duplicate and discard subsequent occurrences.
3. WHEN a job ID already exists in DynamoDB with status `Applied`, THE Engine SHALL skip that listing without scoring or applying.

---

### Requirement 7: AI-Based Job Scoring

**User Story:** As a job seeker, I want each job listing scored against my CV by Gemma 4 27B, so that only genuinely relevant roles are applied to automatically.

#### Acceptance Criteria

1. WHEN a deduplicated job listing is ready for scoring, THE Scorer SHALL send a structured prompt to the Gemma 4 27B model (`gemma-4-27b-it`) via the Google AI Studio API.
2. THE Scorer SHALL include in the prompt: candidate name, role, company, experience, skills, location preference, salary floor, target role titles, and the first 1,200 characters of the CV text.
3. THE Scorer SHALL include in the prompt: job title, company, location, platform, and salary information.
4. THE Scorer SHALL request a JSON response with fields: `score` (integer 0–100), `reason` (one sentence), and `redFlags` (mismatch description or "none").
5. THE Scorer SHALL use a temperature of 0.1 and a maximum of 120 output tokens per request.
6. IF the Scorer API call fails or returns unparseable JSON, THEN THE Scorer SHALL return a default score of 60 with reason "Scoring unavailable — defaulting to 60%" and redFlags "none".
7. THE Engine SHALL respect the Gemma 4 free-tier limit of 15 requests per minute by processing job scores sequentially (not concurrently).

---

### Requirement 8: Automated Application — LinkedIn Easy Apply

**User Story:** As a job seeker, I want the engine to submit LinkedIn Easy Apply applications on my behalf for qualifying jobs, so that I don't have to manually click through each application form.

#### Acceptance Criteria

1. WHEN a LinkedIn job scores at or above MATCH_THRESHOLD and has no disqualifying red flags, THE Applicator SHALL navigate to the job URL and click the Easy Apply button.
2. THE Applicator SHALL iterate through up to 6 application steps, clicking "Continue to next step" or "Review your application" buttons as they appear.
3. IF a phone number field is detected and is empty, THEN THE Applicator SHALL populate it with the candidate's phone number retrieved from SSM.
4. WHEN the "Submit application" button is detected, THE Applicator SHALL click it and record the application as successful.
5. IF no Easy Apply button is found on the job page, THEN THE Applicator SHALL log the skip reason and return a failure result without throwing an error.
6. IF the application flow encounters an unrecoverable error, THEN THE Applicator SHALL log the error and return a failure result.

---

### Requirement 9: Automated Application — Naukri.com

**User Story:** As a job seeker, I want the engine to submit 1-click applications on Naukri.com for qualifying jobs, so that I can apply to India-specific listings automatically.

#### Acceptance Criteria

1. WHEN a Naukri job scores at or above MATCH_THRESHOLD and has no disqualifying red flags, THE Applicator SHALL navigate to the job URL and click the primary apply button.
2. IF a confirmation modal appears after clicking apply, THEN THE Applicator SHALL click the confirm button to complete the application.
3. IF no apply button is found on the job page, THEN THE Applicator SHALL log the skip reason and return a failure result without throwing an error.
4. IF the application flow encounters an unrecoverable error, THEN THE Applicator SHALL log the error and return a failure result.

---

### Requirement 10: Automated Application — Indeed India

**User Story:** As a job seeker, I want the engine to submit Indeed Instant Apply applications for qualifying jobs, so that I can apply to Indeed India listings automatically.

#### Acceptance Criteria

1. WHEN an Indeed job scores at or above MATCH_THRESHOLD and has no disqualifying red flags, THE Applicator SHALL navigate to the job URL and click the Indeed Apply button.
2. THE Applicator SHALL locate the Smart Apply iframe and iterate through up to 5 submission steps.
3. WHEN a submit button with text containing "submit" is detected within the iframe, THE Applicator SHALL click it and record the application as successful.
4. IF no Indeed Apply button is found on the job page, THEN THE Applicator SHALL log the skip reason and return a failure result without throwing an error.
5. IF the Smart Apply iframe is not found after clicking the apply button, THEN THE Applicator SHALL log the error and return a failure result.

---

### Requirement 11: Application Rate Limiting

**User Story:** As a job seeker, I want the engine to apply slowly and stay within daily limits, so that my accounts are not flagged or banned by job platforms.

#### Acceptance Criteria

1. THE Engine SHALL apply to a maximum of MAX_APPLY_PER_RUN (default 10) jobs per Lambda invocation across all platforms combined.
2. THE Engine SHALL wait APPLY_DELAY_MS (default 35,000 ms) between each successful application submission.
3. THE Engine SHALL NOT apply to more than MAX_APPLY_PER_RUN jobs even if more qualifying listings are available.

---

### Requirement 12: Job Record Persistence

**User Story:** As a job seeker, I want every evaluated job stored in DynamoDB, so that I have a complete history and can avoid re-applying to the same role.

#### Acceptance Criteria

1. THE Engine SHALL write a Job_Record to DynamoDB for every job that is scored, regardless of whether an application was submitted.
2. EACH Job_Record SHALL contain: jobId, title, company, platform, location, salary, url, score, reason, status (Applied/Skipped/Error), appliedAt timestamp, and expiresAt TTL.
3. THE Engine SHALL set the DynamoDB TTL (expiresAt) to 90 days from the time of writing, so that old records are automatically deleted.
4. THE Engine SHALL use a conditional write (`attribute_not_exists(jobId)`) to ensure Job_Records are idempotent and duplicate writes are silently ignored.
5. IF a DynamoDB write fails for a reason other than a conditional check failure, THEN THE Engine SHALL log the error and continue processing remaining jobs.

---

### Requirement 13: Daily Digest Notification

**User Story:** As a job seeker, I want to receive a daily email summary of what was applied to, skipped, and errored, so that I can review the engine's activity each morning.

#### Acceptance Criteria

1. WHEN the Engine completes its pipeline, THE Engine SHALL send a Digest email via AWS SES to the notification address retrieved from SSM.
2. THE Digest SHALL include: the run date, count and list of applied jobs (platform, company, title, score), count and list of skipped jobs (up to 5, with overflow count), and count of errors with descriptions.
3. THE Digest SHALL include the next scheduled run time (tomorrow 09:00 IST).
4. IF the SES send call fails, THEN THE Engine SHALL log the SES error and return a successful Lambda response regardless, so that a digest failure does not mark the run as failed.

---

### Requirement 14: Browser Stealth and Resource Optimisation

**User Story:** As a developer, I want the browser automation to mimic human behaviour and minimise resource usage, so that the Lambda stays within memory limits and avoids bot detection.

#### Acceptance Criteria

1. THE Scraper SHALL set a realistic Chrome user-agent string and `Accept-Language: en-IN` header on every new browser page.
2. THE Scraper SHALL block image, font, and media resource requests on every page to reduce memory and network usage.
3. THE Scraper SHALL use human-like typing with a randomised per-character delay between 60 ms and 110 ms when entering credentials.
4. THE Scraper SHALL perform incremental page scrolling (auto-scroll) to trigger lazy-loaded job listings before extraction.
5. THE Engine SHALL launch Chromium using `@sparticuz/chromium` with the `--no-sandbox`, `--disable-setuid-sandbox`, and `--disable-dev-shm-usage` flags.
6. THE Engine SHALL close the Puppeteer browser instance in a `finally` block to ensure cleanup even when errors occur.

---

### Requirement 15: Infrastructure as Code

**User Story:** As a developer, I want all AWS infrastructure defined in Terraform, so that the entire system can be deployed and torn down with a single command.

#### Acceptance Criteria

1. THE Terraform configuration SHALL define all required AWS resources: Lambda function, IAM role and policy, EventBridge Scheduler, DynamoDB table, SSM parameters, SES configuration, and S3 bucket for the dashboard.
2. THE Lambda function SHALL be configured with 1,024 MB memory, 300-second timeout, 1,024 MB ephemeral storage, and Node.js 20.x runtime.
3. THE DynamoDB table SHALL use on-demand billing mode and define a TTL attribute named `expiresAt`.
4. THE EventBridge Scheduler SHALL use the cron expression `cron(30 3 * * ? *)` with a fixed-time window (no flexibility).
5. THE S3 bucket SHALL be configured for static website hosting with `index.html` as the index document.
6. THE Terraform configuration SHALL accept sensitive variables for all credentials (gemini_api_key, linkedin_email, linkedin_password, naukri_email, naukri_password, notify_email) and SHALL NOT hardcode any credential values.

---

### Requirement 16: Dashboard UI

**User Story:** As a job seeker, I want a static web dashboard hosted on S3 that shows my application history and engine status, so that I can monitor JobPilot without logging into AWS.

#### Acceptance Criteria

1. THE Dashboard SHALL display aggregate statistics: total applications submitted, interviews received, applications pending review, and applications skipped.
2. THE Dashboard SHALL display a table of recent job applications with columns: company/role, platform, match score, salary, and status.
3. THE Dashboard SHALL display a real-time activity log of Lambda execution events.
4. THE Dashboard SHALL display the current cron schedule and next run time.
5. THE Dashboard SHALL allow the user to toggle individual platforms (LinkedIn, Naukri, Indeed) on or off.
6. THE Dashboard SHALL allow the user to adjust the MATCH_THRESHOLD value via a slider control.
7. THE Dashboard SHALL be a single self-contained HTML file deployable to S3 static website hosting with no server-side dependencies.

---

### Requirement 17: Parser and Serialiser — Gemma 4 Score Response

**User Story:** As a developer, I want the Scorer's JSON response parsing to be robust, so that a malformed AI response never crashes the Engine.

#### Acceptance Criteria

1. WHEN the Scorer receives a response from Gemma 4, THE Scorer SHALL parse the response text as JSON after stripping any markdown code fences.
2. IF the parsed JSON is missing the `score` field, THEN THE Scorer SHALL substitute a default score of 60.
3. IF the parsed JSON is missing the `reason` field, THEN THE Scorer SHALL substitute the string "No reason provided".
4. IF the parsed JSON is missing the `redFlags` field, THEN THE Scorer SHALL substitute the string "none".
5. FOR ALL valid Scorer JSON responses, parsing the raw text SHALL produce an object with numeric `score`, string `reason`, and string `redFlags` fields (round-trip property: the parsed object re-serialised to JSON and re-parsed SHALL produce an equivalent object).
