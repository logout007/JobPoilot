# JobPilot V2 Testing Guide

## Overview

This guide covers end-to-end testing procedures for JobPilot V2, including unit tests, integration tests, and manual testing workflows.

## Test Environment Setup

### Prerequisites

1. Node.js v20+ installed
2. AWS CLI configured with test credentials
3. Terraform deployed to test environment
4. Test data in DynamoDB

### Install Test Dependencies

```bash
npm install
```

## Unit Tests

### Running Unit Tests

```bash
npm test
```

This runs all unit tests using Vitest.

### Test Coverage

Current test coverage includes:

1. **Scanner Handler Tests** (`tests/scanner-handler.test.js`)
   - Screenshot capture
   - Job description extraction
   - Platform scrapers
   - Error handling

2. **Evaluator Handler Tests** (`tests/evaluator-handler-integration.test.js`)
   - Gemini AI evaluation
   - Grade calculation
   - Report generation
   - A-grade notifications

3. **API Handler Tests** (to be created)
   - GET /jobs endpoint
   - GET /jobs/{jobId} endpoint
   - PUT /jobs/{jobId}/status endpoint
   - CORS handling

4. **Property-Based Tests** (`tests/properties.test.js`)
   - Grade calculation properties
   - Status update properties
   - Data validation properties

### Running Specific Tests

```bash
# Run scanner tests only
npm test -- scanner-handler.test.js

# Run evaluator tests only
npm test -- evaluator-handler-integration.test.js

# Run property tests only
npm test -- properties.test.js
```

## Integration Tests

### Test Scanner Lambda

#### 1. Manual Invocation

```bash
aws lambda invoke \
  --function-name jobpilot-scanner \
  --log-type Tail \
  --query 'LogResult' \
  --output text \
  output.json | base64 -d

cat output.json
```

Expected output:
```json
{
  "statusCode": 200,
  "body": {
    "platformsScraped": 12,
    "jobsFound": 50,
    "duplicatesRemoved": 5,
    "jobsSaved": 45,
    "errors": []
  }
}
```

#### 2. Verify DynamoDB Records

```bash
aws dynamodb scan \
  --table-name jobpilot-applications \
  --filter-expression "attribute_exists(screenshotUrl)" \
  --limit 5
```

Expected: Jobs with status "New", screenshotUrl, and description fields.

#### 3. Verify S3 Screenshots

```bash
S3_BUCKET=$(terraform output -raw s3_bucket_name)
aws s3 ls s3://$S3_BUCKET/screenshots/$(date +%Y-%m-%d)/ --recursive
```

Expected: PNG files for each job scraped today.

### Test Evaluator Lambda

#### 1. Manual Invocation

```bash
aws lambda invoke \
  --function-name jobpilot-evaluator \
  --log-type Tail \
  --query 'LogResult' \
  --output text \
  output.json | base64 -d

cat output.json
```

Expected output:
```json
{
  "statusCode": 200,
  "body": {
    "jobsEvaluated": 45,
    "gradesDistribution": {
      "A": 5,
      "B": 15,
      "C": 20,
      "D": 3,
      "F": 2
    },
    "aGradeNotificationSent": true,
    "errors": []
  }
}
```

#### 2. Verify DynamoDB Updates

```bash
aws dynamodb scan \
  --table-name jobpilot-applications \
  --filter-expression "attribute_exists(grade)" \
  --limit 5
```

Expected: Jobs with grade, totalScore, dimensionScores, and reportUrl fields.

#### 3. Verify S3 Reports

```bash
S3_BUCKET=$(terraform output -raw s3_bucket_name)
aws s3 ls s3://$S3_BUCKET/reports/$(date +%Y-%m-%d)/ --recursive
```

Expected: Markdown files for each evaluated job.

#### 4. Verify Email Notification

Check your notification email for A-grade job alerts.

Expected: Email with job title, company, platform, score, and dashboard link.

