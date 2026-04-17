# Implementation Plan: JobPilot Extended Platforms

## Overview

Extend `handler.js` with six new scrapers and applicators (Internshala, Shine, TimesJobs, Wellfound, Glassdoor, Unstop), add a read-only Dashboard API Lambda (`dashboard-api.js`), wire it behind API Gateway, add a DynamoDB GSI, and upgrade `index.html` to fetch live data. Tasks build incrementally from config flags through scrapers, applicators, infrastructure, dashboard, and property-based tests.

## Tasks

- [x] 1. Extended CONFIG flags and SSM paths
  - [x] 1.1 Add six new platform enable flags to CONFIG in `handler.js`
    - Add `INTERNSHALA_ENABLED: true`, `SHINE_ENABLED: true`, `TIMESJOBS_ENABLED: true`, `WELLFOUND_ENABLED: true`, `GLASSDOOR_ENABLED: true`, `UNSTOP_ENABLED: true` to the existing CONFIG object
    - _Requirements: 13.1_
  - [x] 1.2 Add new SSM credential paths to the SSM paths object in `handler.js`
    - Add entries: `INTERNSHALA_EMAIL`, `INTERNSHALA_PASS`, `SHINE_EMAIL`, `SHINE_PASS`, `WELLFOUND_EMAIL`, `WELLFOUND_PASS`, `GLASSDOOR_EMAIL`, `GLASSDOOR_PASS` pointing to the correct `/jobpilot/...` paths
    - _Requirements: 14.1_
  - [x] 1.3 Fetch new SSM credentials in the handler's parallel `Promise.all` block
    - Add the 8 new `getParam` calls alongside the existing 7; destructure the results into named variables
    - _Requirements: 14.1, 14.3_

