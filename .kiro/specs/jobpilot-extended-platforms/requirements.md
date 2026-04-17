# Requirements Document

## Introduction

This feature extends the JobPilot engine in two directions:

1. **Six new job board scrapers and applicators** — Internshala, Shine.com, TimesJobs, Wellfound/AngelList, Glassdoor, and Unstop are added to `handler.js` alongside the existing LinkedIn, Naukri, and Indeed scrapers. Each new platform follows the same scrape → score → apply → persist pipeline already established for the three existing platforms.

2. **Live dashboard** — The current `index.html` is a static S3 site that renders hardcoded seed data. This feature replaces the seed data with real-time reads from DynamoDB by introducing a new read-only API Lambda behind API Gateway. The dashboard fetches from this endpoint on page load and on a configurable polling interval, displaying live application records, aggregate stats, and activity logs.

All new infrastructure remains within AWS free-tier limits. The new API Lambda and API Gateway REST endpoint add negligible cost (well under $0.50/month at the expected call volume).

---

## Glossary

- **Engine**: The existing AWS Lambda function (`jobpilot-engine`) that orchestrates the scrape → score → apply → notify pipeline.
- **Scraper**: A Puppeteer-based browser automation module that logs in (where required) and extracts job listings from a single platform.
- **Applicator**: The platform-specific automation module that submits an application for a given job listing.
- **Scorer**: The Gemma 4 27B integration that evaluates a job listing against the candidate's CV and returns a numeric match score.
- **Job_Record**: A DynamoDB item in the `jobpilot-applications` table representing a single evaluated job listing and its outcome.
- **Dashboard**: The static single-page HTML application hosted on S3 that visualises application history and engine status.
- **Dashboard_API**: A new read-only AWS Lambda function exposed via API Gateway that queries DynamoDB and returns Job_Records to the Dashboard.
- **API_Gateway**: The AWS API Gateway REST API that routes HTTP GET requests from the Dashboard to the Dashboard_API Lambda.
- **MATCH_THRESHOLD**: The minimum Scorer score (default 75) above which the Applicator will attempt to apply.
- **MAX_APPLY_PER_RUN**: The maximum number of applications the Engine will submit in a single run (default 10).
- **APPLY_DELAY_MS**: The mandatory pause between consecutive application attempts (default 35,000 ms).
- **SSM**: AWS Systems Manager Parameter Store, used to store all secrets and configuration values.
- **Platform**: One of the nine supported job boards — LinkedIn, Naukri, Indeed India, Internshala, Shine.com, TimesJobs, Wellfound, Glassdoor, or Unstop.
- **CONFIG**: The runtime configuration object in `handler.js` that holds feature flags and tuning parameters.
- **Internshala**: An Indian job board focused on internships and entry-level/fresher roles.
- **Shine**: Shine.com, an India-focused job board operated by HT Media.
- **TimesJobs**: An Indian job board operated by Times Internet (Times Group).
- **Wellfound**: Wellfound (formerly AngelList Talent), a global job board focused on startup roles.
- **Glassdoor**: A global job board that combines job listings with company reviews and salary data.
- **Unstop**: An Indian platform (formerly Dare2Compete) hosting competitions, hackathons, and job listings for students and freshers.
- **CORS**: Cross-Origin Resource Sharing — HTTP headers that allow the S3-hosted Dashboard to call the API Gateway endpoint from a browser.

---

## Requirements

### Requirement 1: Internshala Job Scraping

**User Story:** As a job seeker, I want the engine to scrape Internshala for fresher and junior developer roles, so that I can reach entry-level and internship listings not covered by LinkedIn or Naukri.

#### Acceptance Criteria

1. WHEN the Internshala Scraper is invoked, THE Scraper SHALL navigate to `internshala.com` with a search query targeting web development and Node.js roles without requiring authentication.
2. THE Scraper SHALL extract up to 20 job listings per run, capturing: listing ID, title, company name, location (or "Remote" if remote), stipend/salary, job URL, and platform identifier `Internshala`.
3. IF the Internshala search page fails to load within 30 seconds, THEN THE Scraper SHALL log a timeout error and return an empty array.
4. THE Scraper SHALL block image, font, and media resource requests to reduce Lambda memory usage.
5. THE Scraper SHALL apply the stealth page configuration (user-agent, Accept-Language header) before navigating.

---

