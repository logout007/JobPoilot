# Requirements Document

## Introduction

JobPilot V2 is a transformation of the existing auto-apply system into a "Find & Recommend" platform inspired by Career-Ops. The system scrapes 12 job platforms daily, captures screenshots of job postings, evaluates each job using AI across 10 dimensions, assigns A-F letter grades, generates detailed evaluation reports with interview prep, and presents everything in a web dashboard where users manually review and apply. This approach bypasses bot detection issues, provides full user control, and focuses on quality over quantity.

---

## Glossary

- **System**: The complete JobPilot V2 application including scrapers, evaluator, storage, and dashboard.
- **Job_Scanner**: The AWS Lambda function that scrapes job platforms and captures screenshots.
- **Job_Evaluator**: The AWS Lambda function that scores jobs using Gemini AI and generates evaluation reports.
- **Gemini_AI**: Google's Gemini AI model accessed via Google AI Studio for job evaluation.
- **Screenshot**: A PNG image capture of a job posting page stored in S3.
- **Evaluation_Report**: A markdown document containing detailed job analysis, dimension scores, interview prep, and application strategy.
- **Dimension**: One of 10 scoring criteria (Skills Match, Experience Level, Salary Range, Location/Remote, Company Culture Fit, Growth Potential, Tech Stack Match, Role Clarity, Team Size, Work-Life Balance).
- **Grade**: A letter grade (A, B, C, D, F) derived from the weighted average of dimension scores.
- **Job_Record**: A DynamoDB item representing a scraped job with evaluation data, screenshot URL, and status.
- **Dashboard**: The web UI hosted on S3 for viewing, filtering, and managing job recommendations.
- **Platform**: One of the 12 supported job boards (LinkedIn, Naukri, Indeed, Shine, Internshala, Wellfound, TimesJobs, Unstop, Uplers, Turing, Remote.co, We Work Remotely).
- **User_Profile**: The candidate's CV and preferences stored in SSM Parameter Store.
- **Status**: The current state of a job (New, Reviewed, Applied, Rejected, Archived).
- **STAR_Story**: A Situation-Task-Action-Result interview preparation story generated for each job.

---

## Requirements

### Requirement 1: Daily Multi-Platform Job Scraping

**User Story:** As a job seeker, I want the system to scrape 12 job platforms daily, so that I have comprehensive coverage of available opportunities.

#### Acceptance Criteria

1. THE Job_Scanner SHALL scrape all 12 platforms (LinkedIn, Naukri, Indeed, Shine, Internshala, Wellfound, TimesJobs, Unstop, Uplers, Turing, Remote.co, We Work Remotely) once daily at 09:00 IST.
2. WHEN the Job_Scanner runs, THE Job_Scanner SHALL execute all platform scrapers in parallel using Promise.allSettled.
3. THE Job_Scanner SHALL extract job title, company name, location, salary, job URL, platform identifier, and posted date from each listing.
4. THE Job_Scanner SHALL assign a unique job ID to each listing using the format `{platform-prefix}-{unique-identifier}`.
5. IF a platform scraper fails, THEN THE Job_Scanner SHALL log the error and continue processing remaining platforms without aborting the run.

---

### Requirement 2: Job Posting Screenshot Capture

**User Story:** As a job seeker, I want screenshots of every job posting, so that I have visual verification and can see the full posting even if it's removed from the platform.

#### Acceptance Criteria

1. WHEN a job listing is scraped, THE Job_Scanner SHALL navigate to the job URL and capture a full-page screenshot.
2. THE Job_Scanner SHALL save each screenshot as a PNG file to S3 with the path format `/screenshots/{YYYY-MM-DD}/{jobId}.png`.
3. THE Job_Scanner SHALL store the S3 screenshot URL in the Job_Record.
4. IF screenshot capture fails for a job, THEN THE Job_Scanner SHALL log the error and store an empty screenshot URL without failing the entire job processing.
5. THE Job_Scanner SHALL use Puppeteer viewport dimensions of 1280x800 pixels for consistent screenshot sizing.

---

### Requirement 3: 10-Dimension AI Evaluation System

**User Story:** As a job seeker, I want each job evaluated across 10 specific dimensions, so that I understand exactly why a job is or isn't a good match.

#### Acceptance Criteria