- [x] 2. Internshala scraper
  - [x] 2.1 Implement `scrapeInternshala(browser)` in `handler.js`
    - Call `stealthPage(page)` before navigating; navigate to `internshala.com` with a search query for web development and Node.js roles; no authentication required
    - Block image/font/media via `stealthPage`; auto-scroll; extract up to 20 listings with fields: `id` (prefixed `is-`), `title`, `company`, `location`, `salary`, `url`, `platform: 'Internshala'`, `easyApply: false`
    - Return `[]` on 30 s page-load timeout; log the error
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3. Internshala applicator
  - [x] 3.1 Implement `applyInternshala(browser, job)` in `handler.js`
    - Navigate to `job.url`; click the primary apply button; iterate up to 5 steps clicking next/submit buttons
    - Return `false` (no throw) if apply button not found or any unrecoverable error; log skip/error reason
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 4. Shine.com scraper
  - [x] 4.1 Implement `scrapeShine(browser, email, pass)` in `handler.js`
    - Call `stealthPage(page)` before navigating; authenticate with SSM credentials; navigate to `shine.com` with a search query for Node.js and full-stack developer roles in India
    - Extract up to 20 listings with fields: `id` (prefixed `sh-`), `title`, `company`, `location`, `salary`, `url`, `platform: 'Shine'`, `easyApply: false`
    - Return `[]` on auth failure or 30 s timeout; log the error
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. Shine.com applicator
  - [x] 5.1 Implement `applyShine(browser, job)` in `handler.js`
    - Navigate to `job.url`; click the primary apply button; confirm the confirmation dialog if present
    - Return `false` (no throw) if apply button not found or any unrecoverable error; log skip/error reason
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. TimesJobs scraper
  - [x] 6.1 Implement `scrapeTimesJobs(browser)` in `handler.js`
    - Call `stealthPage(page)` before navigating; navigate to `timesjobs.com` with a search query for Node.js developer roles in India, filtered to listings posted within the last 3 days; no authentication required
    - Extract up to 20 listings with fields: `id` (prefixed `tj-`), `title`, `company`, `location`, `salary`, `url`, `platform: 'TimesJobs'`, `easyApply: false`
    - Return `[]` on 30 s timeout; log the error
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7. TimesJobs applicator
  - [x] 7.1 Implement `applyTimesJobs(browser, job)` in `handler.js`
    - Navigate to `job.url`; click the primary apply button; confirm the confirmation modal if present
    - Return `false` (no throw) if apply button not found or any unrecoverable error; log skip/error reason
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 8. Wellfound scraper
  - [x] 8.1 Implement `scrapeWellfound(browser)` in `handler.js`
    - Call `stealthPage(page)` before navigating; navigate to `wellfound.com` with a search query for full-stack and Node.js roles filtered to remote or India-based positions; no authentication required for search results
    - Extract up to 20 listings with fields: `id` (prefixed `wf-`), `title`, `company`, `location`, `salary`, `url`, `platform: 'Wellfound'`, `easyApply: false`
    - Return `[]` on 30 s timeout; log the error
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 9. Wellfound applicator
  - [x] 9.1 Implement `applyWellfound(browser, job)` in `handler.js`
    - Navigate to `job.url`; click the primary apply button; iterate up to 5 steps clicking next/submit buttons
    - Return `false` (no throw) if apply button not found or any unrecoverable error; log skip/error reason
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 10. Glassdoor scraper
  - [x] 10.1 Implement `scrapeGlassdoor(browser)` in `handler.js`
    - Call `stealthPage(page)` before navigating; navigate to `glassdoor.co.in` with a search query for Node.js developer roles in India, filtered to listings posted within the last 7 days; no authentication required
    - If a sign-in prompt or overlay is detected, attempt to dismiss it before extracting listings
    - Extract up to 20 listings with fields: `id` (prefixed `gd-`), `title`, `company`, `location`, `salary`, `url`, `platform: 'Glassdoor'`, `easyApply: false`
    - Return `[]` on 30 s timeout; log the error
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 11. Glassdoor applicator
  - [x] 11.1 Implement `applyGlassdoor(browser, job)` in `handler.js`
    - Navigate to `job.url`; click the primary apply button
    - If the apply button redirects to an external company site, log the external redirect and return `false`
    - If a Glassdoor-native application form is detected, iterate through up to 5 steps clicking next/submit buttons
    - Return `false` (no throw) if apply button not found or any unrecoverable error; log skip/error reason
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 12. Unstop scraper
  - [x] 12.1 Implement `scrapeUnstop(browser)` in `handler.js`
    - Call `stealthPage(page)` before navigating; navigate to `unstop.com` with a search query for developer and engineering roles; no authentication required
    - Extract up to 20 listings with fields: `id` (prefixed `un-`), `title`, `company`, `location`, `salary`, `url`, `platform: 'Unstop'`, `easyApply: false`
    - Return `[]` on 30 s timeout; log the error
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 13. Unstop applicator
  - [x] 13.1 Implement `applyUnstop(browser, job)` in `handler.js`
    - Navigate to `job.url`; click the primary apply or register button; iterate up to 5 steps clicking next/submit buttons
    - Return `false` (no throw) if apply button not found or any unrecoverable error; log skip/error reason
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 14. Extended `applyToJob` router and engine wiring
  - [x] 14.1 Extend `applyToJob` router in `handler.js` to handle all nine platforms
    - Add `case 'Internshala'`, `case 'Shine'`, `case 'TimesJobs'`, `case 'Wellfound'`, `case 'Glassdoor'`, `case 'Unstop'` to the switch statement, delegating to the corresponding applicator functions
    - _Requirements: 13.3_
  - [x] 14.2 Wire new scrapers into the handler's `Promise.allSettled` block
    - Add conditional pushes for each new platform: `if (CONFIG.INTERNSHALA_ENABLED) scrapers.push(scrapeInternshala(browser))`, etc.
    - Pass SSM credentials to Shine scraper; Internshala, TimesJobs, Wellfound, Glassdoor, and Unstop scrapers require no credentials
    - _Requirements: 13.2_
  - [x] 14.3 Update the SES digest email footer platform line to list all nine platforms
    - Change the `Platforms :` line in `sendDigestEmail` to: `LinkedIn · Naukri · Indeed India · Internshala · Shine · TimesJobs · Wellfound · Glassdoor · Unstop`
    - _Requirements: 13.4_