### Requirement 2: Internshala Job Application

**User Story:** As a job seeker, I want the engine to submit applications on Internshala for qualifying listings, so that fresher-friendly roles are applied to automatically.

#### Acceptance Criteria

1. WHEN an Internshala listing scores at or above MATCH_THRESHOLD and has no disqualifying red flags, THE Applicator SHALL navigate to the listing URL and click the primary apply button.
2. IF a multi-step application form is detected, THEN THE Applicator SHALL iterate through up to 5 steps, clicking the next or submit button at each step.
3. IF no apply button is found on the listing page, THEN THE Applicator SHALL log the skip reason and return a failure result without throwing an error.
4. IF the application flow encounters an unrecoverable error, THEN THE Applicator SHALL log the error and return a failure result.

---

### Requirement 3: Shine.com Job Scraping

**User Story:** As a job seeker, I want the engine to scrape Shine.com for Node.js and full-stack roles in India, so that I reach HT Media's job board audience.

#### Acceptance Criteria

1. WHEN the Shine Scraper is invoked, THE Scraper SHALL navigate to `shine.com` with a search query for Node.js and full-stack developer roles in India without requiring authentication.
2. THE Scraper SHALL extract up to 20 job listings per run, capturing: listing ID, title, company name, location, salary, job URL, and platform identifier `Shine`.
3. IF the Shine search page fails to load within 30 seconds, THEN THE Scraper SHALL log a timeout error and return an empty array.
4. THE Scraper SHALL block image, font, and media resource requests to reduce Lambda memory usage.
5. THE Scraper SHALL apply the stealth page configuration before navigating.

---

### Requirement 4: Shine.com Job Application

**User Story:** As a job seeker, I want the engine to submit applications on Shine.com for qualifying listings, so that India-specific roles on that platform are applied to automatically.

#### Acceptance Criteria

1. WHEN a Shine listing scores at or above MATCH_THRESHOLD and has no disqualifying red flags, THE Applicator SHALL navigate to the listing URL and click the primary apply button.
2. IF a confirmation dialog appears after clicking apply, THEN THE Applicator SHALL confirm the dialog to complete the application.
3. IF no apply button is found on the listing page, THEN THE Applicator SHALL log the skip reason and return a failure result without throwing an error.
4. IF the application flow encounters an unrecoverable error, THEN THE Applicator SHALL log the error and return a failure result.

---

### Requirement 5: TimesJobs Job Scraping

**User Story:** As a job seeker, I want the engine to scrape TimesJobs for Node.js and MERN roles posted recently in India, so that I cover the Times Group job board.

#### Acceptance Criteria

1. WHEN the TimesJobs Scraper is invoked, THE Scraper SHALL navigate to `timesjobs.com` with a search query for Node.js developer roles in India, filtered to listings posted within the last 3 days, without requiring authentication.
2. THE Scraper SHALL extract up to 20 job listings per run, capturing: listing ID, title, company name, location, salary, job URL, and platform identifier `TimesJobs`.
3. IF the TimesJobs search page fails to load within 30 seconds, THEN THE Scraper SHALL log a timeout error and return an empty array.
4. THE Scraper SHALL block image, font, and media resource requests to reduce Lambda memory usage.
5. THE Scraper SHALL apply the stealth page configuration before navigating.

---

### Requirement 6: TimesJobs Job Application

**User Story:** As a job seeker, I want the engine to submit applications on TimesJobs for qualifying listings, so that Times Group listings are applied to automatically.

#### Acceptance Criteria

1. WHEN a TimesJobs listing scores at or above MATCH_THRESHOLD and has no disqualifying red flags, THE Applicator SHALL navigate to the listing URL and click the primary apply button.
2. IF a confirmation modal appears after clicking apply, THEN THE Applicator SHALL confirm the modal to complete the application.
3. IF no apply button is found on the listing page, THEN THE Applicator SHALL log the skip reason and return a failure result without throwing an error.
4. IF the application flow encounters an unrecoverable error, THEN THE Applicator SHALL log the error and return a failure result.

---

### Requirement 7: Wellfound Job Scraping

**User Story:** As a job seeker, I want the engine to scrape Wellfound for startup engineering roles globally and in India, so that I can reach startup-focused listings not available on traditional job boards.

#### Acceptance Criteria

