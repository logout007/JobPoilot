# Implementation Plan: JobPilot Engine

## Overview

Implement the full JobPilot automated job application pipeline as a single AWS Lambda function (Node.js 20). Tasks build incrementally from project scaffolding through scrapers, scorer, applicators, persistence, notification, infrastructure, and dashboard — ending with property-based tests and a build script that packages everything for deployment.

## Tasks

- [x] 1. Project scaffolding and dependency setup
  - Create `package.json` with `type: "module"`, scripts (`build`, `test`), and all required dependencies: `@sparticuz/chromium`, `puppeteer-core`, `@google/genai`, `@aws-sdk/client-dynamodb`, `@aws-sdk/client-ssm`, `@aws-sdk/client-ses`
  - Add dev dependencies: `fast-check`, `vitest`
  - Create `.gitignore` ignoring `node_modules/`, `lambda.zip`, `*.tfvars`, `cv.txt`
  - _Requirements: 15.1_

- [ ] 2. SSM loader utility
  - [x] 2.1 Implement `getParam(name)` in `handler.js`
    - Fetch a single SSM `SecureString` parameter using `GetParameterCommand` with `WithDecryption: true`
    - Return `''` on any error and log the parameter name + error message; never throw
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 3. Stealth and browser utilities
  - [x] 3.1 Implement `stealthPage(page)` in `handler.js`
    - Set realistic Chrome user-agent and `Accept-Language: en-IN` header
    - Enable request interception; abort `image`, `font`, `media` resource types; continue all others
    - _Requirements: 14.1, 14.2_

  - [x] 3.2 Write property test for `stealthPage` request blocking
    - **Property 9: Stealth page blocks image/font/media requests**
    - **Validates: Requirements 14.2, 3.6**

  - [x] 3.3 Implement `humanType(page, selector, text)` in `handler.js`
    - Wait for selector, click it, then type each character with `delay: 60 + Math.random() * 50` ms
    - _Requirements: 14.3_

  - [x] 3.4 Write property test for `humanType` delay range
    - **Property 10: Human typing delay is within the specified range**
    - **Validates: Requirements 14.3**

  - [x] 3.5 Implement `autoScroll(page, times)` in `handler.js`
    - Scroll `window.innerHeight * 2` per iteration with a 1200 ms pause between scrolls
    - _Requirements: 14.4_

- [ ] 4. LinkedIn scraper
  - [x] 4.1 Implement `scrapeLinkedIn(browser, email, pass)` in `handler.js`
    - Authenticate to LinkedIn using SSM credentials; navigate to job search URL with keywords `Node.js TypeScript Full Stack MERN`, location `India`, Easy Apply flag, and `r86400` date filter
    - Block image/font/media via `stealthPage`; auto-scroll 3 times; extract up to 25 listings with fields: `id`, `title`, `company`, `location`, `salary`, `url`, `platform: 'LinkedIn'`, `easyApply: true`
    - Return `[]` on auth failure or 30 s page-load timeout; log the error
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 5. Naukri scraper
  - [x] 5.1 Implement `scrapeNaukri(browser, email, pass)` in `handler.js`
    - Authenticate to Naukri.com; navigate to search URL with keyword `nodejs`, experience 3–7 yr, job age 3 days, India + remote/hybrid
    - Extract up to 20 listings with fields: `id` (prefixed `nk-`), `title`, `company`, `location`, `salary`, `url`, `platform: 'Naukri'`
    - Return `[]` on auth failure or 30 s timeout; log the error
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 6. Indeed scraper
  - [x] 6.1 Implement `scrapeIndeed(browser)` in `handler.js`
    - Navigate to `in.indeed.com` with query `nodejs typescript mern full stack developer`, location `India`, `fromage=3`; no authentication required
    - Dismiss cookie consent prompt if present (`#onetrust-accept-btn-handler`)
    - Extract up to 20 listings with fields: `id` (prefixed `in-` + `data-jk`), `title`, `company`, `location`, `salary`, `url`, `platform: 'Indeed'`
    - Return `[]` on 30 s timeout; log the error
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 7. Cross-platform deduplicator
  - [x] 7.1 Implement `deduplicateJobs(jobs)` in `handler.js`
    - Normalise composite key as `company.toLowerCase().trim() + '::' + title.toLowerCase().trim()`
    - Retain first occurrence; discard subsequent duplicates using a `Set`
    - _Requirements: 6.1, 6.2_

  - [x] 7.2 Write property test for deduplication
    - **Property 1: Deduplication eliminates all duplicate company+title pairs**
    - **Validates: Requirements 6.1, 6.2**