- [x] 15. Checkpoint — all nine scrapers and applicators wired
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Dashboard API Lambda
  - [x] 16.1 Create `dashboard-api.js` with the main handler function
    - Export `handler(event)` that handles GET requests to `/jobs`; return HTTP 405 for any other method
    - On OPTIONS (preflight), return HTTP 200 with CORS headers immediately
    - _Requirements: 15.1, 15.4, 15.6, 16.2_
  - [x] 16.2 Implement `queryRecentRecords()` in `dashboard-api.js`
    - Query the `appliedAt-index` GSI using `QueryCommand` with `Limit: 100`, `ScanIndexForward: false` to get most recent records first
    - On GSI query failure, fall back to a full table `ScanCommand`; log the GSI failure
    - Return the array of unmarshalled `JobRecord` items
    - _Requirements: 15.2, 19.2_
  - [x] 16.3 Implement `aggregateStats(items)` in `dashboard-api.js`
    - Count items by `status` field: `Applied` → `totalApplied`, `Interview` → `interviews`, `Pending` → `pending`, `Skipped` or `Error` → `skipped`
    - Return `{ totalApplied, interviews, pending, skipped }`
    - _Requirements: 15.3_
  - [x] 16.4 Implement `buildResponse(statusCode, body)` in `dashboard-api.js`
    - Return an `APIGatewayProxyResult` with `statusCode`, `body: JSON.stringify(body)`, and headers: `Content-Type: application/json`, `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET,OPTIONS`, `Access-Control-Allow-Headers: Content-Type`
    - _Requirements: 15.6, 16.4_
  - [x] 16.5 Wire `queryRecentRecords`, `aggregateStats`, and `buildResponse` into the handler
    - On success: return `buildResponse(200, { items, stats, lastUpdated: new Date().toISOString() })`
    - On DynamoDB failure: return `buildResponse(500, { error: 'Failed to fetch records' })`
    - _Requirements: 15.2, 15.3, 15.4, 15.5, 15.7_

- [x] 17. DynamoDB GSI Terraform resource
  - [x] 17.1 Add `appliedAt-index` GSI to the `aws_dynamodb_table` resource in `main.tf`
    - Add `global_secondary_index` block with `name = "appliedAt-index"`, `hash_key = "appliedAt"`, `projection_type = "ALL"`
    - Add `attribute` blocks for `appliedAt` (type S) and `platform` (type S) to the table definition
    - _Requirements: 19.1, 19.3_

- [x] 18. Terraform SSM parameters for new credentials
  - [x] 18.1 Add Terraform variables for new platform credentials in `main.tf`
    - Add sensitive variables: `internshala_email`, `internshala_password`, `shine_email`, `shine_password`, `wellfound_email`, `wellfound_password`, `glassdoor_email`, `glassdoor_password`
    - _Requirements: 14.2_
  - [x] 18.2 Add `aws_ssm_parameter` resources for all eight new credential paths in `main.tf`
    - Create SecureString parameters for each path: `/jobpilot/internshala/email`, `/jobpilot/internshala/password`, `/jobpilot/shine/email`, `/jobpilot/shine/password`, `/jobpilot/wellfound/email`, `/jobpilot/wellfound/password`, `/jobpilot/glassdoor/email`, `/jobpilot/glassdoor/password`
    - _Requirements: 14.2_