### Test API Lambda

#### 1. Test GET /jobs

```bash
API_URL=$(terraform output -raw dashboard_api_url)
curl -X GET "$API_URL" | jq
```

Expected output:
```json
{
  "statusCode": 200,
  "body": {
    "jobs": [...],
    "count": 45
  }
}
```

#### 2. Test GET /jobs with Filters

```bash
# Filter by grade
curl -X GET "$API_URL?grade=A" | jq

# Filter by status
curl -X GET "$API_URL?status=New" | jq

# Combined filters
curl -X GET "$API_URL?grade=A&status=New" | jq
```

#### 3. Test GET /jobs/{jobId}

```bash
# Get a job ID from previous response
JOB_ID="linkedin-12345"
curl -X GET "$API_URL/$JOB_ID" | jq
```

Expected output:
```json
{
  "statusCode": 200,
  "body": {
    "jobId": "linkedin-12345",
    "title": "Software Engineer",
    "company": "Example Corp",
    ...
  }
}
```

#### 4. Test PUT /jobs/{jobId}/status

```bash
JOB_ID="linkedin-12345"
curl -X PUT "$API_URL/$JOB_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "Applied"}' | jq
```

Expected output:
```json
{
  "statusCode": 200,
  "body": {
    "message": "Status updated successfully",
    "jobId": "linkedin-12345",
    "status": "Applied"
  }
}
```

## End-to-End Testing

### Full Workflow Test

1. **Trigger Scanner:**
   ```bash
   aws lambda invoke --function-name jobpilot-scanner output.json
   ```

2. **Wait 2 minutes** for scanner to complete

3. **Verify Jobs in DynamoDB:**
   ```bash
   aws dynamodb scan --table-name jobpilot-applications --filter-expression "attribute_not_exists(grade)" --select COUNT
   ```

4. **Trigger Evaluator:**
   ```bash
   aws lambda invoke --function-name jobpilot-evaluator output.json
   ```

5. **Wait 5 minutes** for evaluator to complete

6. **Verify Evaluated Jobs:**
   ```bash
   aws dynamodb scan --table-name jobpilot-applications --filter-expression "attribute_exists(grade)" --select COUNT
   ```

7. **Open Dashboard:**
   ```bash
   DASHBOARD_URL=$(terraform output -raw dashboard_v2_url)
   echo "Open: $DASHBOARD_URL"
   ```

8. **Test Dashboard Features:**
   - Verify job cards display correctly
   - Test grade filters (A, B, C, D, F)
   - Test status filters (New, Reviewed, Applied, Rejected, Archived)
   - Test sorting (Score, Date, Platform)
   - Test search functionality
   - Click "View Full Report" and verify markdown rendering
   - Click "Apply on Platform" and verify new tab opens
   - Click "Mark Applied" and verify status updates
   - Click screenshot thumbnail and verify modal opens

## Performance Testing

### Lambda Execution Time

```bash
# Scanner execution time
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=jobpilot-scanner \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average,Maximum

# Evaluator execution time
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=jobpilot-evaluator \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average,Maximum
```

Expected:
- Scanner: < 900 seconds (15 minutes)
- Evaluator: < 600 seconds (10 minutes)
- API: < 5 seconds

### API Response Time

```bash
# Test API response time
time curl -X GET "$API_URL"
```

Expected: < 2 seconds

### Dashboard Load Time

Open browser DevTools Network tab and measure:
- Initial page load: < 3 seconds
- API data fetch: < 2 seconds
- Screenshot load: < 1 second per image

## Error Testing

### Test Scanner Error Handling

1. **Invalid Credentials:**
   ```bash
   # Update SSM parameter with invalid password
   aws ssm put-parameter --name /jobpilot/linkedin/password --value "invalid" --type SecureString --overwrite
   
   # Invoke scanner
   aws lambda invoke --function-name jobpilot-scanner output.json
   
   # Verify error logged but other platforms continue
   cat output.json
   
   # Restore valid password
   aws ssm put-parameter --name /jobpilot/linkedin/password --value "valid-password" --type SecureString --overwrite
   ```