- [ ] 8. Gemma 4 scorer and response parser
  - [x] 8.1 Implement `parseScoreResponse(rawText)` in `handler.js`
    - Strip markdown code fences (`` ```json `` / ` ``` `), parse JSON
    - Apply defaults: `score → 60` if absent/non-numeric, `reason → 'No reason provided'` if absent, `redFlags → 'none'` if absent
    - Return `{ score, reason, redFlags }` — never throw
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 8.2 Write property test for score response round-trip
    - **Property 3: Score response round-trip**
    - **Validates: Requirements 17.1, 17.5**

  - [x] 8.3 Write property test for missing field defaults
    - **Property 4: Missing score fields receive correct defaults**
    - **Validates: Requirements 17.2, 17.3, 17.4**

  - [x] 8.4 Implement `scoreWithGemma4(job, cvText)` in `handler.js`
    - Build structured prompt including `PROFILE` fields and first 1,200 chars of CV text
    - Call `gemma-4-27b-it` with `temperature: 0.1`, `maxOutputTokens: 120`; parse response via `parseScoreResponse`
    - On any failure return `{ score: 60, reason: 'Scoring unavailable — defaulting to 60%', redFlags: 'none' }`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 9. Checkpoint — core utilities complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. LinkedIn applicator
  - [x] 10.1 Implement `applyLinkedIn(browser, job)` in `handler.js`
    - Navigate to job URL; click Easy Apply button; iterate up to 6 steps clicking "Continue to next step" / "Review your application"
    - Fill phone field from SSM (`/jobpilot/candidate/phone`) if empty; click "Submit application" when found; return `true`
    - Return `false` (no throw) if Easy Apply button not found or any unrecoverable error; log skip/error reason
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 11. Naukri applicator
  - [x] 11.1 Implement `applyNaukri(browser, job)` in `handler.js`
    - Navigate to job URL; click primary apply button; click confirm modal button if present; return `true`
    - Return `false` (no throw) if apply button not found or any unrecoverable error; log skip/error reason
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 12. Indeed applicator and `applyToJob` router
  - [x] 12.1 Implement `applyIndeed(browser, job)` in `handler.js`
    - Navigate to job URL; click Indeed Apply button; locate Smart Apply iframe; iterate up to 5 steps; click submit when button text contains "submit"; return `true`
    - Return `false` (no throw) if apply button or iframe not found; log skip/error reason
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 12.2 Implement `applyToJob(browser, job)` router in `handler.js`
    - Switch on `job.platform` and delegate to `applyLinkedIn`, `applyNaukri`, or `applyIndeed`; return `false` for unknown platforms
    - _Requirements: 8.1, 9.1, 10.1_

- [ ] 13. DynamoDB persistence
  - [x] 13.1 Implement `saveJobRecord(job)` in `handler.js`
    - Write all 12 required fields (`jobId`, `title`, `company`, `platform`, `location`, `salary`, `url`, `score`, `reason`, `status`, `appliedAt`, `expiresAt`) using `PutItemCommand`
    - Set `expiresAt` to `Math.floor(Date.now() / 1000) + 7_776_000` (90 days)
    - Use `ConditionExpression: 'attribute_not_exists(jobId)'`; swallow `ConditionalCheckFailedException`; rethrow all other errors after logging
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 13.2 Write property test for DynamoDB idempotency
    - **Property 6: DynamoDB writes are idempotent**
    - **Validates: Requirements 12.4**

  - [x] 13.3 Write property test for job record completeness
    - **Property 7: Job records contain all required fields**
    - **Validates: Requirements 12.1, 12.2**

  - [x] 13.4 Write property test for TTL correctness
    - **Property 8: TTL is always 90 days in the future**
    - **Validates: Requirements 12.3**

  - [x] 13.5 Implement `checkAlreadyApplied(jobId)` in `handler.js`
    - Query DynamoDB with `KeyConditionExpression: 'jobId = :id'`, `Limit: 1`; return `true` if `Count > 0`; return `false` on any error
    - _Requirements: 6.3_

  - [x] 13.6 Write property test for already-applied exclusion
    - **Property 2: Already-applied jobs are excluded from scoring and application**
    - **Validates: Requirements 6.3**

