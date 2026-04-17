# 🚀 JobPilot — Automated Job Application Engine

> AWS Lambda + EventBridge + **Gemini AI** · **$0.00/month total**

Runs every morning at **09:00 IST**, scrapes **12 job platforms** for matching roles, evaluates them with **Gemini AI** against your CV, generates tailored CV snippets, and tracks your entire application pipeline through a real-time dashboard.

---

## 📐 Architecture (V3)

```
EventBridge (cron 09:00 IST)
    │
    ├─→ Lambda: jobpilot-scanner
    │     • Scrapes 12 platforms with retry + fallback selectors
    │     • Captures screenshots, extracts descriptions
    │     • Writes Job_Records (status=New) to DynamoDB
    │
    ├─→ Lambda: jobpilot-evaluator (5 min after scanner)
    │     • Evaluates jobs with Gemini AI (10-dimension rubric)
    │     • Generates CV tailoring packages (snippet + cover opening)
    │     • Sends A-grade email notifications
    │     • Processes due follow-up reminders via SES
    │
    └─→ Lambda: jobpilot-api
          • REST API for dashboard (API Gateway)
          • Job management: list, detail, status, notes, reminders
          • Analytics: grade trends, platform metrics, funnel
    
    S3 Static Site → Dashboard with Jobs + Analytics tabs
```

## 💰 Cost Breakdown — $0.00/month

| Service               | Usage                    | Monthly Cost |
|-----------------------|--------------------------|--------------|
| EventBridge Scheduler | 2 triggers/day           | **$0.00**    |
| AWS Lambda (3 functions) | ~500 GB-sec/day       | **$0.00**    |
| DynamoDB on-demand    | <1 MB writes/day         | **$0.00**    |
| SES email             | ~5 emails/day            | **$0.00**    |
| S3 (dashboard + assets) | <50 MB                 | **$0.00**    |
| SSM Parameter Store   | 20+ params               | **$0.00**    |
| API Gateway           | <1000 req/day            | **$0.00**    |
| **Gemini AI (free tier)** | ~40 calls/day        | **$0.00**    |
| **TOTAL**             |                          | **$0.00**    |

---

## ✨ V3 Features

### CV Auto-Tailoring
- Generates a **CV snippet** (150–200 words) and **cover letter opening** tailored to each job
- Uses Gemini AI with your CV + job description + top matched skills
- Stored as markdown in S3, viewable from the dashboard with one-click copy

### Application Tracking
- **Notes**: Add timestamped notes to any job via the dashboard
- **Reminders**: Set follow-up reminder dates; automated SES emails on due date
- **Status management**: Track jobs through New → Reviewed → Applied → Rejected/Archived

### Analytics Dashboard
- **Grade Trends**: Line chart showing grade distribution (A–F) over the last 30 days
- **Platform Performance**: Table with total jobs, avg score, A-grade count, and conversion rate per platform
- **Application Funnel**: Visual funnel from Found → Reviewed → Applied with conversion percentages

### Scraper Hardening
- **Retry with exponential back-off**: Each scraper wrapped with `withRetry` (3 attempts, 2s → 4s → 8s)
- **Fallback selectors**: Primary + fallback CSS selectors per platform for resilience against DOM changes
- **Job validation**: Filters out incomplete listings (missing title or URL)

### Improved AI Evaluation
- **10-dimension scoring rubric** with explicit 0–5 scale definitions
- **Few-shot examples** for consistent JSON output
- **Schema validation** with one correction retry on invalid responses
- **Top skills extraction** for tailoring integration

---

## 📁 Project Structure