1. WHEN the Wellfound Scraper is invoked, THE Scraper SHALL navigate to `wellfound.com` with a search query for full-stack and Node.js roles, filtered to remote or India-based positions, without requiring authentication for the search results page.
2. THE Scraper SHALL extract up to 20 job listings per run, capturing: listing ID, title, company name, location, salary/equity range (if available), job URL, and platform identifier `Wellfound`.
3. IF the Wellfound search page fails to load within 30 seconds, THEN THE Scraper SHALL log a timeout error and return an empty array.
4. THE Scraper SHALL block image, font, and media resource requests to reduce Lambda memory usage.
5. THE Scraper SHALL apply the stealth page configuration before navigating.

---

### Requirement 8: Wellfound Job Application

**User Story:** As a job seeker, I want the engine to submit applications on Wellfound for qualifying startup roles, so that startup listings are applied to automatically.

#### Acceptance Criteria

1. WHEN a Wellfound listing scores at or above MATCH_THRESHOLD and has no disqualifying red flags, THE Applicator SHALL navigate to the listing URL and click the primary apply button.
2. IF a multi-step application form is detected, THEN THE Applicator SHALL iterate through up to 5 steps, clicking the next or submit button at each step.
3. IF no apply button is found on the listing page, THEN THE Applicator SHALL log the skip reason and return a failure result without throwing an error.
4. IF the application flow encounters an unrecoverable error, THEN THE Applicator SHALL log the error and return a failure result.

---

### Requirement 9: Glassdoor Job Scraping

**User Story:** As a job seeker, I want the engine to scrape Glassdoor for Node.js and full-stack roles in India, so that I can access Glassdoor's listings alongside company review context.

#### Acceptance Criteria

1. WHEN the Glassdoor Scraper is invoked, THE Scraper SHALL navigate to `glassdoor.co.in` with a search query for Node.js developer roles in India, filtered to listings posted within the last 7 days, without requiring authentication.
2. THE Scraper SHALL extract up to 20 job listings per run, capturing: listing ID, title, company name, location, salary estimate (if available), job URL, and platform identifier `Glassdoor`.
3. IF a sign-in prompt or overlay is detected before listings are accessible, THEN THE Scraper SHALL attempt to dismiss it and continue extraction.
4. IF the Glassdoor search page fails to load within 30 seconds, THEN THE Scraper SHALL log a timeout error and return an empty array.
5. THE Scraper SHALL block image, font, and media resource requests to reduce Lambda memory usage.
6. THE Scraper SHALL apply the stealth page configuration before navigating.

---

### Requirement 10: Glassdoor Job Application

**User Story:** As a job seeker, I want the engine to submit applications on Glassdoor for qualifying listings, so that Glassdoor-sourced roles are applied to automatically.

#### Acceptance Criteria

1. WHEN a Glassdoor listing scores at or above MATCH_THRESHOLD and has no disqualifying red flags, THE Applicator SHALL navigate to the listing URL and click the primary apply button.
2. IF the apply button redirects to an external company site, THEN THE Applicator SHALL log the external redirect and return a failure result, as external redirects cannot be automated reliably.
3. IF a Glassdoor-native application form is detected, THEN THE Applicator SHALL iterate through up to 5 steps, clicking the next or submit button at each step.
4. IF no apply button is found on the listing page, THEN THE Applicator SHALL log the skip reason and return a failure result without throwing an error.
5. IF the application flow encounters an unrecoverable error, THEN THE Applicator SHALL log the error and return a failure result.

---

### Requirement 11: Unstop Job Scraping

**User Story:** As a job seeker, I want the engine to scrape Unstop for developer job listings and opportunities targeted at students and freshers, so that I can reach this growing platform's audience.

#### Acceptance Criteria

1. WHEN the Unstop Scraper is invoked, THE Scraper SHALL navigate to `unstop.com` with a search query for developer and engineering roles, without requiring authentication.
2. THE Scraper SHALL extract up to 20 listings per run, capturing: listing ID, title, company name, location (or "Remote"), stipend/salary (if available), listing URL, and platform identifier `Unstop`.
3. IF the Unstop search page fails to load within 30 seconds, THEN THE Scraper SHALL log a timeout error and return an empty array.
4. THE Scraper SHALL block image, font, and media resource requests to reduce Lambda memory usage.
5. THE Scraper SHALL apply the stealth page configuration before navigating.

---

### Requirement 12: Unstop Job Application