1. WHEN a job is ready for evaluation, THE Job_Evaluator SHALL score the job on all 10 dimensions using Gemini AI.
2. THE Job_Evaluator SHALL score Skills Match (20% weight) on a 0-5 scale based on how well the candidate's skills match job requirements.
3. THE Job_Evaluator SHALL score Experience Level (15% weight) on a 0-5 scale based on years of experience fit.
4. THE Job_Evaluator SHALL score Salary Range (15% weight) on a 0-5 scale based on whether the salary meets the candidate's minimum requirement.
5. THE Job_Evaluator SHALL score Location/Remote (10% weight) on a 0-5 scale based on remote/hybrid/onsite preference match.
6. THE Job_Evaluator SHALL score Company Culture Fit (10% weight) on a 0-5 scale based on company description analysis.
7. THE Job_Evaluator SHALL score Growth Potential (10% weight) on a 0-5 scale based on career advancement opportunities.
8. THE Job_Evaluator SHALL score Tech Stack Match (10% weight) on a 0-5 scale based on desired technologies.
9. THE Job_Evaluator SHALL score Role Clarity (5% weight) on a 0-5 scale based on how well-defined the role is.
10. THE Job_Evaluator SHALL score Team Size (3% weight) on a 0-5 scale based on team size preference.
11. THE Job_Evaluator SHALL score Work-Life Balance (2% weight) on a 0-5 scale based on job description indicators.

---

### Requirement 4: A-F Letter Grade Assignment

**User Story:** As a job seeker, I want jobs assigned letter grades, so that I can quickly filter and focus on high-quality opportunities.

#### Acceptance Criteria

1. WHEN all dimension scores are calculated, THE Job_Evaluator SHALL compute a weighted total score using the formula: Total = Σ(dimension_score × weight).
2. THE Job_Evaluator SHALL assign grade A WHEN the total score is between 4.5 and 5.0 inclusive.
3. THE Job_Evaluator SHALL assign grade B WHEN the total score is between 4.0 and 4.49 inclusive.
4. THE Job_Evaluator SHALL assign grade C WHEN the total score is between 3.5 and 3.99 inclusive.
5. THE Job_Evaluator SHALL assign grade D WHEN the total score is between 3.0 and 3.49 inclusive.
6. THE Job_Evaluator SHALL assign grade F WHEN the total score is below 3.0.
7. THE Job_Evaluator SHALL store the grade in the Job_Record.

---

### Requirement 5: Comprehensive Evaluation Report Generation

**User Story:** As a job seeker, I want detailed evaluation reports for each job, so that I understand the analysis and have actionable guidance for applying.

#### Acceptance Criteria

1. WHEN a job is evaluated, THE Job_Evaluator SHALL generate a markdown Evaluation_Report containing all required sections.
2. THE Evaluation_Report SHALL include a Job Details section with title, company, platform, location, salary, and posted date.
3. THE Evaluation_Report SHALL include an Overall Grade section with the letter grade, total score, and recommendation (Strong Apply, Consider, or Skip).
4. THE Evaluation_Report SHALL include a Dimension Scores table showing each dimension's score, weight, weighted contribution, and notes.
5. THE Evaluation_Report SHALL include a Strengths section listing 3-5 positive match factors.
6. THE Evaluation_Report SHALL include a Red Flags section listing concerns or mismatches.
7. THE Evaluation_Report SHALL include a Key Requirements Match section with a checklist of requirements and match status.
8. THE Evaluation_Report SHALL include an Application Strategy section with specific guidance on what to highlight, emphasize, and address.
9. THE Evaluation_Report SHALL include an Interview Prep section with 3-4 STAR_Story suggestions relevant to the role.
10. THE Evaluation_Report SHALL include a Next Steps checklist with actionable items.
11. THE Job_Evaluator SHALL save each Evaluation_Report to S3 with the path format `/reports/{YYYY-MM-DD}/{jobId}.md`.

---

### Requirement 6: Job Data Persistence

**User Story:** As a job seeker, I want all job data stored in DynamoDB, so that I have a complete history and can track my job search progress.

#### Acceptance Criteria

1. THE System SHALL store each Job_Record in DynamoDB with partition key `jobId` and sort key `foundAt` (timestamp).
2. EACH Job_Record SHALL contain: jobId, title, company, platform, location, salary, url, postedDate, grade, totalScore, dimensionScores (map), screenshotUrl, reportUrl, status, foundAt, and expiresAt.
3. THE System SHALL set the DynamoDB TTL (expiresAt) to 90 days from the time of writing.
4. THE System SHALL use a conditional write (`attribute_not_exists(jobId)`) to prevent duplicate job records.
5. THE System SHALL initialize new Job_Records with status "New".