- [ ] 14. SES digest notifier
  - [x] 14.1 Implement `sendDigestEmail(to, results)` in `handler.js`
    - Format plain-text digest with: run date, applied list (platform/company/title/score), skipped list (up to 5 + overflow count), error count and descriptions, next run time "Tomorrow 09:00 IST"
    - Send via `SendEmailCommand`; catch and log SES errors without rethrowing
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 15. Main handler orchestration
  - [x] 15.1 Wire the full pipeline in `export const handler` in `handler.js`
    - Fetch all 7 SSM params in parallel via `Promise.all`; init `geminiClient`; launch Chromium with `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage` flags and 1024 MB ephemeral storage
    - Run enabled scrapers via `Promise.allSettled`; merge results; call `deduplicateJobs`
    - Iterate deduplicated jobs sequentially: call `checkAlreadyApplied`, `scoreWithGemma4`, `applyToJob` (if score ≥ `MATCH_THRESHOLD`), `saveJobRecord`; enforce `MAX_APPLY_PER_RUN` cap and `APPLY_DELAY_MS` pause
    - Close browser in `finally` block; call `sendDigestEmail`; return `{ statusCode: 200, body: JSON.stringify(...) }`
    - _Requirements: 1.1, 1.2, 1.4, 2.6, 7.7, 11.1, 11.2, 11.3, 14.5, 14.6_

  - [x] 15.2 Write property test for application count cap
    - **Property 5: Application count never exceeds MAX_APPLY_PER_RUN**
    - **Validates: Requirements 11.1, 11.3**

- [x] 16. Checkpoint — full pipeline wired
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Terraform infrastructure
  - [x] 17.1 Complete `main.tf` with all required resources
    - Lambda function: `nodejs20.x`, 1024 MB memory, 300 s timeout, 1024 MB ephemeral storage, handler `handler.handler`, source `lambda.zip`
    - IAM role + policy: DynamoDB (`PutItem`, `GetItem`, `Query`, `UpdateItem`), SSM (`GetParameter`, `GetParameters`), SES (`SendEmail`, `SendRawEmail`), CloudWatch Logs
    - EventBridge Scheduler: `cron(30 3 * * ? *)`, `flexible_time_window { mode = "OFF" }`, IAM role with `lambda:InvokeFunction`
    - DynamoDB table: `PAY_PER_REQUEST`, hash key `jobId` (S), TTL attribute `expiresAt`
    - SSM parameters for all 8 paths (all `SecureString` except `notify/email`); accept sensitive variables — no hardcoded credentials
    - S3 bucket: static website hosting, `index.html` index document, public access enabled
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [ ] 18. Dashboard UI
  - [x] 18.1 Complete `index.html` as a self-contained single-file dashboard
    - Stat cards: Total Applied, Interviews, Pending Review, Skipped
    - Job applications table: Company/Role, Platform, Match score (bar + %), Salary, Status chip
    - Lambda activity log panel with timestamped entries
    - Cron schedule display (`cron(30 3 * * ? *)`) and next run time in topbar
    - Platform toggles (LinkedIn, Naukri, Indeed) that update `CONFIG` flags
    - Match threshold slider (50–95) that updates `MATCH_THRESHOLD`
    - No server-side dependencies; all data seeded inline or fetched from DynamoDB via pre-signed URL
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_