**User Story:** As a job seeker, I want the engine to submit applications on Unstop for qualifying listings, so that Unstop opportunities are applied to automatically.

#### Acceptance Criteria

1. WHEN an Unstop listing scores at or above MATCH_THRESHOLD and has no disqualifying red flags, THE Applicator SHALL navigate to the listing URL and click the primary apply or register button.
2. IF a multi-step application form is detected, THEN THE Applicator SHALL iterate through up to 5 steps, clicking the next or submit button at each step.
3. IF no apply button is found on the listing page, THEN THE Applicator SHALL log the skip reason and return a failure result without throwing an error.
4. IF the application flow encounters an unrecoverable error, THEN THE Applicator SHALL log the error and return a failure result.

---

### Requirement 13: Extended Platform Configuration

**User Story:** As a developer, I want each new platform to have an independent enable/disable flag in CONFIG, so that individual scrapers can be turned off without code changes.

#### Acceptance Criteria

1. THE CONFIG object in `handler.js` SHALL include a boolean enable flag for each new platform: `INTERNSHALA_ENABLED`, `SHINE_ENABLED`, `TIMESJOBS_ENABLED`, `WELLFOUND_ENABLED`, `GLASSDOOR_ENABLED`, and `UNSTOP_ENABLED`.
2. WHEN a platform's enable flag is `false`, THE Engine SHALL skip that platform's scraper and applicator entirely during a run.
3. THE `applyToJob` router function SHALL handle all nine platform identifiers: `LinkedIn`, `Naukri`, `Indeed`, `Internshala`, `Shine`, `TimesJobs`, `Wellfound`, `Glassdoor`, and `Unstop`.
4. THE daily Digest email SHALL list all nine platforms in the footer platform line.

---

### Requirement 14: Extended SSM Credentials

**User Story:** As a developer, I want credentials for platforms that require login to be stored in SSM Parameter Store, so that no sensitive data is hardcoded.

#### Acceptance Criteria

1. THE SSM paths object SHALL include credential entries for Internshala (`/jobpilot/internshala/email`, `/jobpilot/internshala/password`), Shine (`/jobpilot/shine/email`, `/jobpilot/shine/password`), Wellfound (`/jobpilot/wellfound/email`, `/jobpilot/wellfound/password`), and Glassdoor (`/jobpilot/glassdoor/email`, `/jobpilot/glassdoor/password`).
2. THE Terraform configuration SHALL define `aws_ssm_parameter` resources for each new credential path, accepting values via sensitive Terraform variables.
3. IF any new SSM parameter fetch fails, THEN THE Engine SHALL log the parameter name and error, and SHALL skip the dependent platform rather than aborting the entire run.

---

### Requirement 15: Dashboard API Lambda

**User Story:** As a developer, I want a dedicated read-only Lambda function that queries DynamoDB and returns Job_Records as JSON, so that the static dashboard can display live data without a backend server.

#### Acceptance Criteria

1. THE Dashboard_API SHALL be a separate AWS Lambda function (`jobpilot-dashboard-api`) distinct from the Engine Lambda.
2. WHEN the Dashboard_API receives an HTTP GET request, THE Dashboard_API SHALL query the `jobpilot-applications` DynamoDB table and return up to 100 of the most recently applied Job_Records, sorted by `appliedAt` descending.
3. THE Dashboard_API response SHALL be a JSON object containing: an `items` array of Job_Records, a `stats` object with aggregate counts (`totalApplied`, `interviews`, `pending`, `skipped`), and a `lastUpdated` ISO 8601 timestamp.
4. THE Dashboard_API SHALL return HTTP 200 with the JSON payload on success.
5. IF the DynamoDB query fails, THEN THE Dashboard_API SHALL return HTTP 500 with a JSON error body `{"error": "Failed to fetch records"}`.
6. THE Dashboard_API response SHALL include CORS headers (`Access-Control-Allow-Origin: *`) to permit browser fetch calls from the S3-hosted Dashboard.
7. THE Dashboard_API SHALL complete its DynamoDB query and return a response within 5 seconds.

---

### Requirement 16: API Gateway Endpoint

**User Story:** As a developer, I want the Dashboard_API Lambda exposed via API Gateway, so that the static S3 dashboard can call it over HTTPS from a browser.

#### Acceptance Criteria