---

### Requirement 7: Dashboard Job Listing Display

**User Story:** As a job seeker, I want to view all jobs in a web dashboard, so that I can review opportunities without logging into AWS.

#### Acceptance Criteria

1. THE Dashboard SHALL display job cards showing grade, title, company, salary, platform, posted date, screenshot thumbnail, top 3 strengths, and red flags.
2. THE Dashboard SHALL fetch job data from DynamoDB via API Gateway.
3. THE Dashboard SHALL display jobs in descending order by total score by default.
4. THE Dashboard SHALL show a loading state while fetching job data.
5. IF no jobs are found, THEN THE Dashboard SHALL display a message indicating no jobs are available.

---

### Requirement 8: Dashboard Filtering System

**User Story:** As a job seeker, I want to filter jobs by grade and status, so that I can focus on specific categories of opportunities.

#### Acceptance Criteria

1. THE Dashboard SHALL provide filter buttons for grades: A, B, C, D, F, and All.
2. WHEN a grade filter is selected, THE Dashboard SHALL display only jobs matching that grade.
3. THE Dashboard SHALL provide filter buttons for statuses: New, Reviewed, Applied, Rejected, Archived, and All.
4. WHEN a status filter is selected, THE Dashboard SHALL display only jobs matching that status.
5. THE Dashboard SHALL display the count of jobs for each grade filter button.
6. THE Dashboard SHALL allow combining grade and status filters simultaneously.

---

### Requirement 9: Dashboard Sorting Capabilities

**User Story:** As a job seeker, I want to sort jobs by different criteria, so that I can organize opportunities based on my priorities.

#### Acceptance Criteria

1. THE Dashboard SHALL provide sort options: Score (High to Low), Score (Low to High), Date (Newest First), Date (Oldest First), and Platform (A-Z).
2. WHEN a sort option is selected, THE Dashboard SHALL reorder the displayed jobs accordingly.
3. THE Dashboard SHALL persist the selected sort option across page refreshes using localStorage.

---

### Requirement 10: Dashboard Job Actions

**User Story:** As a job seeker, I want to perform actions on jobs from the dashboard, so that I can manage my application workflow efficiently.

#### Acceptance Criteria

1. WHEN a user clicks "Apply on Platform", THE Dashboard SHALL open the job URL in a new browser tab.
2. WHEN a user clicks "View Full Report", THE Dashboard SHALL display the complete Evaluation_Report in a modal or new page.
3. WHEN a user clicks "Mark Applied", THE Dashboard SHALL update the Job_Record status to "Applied" and update the UI immediately.
4. WHEN a user clicks "Reject", THE Dashboard SHALL update the Job_Record status to "Rejected" and remove the job from the default view.
5. WHEN a user clicks "Archive", THE Dashboard SHALL update the Job_Record status to "Archived" and remove the job from the default view.

---

### Requirement 11: Dashboard Statistics Display

**User Story:** As a job seeker, I want to see aggregate statistics, so that I can track my job search progress at a glance.

#### Acceptance Criteria

1. THE Dashboard SHALL display the total count of jobs found in the current period.
2. THE Dashboard SHALL display the count of A-grade jobs.
3. THE Dashboard SHALL display the count of B-grade jobs.
4. THE Dashboard SHALL display the count of jobs with status "Applied".
5. THE Dashboard SHALL display the count of jobs with status "New" (pending review).
6. THE Dashboard SHALL display the last scan timestamp and next scheduled scan time.

---

### Requirement 12: Platform-Specific Scrapers

**User Story:** As a job seeker, I want scrapers for 12 different platforms, so that I have maximum coverage of available job opportunities.

#### Acceptance Criteria