- [ ] 19. Property-based tests
  - [x] 19.1 Create `tests/properties.test.js` and configure Vitest
    - Import `fast-check`; set `numRuns: 100` for all properties
    - Add `// Feature: jobpilot-engine, Property N: <property_text>` comment above each test
    - _Requirements: all (see individual property sub-tasks below)_

  - [x] 19.2 P1 — Deduplication property test
    - Generate `fc.array(fc.record({ company: fc.string(), title: fc.string(), id: fc.string(), platform: fc.constantFrom('LinkedIn','Naukri','Indeed'), location: fc.string(), salary: fc.string(), url: fc.string(), easyApply: fc.boolean() }))` with injected duplicates; assert no two results share the same `company::title` key
    - **Property 1: Deduplication eliminates all duplicate company+title pairs**
    - **Validates: Requirements 6.1, 6.2**

  - [x] 19.3 P2 — Already-applied exclusion property test
    - Pre-seed a mock `checkAlreadyApplied` returning `true` for a generated `jobId`; run the scoring loop; assert the job does not appear in applied or scored output
    - **Property 2: Already-applied jobs are excluded from scoring and application**
    - **Validates: Requirements 6.3**

  - [x] 19.4 P3 — Score round-trip property test
    - Generate `fc.record({ score: fc.integer(0,100), reason: fc.string(), redFlags: fc.string() })`; serialise to JSON; parse with `parseScoreResponse`; re-serialise; re-parse; assert equivalence
    - **Property 3: Score response round-trip**
    - **Validates: Requirements 17.1, 17.5**

  - [x] 19.5 P4 — Missing field defaults property test
    - Generate partial objects with any subset of `score`, `reason`, `redFlags` missing using `fc.record` with optional fields; assert all three fields always present with correct types after `parseScoreResponse`
    - **Property 4: Missing score fields receive correct defaults**
    - **Validates: Requirements 17.2, 17.3, 17.4**

  - [x] 19.6 P5 — Apply count cap property test
    - Generate `fc.array(jobListingArb, { minLength: 11, maxLength: 50 })` of qualifying jobs; run the apply loop with a mock applicator; assert `applied.length <= MAX_APPLY_PER_RUN`
    - **Property 5: Application count never exceeds MAX_APPLY_PER_RUN**
    - **Validates: Requirements 11.1, 11.3**

  - [x] 19.7 P6 — DynamoDB idempotency property test
    - Generate a `JobRecord` via `fc.record(jobRecordArb)`; call `saveJobRecord` twice with the same record against DynamoDB Local; assert table contains exactly one item with that `jobId`
    - **Property 6: DynamoDB writes are idempotent**
    - **Validates: Requirements 12.4**

  - [x] 19.8 P7 — Record completeness property test
    - Generate `fc.tuple(jobListingArb, scoreResultArb)`; call `saveJobRecord`; read back the item; assert all 12 required fields (`jobId`, `title`, `company`, `platform`, `location`, `salary`, `url`, `score`, `reason`, `status`, `appliedAt`, `expiresAt`) are present
    - **Property 7: Job records contain all required fields**
    - **Validates: Requirements 12.1, 12.2**

  - [x] 19.9 P8 — TTL correctness property test
    - Generate `fc.integer({ min: 0, max: 2_000_000_000 })` as a mock write timestamp; assert `expiresAt === timestamp + 7_776_000`
    - **Property 8: TTL is always 90 days in the future**
    - **Validates: Requirements 12.3**

  - [x] 19.10 P9 — Stealth request blocking property test
    - Generate `fc.constantFrom('image','font','media','script','xhr','fetch','document')`; mock Puppeteer request object; assert `image`, `font`, `media` call `abort()` and all others call `continue()`
    - **Property 9: Stealth page blocks image/font/media requests**
    - **Validates: Requirements 14.2, 3.6**

  - [x] 19.11 P10 — Typing delay range property test
    - Instrument `humanType` to record per-character delays; generate `fc.string({ minLength: 1, maxLength: 50 })`; assert every recorded delay is in `[60, 110]` ms
    - **Property 10: Human typing delay is within the specified range**
    - **Validates: Requirements 14.3**

- [ ] 20. Build script
  - [x] 20.1 Add `npm run build` script to `package.json`
    - Script should: run `npm ci --omit=dev`, then zip `handler.js` and `node_modules/` into `lambda.zip` at the workspace root
    - Ensure the zip is compatible with the Lambda `nodejs20.x` runtime (ES module handler)
    - _Requirements: 15.1, 15.2_

- [x] 21. Final checkpoint — all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with `numRuns: 100` minimum
- DynamoDB Local (`dynamodb-local` Docker image) is recommended for P6 and P7 integration tests
- The build script produces `lambda.zip` consumed by `main.tf` (`filename = "lambda.zip"`)