```
jobpilot/
├── src/
│   ├── scanner/                  # Platform scraping Lambda
│   │   ├── index.js              # Handler entry point + pipeline
│   │   ├── screenshot.js         # Screenshot capture + S3 upload
│   │   ├── extractor.js          # Job description extraction
│   │   ├── stealth.js            # Anti-detection utilities
│   │   └── scrapers/             # One file per platform (12 total)
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
│   ├── evaluator/                # AI evaluation Lambda
│   │   ├── index.js              # Handler entry point
│   │   ├── evaluator.js          # Gemini AI evaluation + prompt
│   │   ├── grader.js             # Grade calculation (A–F)
│   │   ├── reporter.js           # Markdown report generation
│   │   ├── tailoring.js          # CV snippet + cover opening
│   │   └── reminders.js          # Due reminder queries + SES
│   ├── api/                      # REST API Lambda
│   │   ├── index.js              # Handler + URL router
│   │   └── routes/
│   │       ├── jobs.js           # /jobs CRUD + notes + reminders
│   │       └── analytics.js      # /analytics endpoints
│   └── shared/                   # Shared utilities
│       ├── dynamo.js             # DynamoDB client + helpers
│       ├── s3.js                 # S3 upload helpers
│       ├── ssm.js                # SSM parameter fetching
│       ├── ses.js                # SES email helper
│       ├── retry.js              # withRetry (exponential back-off)
│       ├── scoring.js            # Score response parsing
│       ├── selectors.js          # Fallback selector extraction
│       └── analytics.js          # Stats aggregation
├── infra/                        # Terraform infrastructure
│   ├── main.tf                   # All AWS resources
│   ├── variables.tf              # Input variables
│   ├── outputs.tf                # Output values
│   └── terraform.tfvars          # Secrets (gitignored)
├── tests/                        # Test suite (230 tests)
│   ├── properties.test.js        # Property-based tests (P1–P14)
│   ├── scanner/                  # Scanner tests
│   ├── evaluator/                # Evaluator tests
│   ├── api/                      # API endpoint tests
│   └── shared/                   # Shared utility tests
├── public/
│   └── dashboard.html            # Single-page dashboard
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── TESTING_GUIDE.md
│   └── QUICK_REFERENCE.md
├── package.json
├── vitest.config.js
└── README.md
```

---

## 🛠 Setup

### Prerequisites
- AWS account (free tier) + AWS CLI configured
- Terraform installed
- Node.js 20+
- Google AI Studio API key (free) → [aistudio.google.com](https://aistudio.google.com/app/apikey)

### Deploy

```bash
npm install
npm run build

cd infra
terraform init
terraform apply \
  -var="gemini_api_key=YOUR_KEY" \
  -var="linkedin_email=you@email.com" \
  -var="linkedin_password=yourpassword" \
  -var="naukri_email=you@email.com" \
  -var="naukri_password=yourpassword" \
  -var="notify_email=you@email.com" \
  -var="cv_text=$(cat ../cv.txt)" \
  -var="candidate_phone=+91XXXXXXXXXX"
```

### Verify

```bash
# Check SES sender
aws ses verify-email-identity --email-address you@email.com --region ap-south-1

# Test scanner
aws lambda invoke --function-name jobpilot-scanner --region ap-south-1 --payload '{}' output.json

# View dashboard
terraform output dashboard_url
```

---

## 🧪 Testing

```bash
npm test          # Run all 230 tests (unit + property-based)
```

The test suite includes:
- **Unit tests** for all modules (scanner, evaluator, API, shared utilities)
- **Property-based tests** (P1–P14) using fast-check covering deduplication, scoring, retry logic, analytics computation, and more

---

## 📊 API Endpoints

| Method | Path                        | Description                    |
|--------|-----------------------------|--------------------------------|
| GET    | /jobs                       | List all jobs (with filters)   |
| GET    | /jobs/{jobId}               | Get job details                |
| PUT    | /jobs/{jobId}/status        | Update job status              |
| POST   | /jobs/{jobId}/notes         | Add a note to a job            |
| PUT    | /jobs/{jobId}/reminder      | Set/update reminder date       |
| GET    | /analytics/grades           | Grade trends (last 30 days)    |
| GET    | /analytics/platforms        | Per-platform metrics           |
| GET    | /analytics/funnel           | Application funnel stats       |

---

## ⚠️ Notes

1. **Platform ToS** — Auto-applying may violate platform terms. Keep daily limits low and use dedicated accounts.
2. **2FA** — Disable 2FA on automation accounts, or use app-specific passwords where supported.
3. **Gemini free tier** — 15 RPM / 1000 RPD. Sufficient for ~20 evaluations + tailoring per day.
4. **Data retention** — Screenshots, reports, and tailoring files auto-delete after 90 days via S3 lifecycle rules. DynamoDB records expire via TTL.

---

## 🏗 Supported Platforms

LinkedIn · Naukri · Indeed · Internshala · Shine · Wellfound · TimesJobs · Unstop · Uplers · Turing · RemoteCo · WeWorkRemotely
# JobPoilot