2. **Network Timeout:**
   - Simulate by temporarily blocking platform URLs
   - Verify scanner continues with other platforms

3. **S3 Upload Failure:**
   - Temporarily remove S3 write permissions
   - Verify scanner logs error but continues

### Test Evaluator Error Handling

1. **Invalid Gemini API Key:**
   ```bash
   # Update SSM parameter with invalid key
   aws ssm put-parameter --name /jobpilot/gemini/apikey --value "invalid" --type SecureString --overwrite
   
   # Invoke evaluator
   aws lambda invoke --function-name jobpilot-evaluator output.json
   
   # Verify default grade C assigned
   cat output.json
   
   # Restore valid key
   aws ssm put-parameter --name /jobpilot/gemini/apikey --value "valid-key" --type SecureString --overwrite
   ```

2. **Gemini API Rate Limit:**
   - Process > 15 jobs in 1 minute
   - Verify sequential processing respects rate limit

3. **SES Send Failure:**
   - Use unverified email address
   - Verify evaluator logs error but continues

### Test API Error Handling

1. **Invalid Job ID:**
   ```bash
   curl -X GET "$API_URL/invalid-job-id" | jq
   ```
   Expected: 404 Not Found

2. **Invalid Status:**
   ```bash
   curl -X PUT "$API_URL/linkedin-12345/status" \
     -H "Content-Type: application/json" \
     -d '{"status": "InvalidStatus"}' | jq
   ```
   Expected: 400 Bad Request

3. **Missing Request Body:**
   ```bash
   curl -X PUT "$API_URL/linkedin-12345/status" | jq
   ```
   Expected: 400 Bad Request

## Load Testing

### API Load Test

```bash
# Install Apache Bench
# Ubuntu: sudo apt-get install apache2-utils
# Mac: brew install ab

# Test 100 requests with 10 concurrent
ab -n 100 -c 10 "$API_URL"
```

Expected:
- Success rate: > 95%
- Average response time: < 2 seconds
- No 5xx errors

### Dashboard Load Test

Use browser DevTools to simulate:
- 100 job cards
- 50 screenshots
- Multiple filter/sort operations

Expected:
- No UI freezing
- Smooth scrolling
- Fast filter/sort updates

## Regression Testing

### Before Each Release

1. Run all unit tests: `npm test`
2. Test scanner with all 12 platforms
3. Test evaluator with sample jobs
4. Test API with all endpoints
5. Test dashboard with all features
6. Verify CloudWatch logs for errors
7. Check DynamoDB data integrity
8. Verify S3 storage usage

### Automated Regression Suite

Create a script to run all tests:

```bash
#!/bin/bash
# regression-test.sh

echo "Running unit tests..."
npm test

echo "Testing Scanner Lambda..."
aws lambda invoke --function-name jobpilot-scanner output-scanner.json
cat output-scanner.json

echo "Testing Evaluator Lambda..."
aws lambda invoke --function-name jobpilot-evaluator output-evaluator.json
cat output-evaluator.json

echo "Testing API endpoints..."
API_URL=$(terraform output -raw dashboard_api_url)
curl -X GET "$API_URL" > output-api.json
cat output-api.json

echo "All tests complete!"
```

## Test Data Management

### Create Test Jobs

```bash
# Insert test job into DynamoDB
aws dynamodb put-item \
  --table-name jobpilot-applications \
  --item '{
    "jobId": {"S": "test-12345"},
    "title": {"S": "Test Software Engineer"},
    "company": {"S": "Test Corp"},
    "platform": {"S": "linkedin"},
    "location": {"S": "Remote"},
    "salary": {"S": "₹10-15 LPA"},
    "url": {"S": "https://example.com/job/12345"},
    "status": {"S": "New"},
    "foundAt": {"N": "'$(date +%s)'"},
    "expiresAt": {"N": "'$(($(date +%s) + 7776000))'"}
  }'
```