1. THE Terraform configuration SHALL define an `aws_api_gateway_rest_api` resource named `jobpilot-dashboard-api`.
2. THE API Gateway SHALL expose a single resource path `/jobs` with an HTTP GET method that proxies to the Dashboard_API Lambda.
3. THE API Gateway SHALL be deployed to a stage named `prod`.
4. THE API Gateway SHALL enable CORS on the `/jobs` resource by responding to OPTIONS preflight requests with the appropriate `Access-Control-Allow-*` headers.
5. THE Terraform configuration SHALL output the full API Gateway invoke URL as `dashboard_api_url`.
6. THE Dashboard_API Lambda's IAM policy SHALL grant `dynamodb:Scan` and `dynamodb:Query` permissions on the `jobpilot-applications` table.

---

### Requirement 17: Live Dashboard Data Fetching

**User Story:** As a job seeker, I want the dashboard to load real application data from DynamoDB on page load, so that I see my actual history instead of hardcoded seed data.

#### Acceptance Criteria

1. WHEN the Dashboard page loads, THE Dashboard SHALL fetch job records from the Dashboard_API endpoint using the browser Fetch API.
2. THE Dashboard SHALL read the API endpoint URL from a JavaScript constant `API_URL` defined at the top of the inline script, so that the URL can be updated after Terraform deployment without modifying application logic.
3. WHILE the Dashboard is fetching data, THE Dashboard SHALL display a loading indicator in the jobs table and stats cards.
4. WHEN the fetch succeeds, THE Dashboard SHALL replace all hardcoded seed data with the live records returned by the API, updating the stats cards, jobs table, and activity log.
5. IF the fetch fails or returns a non-200 status, THEN THE Dashboard SHALL display an error message in the jobs table area and retain the last successfully loaded data (or empty state on first load).
6. THE Dashboard SHALL re-fetch data from the API every 60 seconds to reflect new Engine runs without requiring a manual page refresh.
7. THE Dashboard SHALL display the `lastUpdated` timestamp from the API response in the topbar next to the cron schedule display.

---

### Requirement 18: Live Dashboard Platform Toggles

**User Story:** As a job seeker, I want the dashboard's platform toggle list to include all nine platforms, so that the UI reflects the full set of supported job boards.

#### Acceptance Criteria

1. THE Dashboard platform toggles section SHALL display toggle rows for all nine platforms: LinkedIn, Naukri, Indeed, Internshala, Shine, TimesJobs, Wellfound, Glassdoor, and Unstop.
2. THE Dashboard SHALL derive each platform's toggle state from the presence of Job_Records for that platform in the most recently fetched data — a platform with at least one record in the last 24 hours SHALL render its toggle as active.
3. WHEN a user clicks a platform toggle, THE Dashboard SHALL update the jobs table filter to show or hide records from that platform.

---

### Requirement 19: DynamoDB GSI for Dashboard Queries

**User Story:** As a developer, I want a DynamoDB Global Secondary Index on `appliedAt` so that the Dashboard_API can efficiently retrieve the most recent records without a full table scan.

#### Acceptance Criteria

1. THE Terraform configuration SHALL add a Global Secondary Index named `appliedAt-index` to the `jobpilot-applications` table, with `appliedAt` as the hash key (type String) and `platform` as the sort key (type String).
2. THE Dashboard_API SHALL use the `appliedAt-index` GSI when querying for recent records, falling back to a table Scan only if the GSI query fails.
3. THE GSI SHALL use on-demand billing mode consistent with the base table.

---

### Requirement 20: Parser and Serialiser — Dashboard API Response

**User Story:** As a developer, I want the Dashboard_API response parsing in the frontend to be robust, so that a malformed or partial API response never crashes the dashboard.

#### Acceptance Criteria

1. WHEN the Dashboard receives an API response, THE Dashboard SHALL parse the response body as JSON and validate that the `items` array and `stats` object are present before rendering.
2. IF the `items` field is missing or not an array, THEN THE Dashboard SHALL treat it as an empty array and render an empty jobs table.
3. IF the `stats` field is missing or any stat count is non-numeric, THEN THE Dashboard SHALL display `—` in the affected stat card rather than crashing.
4. FOR ALL valid Dashboard_API responses, parsing the JSON body SHALL produce an object with an `items` array and a `stats` object (round-trip property: serialising the parsed object back to JSON and re-parsing SHALL produce an equivalent object).