- [x] 19. API Gateway and Dashboard API Lambda Terraform resources
  - [x] 19.1 Add Dashboard API Lambda IAM role and policy in `main.tf`
    - Create `aws_iam_role` named `jobpilot-dashboard-api-role` with Lambda assume-role policy
    - Create `aws_iam_role_policy` granting `dynamodb:Scan` and `dynamodb:Query` on the `jobpilot-applications` table ARN and the GSI ARN (`${table_arn}/index/*`), plus CloudWatch Logs permissions
    - _Requirements: 16.6_
  - [x] 19.2 Add Dashboard API Lambda function resource in `main.tf`
    - Create `aws_lambda_function` named `jobpilot-dashboard-api`, runtime `nodejs20.x`, handler `dashboard-api.handler`, memory 256 MB, timeout 10 s, source from the same S3 bucket as the engine Lambda
    - _Requirements: 15.1, 15.7_
  - [x] 19.3 Add API Gateway REST API resource in `main.tf`
    - Create `aws_api_gateway_rest_api` named `jobpilot-dashboard-api`
    - Create `aws_api_gateway_resource` for path `/jobs`
    - Create `aws_api_gateway_method` for GET on `/jobs` with no authorization
    - Create `aws_api_gateway_integration` of type `AWS_PROXY` pointing to the Dashboard API Lambda
    - _Requirements: 16.1, 16.2_
  - [x] 19.4 Add CORS OPTIONS method to API Gateway in `main.tf`
    - Create `aws_api_gateway_method` for OPTIONS on `/jobs` with no authorization
    - Create `aws_api_gateway_integration` of type `MOCK` returning 200
    - Create `aws_api_gateway_method_response` and `aws_api_gateway_integration_response` with `Access-Control-Allow-Origin: '*'`, `Access-Control-Allow-Methods: 'GET,OPTIONS'`, `Access-Control-Allow-Headers: 'Content-Type'`
    - _Requirements: 16.4_
  - [x] 19.5 Add API Gateway deployment, stage, and Lambda permission in `main.tf`
    - Create `aws_api_gateway_deployment` with `depends_on` on the GET method and integration
    - Create `aws_api_gateway_stage` named `prod`
    - Create `aws_lambda_permission` allowing `apigateway.amazonaws.com` to invoke the Dashboard API Lambda
    - _Requirements: 16.3_
  - [x] 19.6 Add `dashboard_api_url` output to `main.tf`
    - Output the full invoke URL: `"${aws_api_gateway_deployment.dashboard.invoke_url}${aws_api_gateway_stage.prod.stage_name}/jobs"`
    - _Requirements: 16.5_

- [x] 20. Live dashboard — data fetching and polling
  - [x] 20.1 Add `API_URL` constant and fetch logic to `index.html`
    - Define `const API_URL = 'REPLACE_WITH_TERRAFORM_OUTPUT';` at the top of the inline script
    - Implement `async function fetchDashboardData()` that calls `fetch(API_URL)`, checks `response.ok`, parses JSON, and calls `renderDashboard(data)`
    - Show a loading indicator in the jobs table and stats cards while fetching (set stat values to `…` and table body to a single loading row)
    - On fetch error or non-200 status, display an error message in the jobs table area and retain the last successfully loaded data
    - _Requirements: 17.1, 17.2, 17.3, 17.5_
  - [x] 20.2 Implement `renderDashboard(data)` in `index.html`
    - Validate that `data.items` is an array; if not, treat as `[]`
    - Validate each stat count is numeric; if not, display `—` in the affected stat card
    - Update stat cards (`totalApplied`, `interviews`, `pending`, `skipped`) from `data.stats`
    - Rebuild the jobs table body from `data.items`, mapping each `JobRecord` to a `<tr>` row with company/role, platform chip, match bar, salary, and status tag
    - Rebuild the activity log from the 10 most recent `data.items` entries
    - Display `data.lastUpdated` in the topbar cron display area
    - _Requirements: 17.4, 17.7, 20.1, 20.2, 20.3_
  - [x] 20.3 Add 60-second polling interval to `index.html`
    - Call `fetchDashboardData()` on `DOMContentLoaded`
    - Set `setInterval(fetchDashboardData, 60_000)` to re-fetch every 60 seconds
    - _Requirements: 17.6_

- [x] 21. Live dashboard — platform toggles for all nine platforms
  - [x] 21.1 Add toggle rows for the six new platforms to the platforms list in `index.html`
    - Add `<div class="platform-row">` entries for Internshala, Shine, TimesJobs, Wellfound, Glassdoor, and Unstop alongside the existing LinkedIn, Naukri, and Indeed rows
    - _Requirements: 18.1_
  - [x] 21.2 Derive toggle active state from live data in `renderDashboard`
    - After fetching data, for each of the nine platforms check whether `data.items` contains at least one record from that platform with `appliedAt` within the last 24 hours
    - Set the corresponding toggle's `on` class accordingly
    - _Requirements: 18.2_
  - [x] 21.3 Implement platform toggle click handler to filter the jobs table
    - When a toggle is clicked, maintain a `Set` of active platform filters; re-render the jobs table showing only rows whose `platform` is in the active set (or all rows if all toggles are on)
    - _Requirements: 18.3_