1. THE Job_Scanner SHALL implement a scraper for LinkedIn that extracts Easy Apply jobs matching the user profile.
2. THE Job_Scanner SHALL implement a scraper for Naukri.com that extracts jobs matching the user profile.
3. THE Job_Scanner SHALL implement a scraper for Indeed India that extracts jobs matching the user profile.
4. THE Job_Scanner SHALL implement a scraper for Shine.com that extracts jobs matching the user profile.
5. THE Job_Scanner SHALL implement a scraper for Internshala that extracts jobs matching the user profile.
6. THE Job_Scanner SHALL implement a scraper for Wellfound (AngelList) that extracts jobs matching the user profile.
7. THE Job_Scanner SHALL implement a scraper for TimesJobs that extracts jobs matching the user profile.
8. THE Job_Scanner SHALL implement a scraper for Unstop that extracts jobs matching the user profile.
9. THE Job_Scanner SHALL implement a scraper for Uplers that extracts remote jobs matching the user profile.
10. THE Job_Scanner SHALL implement a scraper for Turing that extracts remote jobs matching the user profile.
11. THE Job_Scanner SHALL implement a scraper for Remote.co that extracts remote jobs matching the user profile.
12. THE Job_Scanner SHALL implement a scraper for We Work Remotely that extracts remote jobs matching the user profile.

---

### Requirement 13: User Profile Management

**User Story:** As a job seeker, I want my profile and preferences stored securely, so that the AI evaluation is personalized to my needs.

#### Acceptance Criteria

1. THE System SHALL retrieve the User_Profile from SSM Parameter Store including: name, role, company, years of experience, skills, location, preferred work arrangement, minimum salary, and target role titles.
2. THE Job_Evaluator SHALL use the User_Profile data when scoring jobs across all dimensions.
3. THE System SHALL retrieve the candidate's CV text from SSM Parameter Store for detailed evaluation context.
4. IF the User_Profile retrieval fails, THEN THE System SHALL log the error and use default profile values without aborting the run.

---

### Requirement 14: Email Notifications for High-Grade Jobs

**User Story:** As a job seeker, I want email notifications when A-grade jobs are found, so that I can apply quickly to the best opportunities.

#### Acceptance Criteria

1. WHEN the Job_Evaluator assigns an A grade to a job, THE System SHALL send an email notification via SES to the user's notification email address.
2. THE notification email SHALL include the job title, company, platform, total score, top 3 strengths, and a link to view the full report in the Dashboard.
3. THE System SHALL batch A-grade notifications and send a single email per run containing all A-grade jobs found.
4. IF the SES send call fails, THEN THE System SHALL log the error and continue without failing the run.

---

### Requirement 15: Cross-Platform Deduplication

**User Story:** As a job seeker, I want duplicate jobs removed across platforms, so that I don't see the same opportunity multiple times.

#### Acceptance Criteria

1. WHEN jobs from all platforms are collected, THE Job_Scanner SHALL deduplicate by normalizing and comparing the composite key of `company name + job title` (case-insensitive, trimmed).
2. THE Job_Scanner SHALL retain the first occurrence of a duplicate and discard subsequent occurrences.
3. THE Job_Scanner SHALL log the count of duplicates removed.

---

### Requirement 16: Scheduled Execution

**User Story:** As a job seeker, I want the system to run automatically every morning, so that I have fresh job recommendations daily.

#### Acceptance Criteria

1. THE Job_Scanner SHALL be triggered by AWS EventBridge Scheduler at 09:00 IST daily using the cron expression `cron(30 3 * * ? *)`.
2. THE Job_Scanner SHALL complete within the Lambda timeout of 900 seconds (15 minutes).
3. THE System SHALL support manual invocation via AWS Lambda console or CLI.

---

### Requirement 17: Infrastructure as Code

**User Story:** As a developer, I want all infrastructure defined in Terraform, so that the system can be deployed and managed consistently.

#### Acceptance Criteria

1. THE Terraform configuration SHALL define two Lambda functions: Job_Scanner and Job_Evaluator.
2. THE Terraform configuration SHALL define a DynamoDB table with on-demand billing and TTL enabled.
3. THE Terraform configuration SHALL define an S3 bucket for screenshots, reports, and dashboard hosting.
4. THE Terraform configuration SHALL define an API Gateway for the Dashboard to access DynamoDB.
5. THE Terraform configuration SHALL define EventBridge Scheduler rules for daily execution.
6. THE Terraform configuration SHALL define IAM roles and policies with least-privilege access.
7. THE Terraform configuration SHALL define SSM parameters for all credentials and configuration values.

---

### Requirement 18: Mobile-Responsive Dashboard

**User Story:** As a job seeker, I want the dashboard to work on mobile devices, so that I can review jobs on the go.