### Clean Test Data

```bash
# Delete test jobs
aws dynamodb scan --table-name jobpilot-applications \
  --filter-expression "begins_with(jobId, :prefix)" \
  --expression-attribute-values '{":prefix":{"S":"test-"}}' \
  --projection-expression "jobId" \
  | jq -r '.Items[].jobId.S' \
  | xargs -I {} aws dynamodb delete-item --table-name jobpilot-applications --key '{"jobId":{"S":"{}"}}'
```

## Monitoring Tests

### CloudWatch Metrics

```bash
# Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=jobpilot-scanner \
  --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Sum

# Lambda errors
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=jobpilot-scanner \
  --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Sum
```

### CloudWatch Logs Insights

```bash
# Query scanner logs for errors
aws logs start-query \
  --log-group-name /aws/lambda/jobpilot-scanner \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 20'
```

## Test Checklist

### Pre-Deployment Testing

- [ ] All unit tests pass
- [ ] Scanner Lambda tested with all platforms
- [ ] Evaluator Lambda tested with sample jobs
- [ ] API Lambda tested with all endpoints
- [ ] Dashboard tested with all features
- [ ] Error handling tested for all components
- [ ] Performance benchmarks met
- [ ] CloudWatch logs reviewed
- [ ] No security vulnerabilities

### Post-Deployment Testing

- [ ] Scanner scheduled trigger works
- [ ] Evaluator scheduled trigger works
- [ ] Dashboard accessible via S3 URL
- [ ] API Gateway endpoints accessible
- [ ] A-grade email notifications received
- [ ] DynamoDB data persisted correctly
- [ ] S3 screenshots and reports uploaded
- [ ] CloudWatch metrics showing activity
- [ ] No errors in CloudWatch logs

## Troubleshooting Test Failures

### Scanner Test Failures

1. **Platform scraper fails:**
   - Check platform website for changes
   - Update selectors in scanner-handler.js
   - Test with browser DevTools

2. **Screenshot capture fails:**
   - Verify Chromium binary exists
   - Check Lambda memory and timeout
   - Test locally with Puppeteer

3. **S3 upload fails:**
   - Verify IAM permissions
   - Check S3 bucket policy
   - Test with AWS CLI

### Evaluator Test Failures

1. **Gemini API fails:**
   - Verify API key is valid
   - Check rate limit (15 RPM)
   - Test with curl

2. **Grade calculation incorrect:**
   - Verify dimension weights
   - Check score ranges
   - Review test cases

3. **Report generation fails:**
   - Verify markdown template
   - Check S3 upload permissions
   - Test locally

### API Test Failures

1. **CORS errors:**
   - Verify API Gateway CORS configuration
   - Check allowed origins
   - Test with browser DevTools

2. **DynamoDB query fails:**
   - Verify IAM permissions
   - Check GSI configuration
   - Test with AWS CLI

3. **Status update fails:**
   - Verify request body format
   - Check DynamoDB write permissions
   - Review CloudWatch logs

## Continuous Testing

### GitHub Actions (Optional)

Create `.github/workflows/test.yml`:

```yaml
name: Test JobPilot V2

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      - run: npm install
      - run: npm test
```

### Local Pre-Commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
npm test
if [ $? -ne 0 ]; then
  echo "Tests failed. Commit aborted."
  exit 1
fi
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

## Test Reporting

### Generate Test Report

```bash
npm test -- --reporter=verbose > test-report.txt
```

### Coverage Report

```bash
npm test -- --coverage
```

## Conclusion

Regular testing ensures JobPilot V2 remains reliable and bug-free. Follow this guide for comprehensive testing coverage across all components.