- [x] 22. Property-based tests for extended platforms
  - [x] 22.1 Add P1 — Scraped listing field completeness test to `tests/properties.test.js`
    - Generate mock scraper output using `fc.record` with all required fields; assert `id`, `title`, `company`, `location`, `salary`, `url`, and `platform` are all present and `platform` matches the expected scraper identifier
    - `// Feature: jobpilot-extended-platforms, Property 1: Scraped listings contain all required fields`
    - _Requirements: 1.2, 3.2, 5.2, 7.2, 9.2, 11.2_
  - [x] 22.2 Add P2 — Platform enable flag gating test to `tests/properties.test.js`
    - Generate random boolean combinations for all six new platform flags using `fc.record({ INTERNSHALA_ENABLED: fc.boolean(), ... })`; assert only enabled platforms appear in the scrapers array
    - `// Feature: jobpilot-extended-platforms, Property 2: Platform enable flag gates scraper invocation`
    - _Requirements: 13.2_
  - [x] 22.3 Add P3 — `applyToJob` router completeness test to `tests/properties.test.js`
    - Generate any of the 9 platform identifier strings using `fc.constantFrom(...)`; mock all applicator functions to return `true`; assert `applyToJob` does not return `false` due to an unknown platform
    - `// Feature: jobpilot-extended-platforms, Property 3: applyToJob router handles all nine platform identifiers`
    - _Requirements: 13.3_
  - [x] 22.4 Add P4 — Dashboard API response shape test to `tests/properties.test.js`
    - Generate random arrays of `JobRecord` using `fc.array(jobRecordArb, { maxLength: 100 })`; call `aggregateStats` and build a response object; assert the response always has `items` array, `stats` object with all four numeric fields, and `lastUpdated` string
    - `// Feature: jobpilot-extended-platforms, Property 4: Dashboard API response shape is always valid`
    - _Requirements: 15.3_
  - [x] 22.5 Add P5 — Dashboard API response round-trip test to `tests/properties.test.js`
    - Generate random `DashboardResponse` objects; `JSON.stringify` then `JSON.parse`; assert `items` array length, all `stats` counts, and `lastUpdated` are identical
    - `// Feature: jobpilot-extended-platforms, Property 5: Dashboard API response round-trip`
    - _Requirements: 20.4_
  - [x] 22.6 Add P6 — Stats aggregation correctness test to `tests/properties.test.js`
    - Generate `fc.array(fc.record({ status: fc.constantFrom('Applied','Interview','Pending','Skipped','Error') }))`; call `aggregateStats`; assert `totalApplied + interviews + pending + skipped` equals the input array length
    - `// Feature: jobpilot-extended-platforms, Property 6: Stats aggregation correctness`
    - _Requirements: 15.3_
  - [x] 22.7 Add P7 — Dashboard parser defensive defaults test to `tests/properties.test.js`
    - Generate random objects with `fc.option(fc.anything())` for `items` and `stats` fields; run the dashboard parser; assert `items` defaults to `[]` when missing/non-array and invalid stat counts produce `'—'` display values
    - `// Feature: jobpilot-extended-platforms, Property 7: Dashboard response parser defensive defaults`
    - _Requirements: 20.2, 20.3_
  - [x] 22.8 Add P8 — SSM failure isolation test to `tests/properties.test.js`
    - Mock `getParam` to throw for one randomly selected new platform credential path; run the engine scraper wiring logic; assert the remaining platforms are still included in the scrapers array
    - `// Feature: jobpilot-extended-platforms, Property 8: SSM failure isolation for new platforms`
    - _Requirements: 14.3_

- [x] 23. Final checkpoint — all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All property tests use `fast-check` with `numRuns: 100` minimum
- `dashboard-api.js` is a separate file from `handler.js`; both are included in `lambda.zip` for deployment
- The `API_URL` constant in `index.html` must be updated with the Terraform output `dashboard_api_url` after `terraform apply`
- TimesJobs and Unstop require no SSM credentials — their scrapers take only `browser` as a parameter
- The DynamoDB GSI `appliedAt-index` requires adding `appliedAt` and `platform` as table attributes in Terraform (they are already written to items by the engine but must be declared as attributes for GSI use)
- Glassdoor's sign-in overlay dismissal is best-effort; if dismissal fails, the scraper returns `[]` rather than hanging
