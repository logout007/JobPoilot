# JobPilot Architecture & History

This document consolidates historical architecture notes, platform status reports, and improvement logs from the V1→V2 development cycle. For the current V3 structure, see the project README.

---

## Table of Contents

1. [V2 Architecture Overview](#v2-architecture-overview)
2. [New Architecture Design](#new-architecture-design)
3. [Infrastructure Updates](#infrastructure-updates)
4. [Final Summary (V1→V2 Migration)](#final-summary)
5. [Fixes Applied](#fixes-applied)
6. [Platform Status](#platform-status)
7. [Scraper Fixes Needed](#scraper-fixes-needed)
8. [Scraper Improvements](#scraper-improvements)
9. [API & Authentication Strategy](#api--authentication-strategy)

---

## V2 Architecture Overview

JobPilot V2 follows a "Find & Recommend" philosophy — AI evaluates and recommends, the user decides and acts.

### Architecture Diagram

```
EventBridge (Daily 09:00 IST)
  │
  ▼
Lambda: Job Scanner
  • Scan LinkedIn, Naukri, Uplers, Turing, etc.
  • Extract: Title, Company, Salary, Location, URL
  • Take screenshot of job posting
  • Store raw data in DynamoDB
  │
  ▼
Lambda: Job Evaluator (Gemini AI)
  • 10-dimension scoring (0–5 scale)
  • A–F grading (A=4.5+, B=4.0+, C=3.5+, D=3.0+, F<3)
  • Evaluation reports in markdown
  │
  ▼
DynamoDB: jobpilot-applications
  • Job records with TTL (90 days)
  • GSIs: appliedAt-index, status-foundAt-index
  │
  ▼
S3: Assets (screenshots, reports)
  │
  ▼
Dashboard (HTML + Tailwind)
  • Filter by grade/status, sort by score/date/platform
  • View screenshots + evaluation reports
  • Actions: Apply, Reject, Archive
```

### 10-Dimension Evaluation System

| # | Dimension | Weight |
|---|-----------|--------|
| 1 | Skills Match | 20% |
| 2 | Experience Level | 15% |
| 3 | Salary Range | 15% |
| 4 | Location/Remote | 10% |
| 5 | Company Culture Fit | 10% |
| 6 | Growth Potential | 10% |
| 7 | Tech Stack Match | 10% |
| 8 | Role Clarity | 5% |
| 9 | Team Size | 3% |
| 10 | Work-Life Balance | 2% |

---

## New Architecture Design

The V2 system replaced auto-apply with a "Find & Recommend" model:

- Scrape jobs from multiple platforms
- Score with Gemini AI
- Take screenshots of each job
- Store in DynamoDB with full details
- Display in dashboard for manual review and application

Key benefits: full control, visual verification, detailed evaluation, no bot detection issues with manual apply.

---

## Infrastructure Updates

### Lambda Functions

Three specialized Lambdas replaced the single monolithic function:

1. **jobpilot-scanner** — 2048 MB, 15 min timeout, scrapes 12 platforms
2. **jobpilot-evaluator** — 1024 MB, 10 min timeout, Gemini AI evaluation
3. **jobpilot-api** — 512 MB, 30s timeout, REST API for dashboard

### DynamoDB

- Table: `jobpilot-applications` (PAY_PER_REQUEST)
- GSIs: `appliedAt-index`, `status-foundAt-index`
- TTL on `expiresAt` (90 days)

### S3

- Static website hosting for dashboard
- Lifecycle policies: delete screenshots/reports after 90 days
- Deployment packages stored as zip files

### API Gateway

- Endpoints: GET /jobs, GET /jobs/{jobId}, PUT /jobs/{jobId}/status
- CORS configured for all endpoints
- Rate limiting: 100 req/min, 200 burst

### EventBridge

- Scanner: daily at 09:00 IST (03:30 UTC)
- Evaluator: daily at 09:05 IST (03:35 UTC)

### IAM

- Separate least-privilege roles per Lambda
- SSM SecureString for all credentials

---

## Final Summary

### Critical Fixes Applied (V1→V2)

1. Gemini API model updated to `gemini-2.5-flash`
2. Default score increased from 60% to 70%
3. Package.json included in Lambda zip for ES modules
4. Debug logging added to all scrapers
5. Naukri authentication flow added

### Cost

Monthly cost: ~$0 (AWS free tier) + ~$0.50 Gemini API.

---

## Fixes Applied

- Wrong Gemini model → fixed to `gemini-2.5-flash`
- Default score too low (60%) → raised to 70%
- Missing package.json in Lambda zip → added to build script
- Scrapers finding 0 jobs → debug logging added for diagnosis

---

## Platform Status

| Platform | Status | Notes |
|----------|--------|-------|
| LinkedIn | Working | Limited results (1 job) |
| Shine | Fixable | 360 cards found, selector mismatch |
| Internshala | Fixable | 349 cards found, selector mismatch |
| Indeed | Blocked | Cloudflare bot detection |
| Naukri | Blocked | Bot detection / empty page |
| Wellfound | Blocked | Bot detection / requires login |
| TimesJobs | Wrong URL | Redirects to homepage |
| Unstop | Selector issue | Page loads, 0 cards matched |

---

## Scraper Fixes Needed

Priority fixes identified:
1. Broaden LinkedIn search terms
2. Add Easy Apply filter to LinkedIn
3. Debug Naukri page loading
4. Add debug logging to all scrapers
5. Update CSS selectors for all platforms

---

## Scraper Improvements

Enhancements applied to all scrapers:
- Debug logging (page title, card count, body snippet)
- Multiple fallback CSS selectors
- Increased wait times (3000–3500 ms)
- Better error handling with try-catch

---

## API & Authentication Strategy

No job board offers a public API for job seekers. Authentication flows implemented for:
- Naukri (login before scraping)
- Shine (login before scraping)
- Internshala (login before scraping)

Credentials stored in AWS SSM Parameter Store as SecureString.