#### Acceptance Criteria

1. THE Dashboard SHALL use responsive CSS (Tailwind) to adapt to screen sizes from 320px to 1920px width.
2. WHEN viewed on mobile devices, THE Dashboard SHALL stack job cards vertically and adjust font sizes for readability.
3. WHEN viewed on mobile devices, THE Dashboard SHALL provide touch-friendly button sizes (minimum 44x44 pixels).
4. THE Dashboard SHALL display screenshot thumbnails at appropriate sizes for each screen size.

---

### Requirement 19: Error Handling and Logging

**User Story:** As a developer, I want comprehensive error handling and logging, so that I can diagnose issues quickly.

#### Acceptance Criteria

1. WHEN any scraper fails, THE Job_Scanner SHALL log the platform name, error message, and stack trace without aborting the run.
2. WHEN screenshot capture fails, THE Job_Scanner SHALL log the job ID and error message and continue processing.
3. WHEN the Gemini AI API call fails, THE Job_Evaluator SHALL log the error and assign a default grade of C with a note indicating evaluation failure.
4. WHEN DynamoDB writes fail, THE System SHALL log the error and continue processing remaining jobs.
5. THE System SHALL log the start time, end time, and summary statistics for each run.

---

### Requirement 20: API Gateway for Dashboard Data Access

**User Story:** As a job seeker, I want the dashboard to fetch data securely, so that my job information is protected.

#### Acceptance Criteria

1. THE System SHALL provide an API Gateway endpoint `/jobs` that returns all Job_Records from DynamoDB.
2. THE System SHALL provide an API Gateway endpoint `/jobs/{jobId}` that returns a single Job_Record.
3. THE System SHALL provide an API Gateway endpoint `/jobs/{jobId}/status` that accepts PUT requests to update job status.
4. THE API Gateway SHALL use CORS configuration to allow requests from the Dashboard S3 origin.
5. THE API Gateway SHALL implement rate limiting to prevent abuse.

---

### Requirement 21: Gemini AI Integration

**User Story:** As a job seeker, I want AI-powered evaluation, so that I get intelligent, personalized job recommendations.

#### Acceptance Criteria

1. THE Job_Evaluator SHALL use the Gemini AI model via Google AI Studio API.
2. THE Job_Evaluator SHALL send a structured prompt including User_Profile, job details, and evaluation instructions.
3. THE Job_Evaluator SHALL request a JSON response containing all 10 dimension scores, notes, strengths, red flags, and STAR_Story suggestions.
4. THE Job_Evaluator SHALL use a temperature of 0.3 for consistent evaluation results.
5. THE Job_Evaluator SHALL respect the Gemini API rate limit of 15 requests per minute by processing jobs sequentially.
6. IF the Gemini API returns unparseable JSON, THEN THE Job_Evaluator SHALL log the raw response and assign default scores.

---

### Requirement 22: Screenshot Storage and Retrieval

**User Story:** As a job seeker, I want screenshots stored efficiently, so that I can view them quickly in the dashboard.

#### Acceptance Criteria

1. THE Job_Scanner SHALL store screenshots in S3 with public-read ACL for dashboard access.
2. THE Job_Scanner SHALL organize screenshots by date in the format `/screenshots/{YYYY-MM-DD}/{jobId}.png`.
3. THE Dashboard SHALL display screenshot thumbnails with lazy loading for performance.
4. THE Dashboard SHALL allow clicking thumbnails to view full-size screenshots in a modal.
5. THE System SHALL set S3 lifecycle policies to delete screenshots older than 90 days.

---

### Requirement 23: Evaluation Report Storage and Retrieval

**User Story:** As a job seeker, I want evaluation reports stored and accessible, so that I can review detailed analysis anytime.

#### Acceptance Criteria

1. THE Job_Evaluator SHALL store Evaluation_Reports in S3 with public-read ACL for dashboard access.
2. THE Job_Evaluator SHALL organize reports by date in the format `/reports/{YYYY-MM-DD}/{jobId}.md`.
3. THE Dashboard SHALL render markdown reports with proper formatting when displaying full reports.
4. THE System SHALL set S3 lifecycle policies to delete reports older than 90 days.

---

### Requirement 24: Job Description Fetching

**User Story:** As a job seeker, I want the AI to evaluate based on full job descriptions, so that the evaluation is accurate and comprehensive.

#### Acceptance Criteria

1. WHEN a job is ready for evaluation, THE Job_Scanner SHALL navigate to the job URL and extract the full job description text.
2. THE Job_Scanner SHALL store the job description in the Job_Record.
3. THE Job_Evaluator SHALL include the full job description in the Gemini AI prompt.
4. IF job description extraction fails, THEN THE Job_Scanner SHALL log the error and store an empty description without failing the job processing.

---

### Requirement 25: Browser Stealth and Resource Optimization

**User Story:** As a developer, I want browser automation to avoid detection and minimize resource usage, so that scrapers work reliably and stay within Lambda limits.

#### Acceptance Criteria

1. THE Job_Scanner SHALL set a realistic Chrome user-agent string on every browser page.
2. THE Job_Scanner SHALL block image, font, and media resource requests to reduce memory and network usage.
3. THE Job_Scanner SHALL use human-like delays between page interactions (1-3 seconds).
4. THE Job_Scanner SHALL perform incremental page scrolling to trigger lazy-loaded content.
5. THE Job_Scanner SHALL launch Chromium using `@sparticuz/chromium` with `--no-sandbox`, `--disable-setuid-sandbox`, and `--disable-dev-shm-usage` flags.
6. THE Job_Scanner SHALL close the Puppeteer browser instance in a `finally` block to ensure cleanup.

---

### Requirement 26: Dashboard Loading States

**User Story:** As a job seeker, I want visual feedback while data loads, so that I know the dashboard is working.

#### Acceptance Criteria

1. WHEN the Dashboard is fetching job data, THE Dashboard SHALL display a loading spinner or skeleton UI.
2. WHEN a job action is being processed, THE Dashboard SHALL disable the action button and show a loading indicator.
3. WHEN an error occurs during data fetching, THE Dashboard SHALL display an error message with a retry button.

---

### Requirement 27: Job Status Tracking

**User Story:** As a job seeker, I want to track the status of each job, so that I know which jobs I've reviewed, applied to, or rejected.

#### Acceptance Criteria

1. THE System SHALL support five job statuses: New, Reviewed, Applied, Rejected, and Archived.
2. WHEN a user views a job's full report, THE Dashboard SHALL automatically update the status from "New" to "Reviewed".
3. WHEN a user marks a job as applied, THE Dashboard SHALL update the status to "Applied" and record the timestamp.
4. WHEN a user rejects a job, THE Dashboard SHALL update the status to "Rejected" and hide it from the default view.
5. WHEN a user archives a job, THE Dashboard SHALL update the status to "Archived" and hide it from the default view.

---

### Requirement 28: STAR Interview Story Generation

**User Story:** As a job seeker, I want AI-generated STAR interview stories, so that I can prepare effectively for interviews.

#### Acceptance Criteria

1. WHEN generating an Evaluation_Report, THE Job_Evaluator SHALL include 3-4 STAR_Story suggestions relevant to the job requirements.
2. EACH STAR_Story SHALL include a title describing the scenario (e.g., "Technical Challenge: Scaling Node.js App").
3. EACH STAR_Story SHALL reference specific skills or experiences from the User_Profile that match job requirements.
4. THE STAR_Story suggestions SHALL be tailored to the job's key requirements and dimension scores.

---

### Requirement 29: Application Strategy Guidance

**User Story:** As a job seeker, I want specific application strategy advice, so that I know how to position myself for each opportunity.

#### Acceptance Criteria

1. WHEN generating an Evaluation_Report, THE Job_Evaluator SHALL include an Application Strategy section.
2. THE Application Strategy SHALL identify 2-3 key points to highlight based on strengths.
3. THE Application Strategy SHALL identify 1-2 points to emphasize based on job requirements.
4. THE Application Strategy SHALL identify any gaps to address and suggest how to address them.
5. THE Application Strategy SHALL provide CV customization recommendations specific to the role.

---

### Requirement 30: Dashboard Search Functionality

**User Story:** As a job seeker, I want to search jobs by keywords, so that I can quickly find specific opportunities.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a search input field.
2. WHEN a user enters search text, THE Dashboard SHALL filter jobs by matching the search text against job title, company name, or platform.
3. THE Dashboard SHALL update the displayed jobs in real-time as the user types.
4. THE Dashboard SHALL display a count of matching jobs.
5. THE Dashboard SHALL allow clearing the search to show all jobs again.

