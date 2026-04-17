# JobPilot V2 Quick Reference

## Common Commands

### Deployment

```bash
# Full deployment (Windows)
.\deploy.ps1

# Full deployment (Linux/Mac)
./deploy.sh

# Manual deployment
npm run build:all
terraform apply
```

### Testing

```bash
# Run all tests
npm test

# Test Scanner Lambda
aws lambda invoke --function-name jobpilot-scanner output.json

# Test Evaluator Lambda
aws lambda invoke --function-name jobpilot-evaluator output.json

# Test API
curl $(terraform output -raw dashboard_api_url) | jq
```

### Monitoring

```bash
# View Scanner logs
aws logs tail /aws/lambda/jobpilot-scanner --follow

# View Evaluator logs
aws logs tail /aws/lambda/jobpilot-evaluator --follow

# View API logs
aws logs tail /aws/lambda/jobpilot-api --follow

# Check Lambda metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=jobpilot-scanner \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

### Configuration

```bash
# Update user profile
aws ssm put-parameter --name /jobpilot/profile/name --value "Your Name" --type String --overwrite
aws ssm put-parameter --name /jobpilot/profile/skills --value "Python,Django,AWS" --type String --overwrite

# Update credentials
aws ssm put-parameter --name /jobpilot/linkedin/password --value "new-password" --type SecureString --overwrite

# Verify SES email
aws ses verify-email-identity --email-address your-email@example.com
```

### Data Management

```bash
# Query DynamoDB
aws dynamodb scan --table-name jobpilot-applications --limit 10

# Count jobs by status
aws dynamodb scan --table-name jobpilot-applications \
  --filter-expression "attribute_exists(grade)" \
  --select COUNT

# List S3 objects
S3_BUCKET=$(terraform output -raw s3_bucket_name)
aws s3 ls s3://$S3_BUCKET/ --recursive

# Download screenshot
aws s3 cp s3://$S3_BUCKET/screenshots/2024-01-15/linkedin-12345.png ./
```

### Troubleshooting

```bash
# Check Terraform state
terraform show

# Verify AWS credentials
aws sts get-caller-identity

# Check Lambda configuration
aws lambda get-function-configuration --function-name jobpilot-scanner

# List SSM parameters
aws ssm describe-parameters --filters "Key=Name,Values=/jobpilot/"

# Get parameter value
aws ssm get-parameter --name /jobpilot/gemini/apikey --with-decryption
```

### Cleanup

```bash
# Destroy all resources
terraform destroy

# Delete specific Lambda
aws lambda delete-function --function-name jobpilot-scanner

# Empty S3 bucket
S3_BUCKET=$(terraform output -raw s3_bucket_name)
aws s3 rm s3://$S3_BUCKET/ --recursive
```

## API Endpoints

### GET /jobs

```bash
# Get all jobs
curl $(terraform output -raw dashboard_api_url)

# Filter by grade
curl "$(terraform output -raw dashboard_api_url)?grade=A"

# Filter by status
curl "$(terraform output -raw dashboard_api_url)?status=New"

# Combined filters
curl "$(terraform output -raw dashboard_api_url)?grade=A&status=New"
```

### GET /jobs/{jobId}

```bash
# Get single job
curl "$(terraform output -raw dashboard_api_url)/linkedin-12345"
```

### PUT /jobs/{jobId}/status

```bash
# Update job status
curl -X PUT "$(terraform output -raw dashboard_api_url)/linkedin-12345/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "Applied"}'
```

## Dashboard URLs

```bash
# Get dashboard URL
terraform output dashboard_v2_url

# Get API URL
terraform output dashboard_api_url

# Get S3 bucket name
terraform output s3_bucket_name
```

## Lambda Function Names

- **Scanner:** `jobpilot-scanner`
- **Evaluator:** `jobpilot-evaluator`
- **API:** `jobpilot-api`
- **Legacy:** `jobpilot-engine`

## DynamoDB Table

- **Name:** `jobpilot-applications`
- **Partition Key:** `jobId`
- **GSI:** `status-foundAt-index`

## S3 Bucket Structure

```
s3://jobpilot-dashboard-{random}/
├── screenshots/
│   └── YYYY-MM-DD/
│       └── {jobId}.png
├── reports/
│   └── YYYY-MM-DD/
│       └── {jobId}.md
├── index.html
├── dashboard-v2.html
├── scanner.zip
├── evaluator.zip
├── api.zip
└── lambda.zip
```

## SSM Parameters

### Credentials

- `/jobpilot/linkedin/email`
- `/jobpilot/linkedin/password`
- `/jobpilot/naukri/email`
- `/jobpilot/naukri/password`
- `/jobpilot/internshala/email`
- `/jobpilot/internshala/password`
- `/jobpilot/shine/email`
- `/jobpilot/shine/password`
- `/jobpilot/wellfound/email`
- `/jobpilot/wellfound/password`

### Configuration

- `/jobpilot/gemini/apikey`
- `/jobpilot/notify/email`
- `/jobpilot/cv/text`
- `/jobpilot/candidate/phone`

### User Profile

- `/jobpilot/profile/name`
- `/jobpilot/profile/role`
- `/jobpilot/profile/experience`
- `/jobpilot/profile/skills`
- `/jobpilot/profile/location`
- `/jobpilot/profile/work-arrangement`
- `/jobpilot/profile/min-salary`
- `/jobpilot/profile/target-roles`

## Job Statuses

- **New:** Freshly scraped, not yet reviewed
- **Reviewed:** User viewed the full report
- **Applied:** User applied to the job
- **Rejected:** User rejected the job
- **Archived:** User archived the job

## Grade Scale

- **A (4.5-5.0):** Strong Apply - Top match
- **B (4.0-4.49):** Consider - Good match
- **C (3.5-3.99):** Review Carefully - Moderate match
- **D (3.0-3.49):** Likely Not a Fit - Weak match
- **F (<3.0):** Skip - Poor match

## Dimension Weights

| Dimension | Weight |
|-----------|--------|
| Skills Match | 20% |
| Experience Level | 15% |
| Salary Range | 15% |
| Location/Remote | 10% |
| Company Culture Fit | 10% |
| Growth Potential | 10% |
| Tech Stack Match | 10% |
| Role Clarity | 5% |
| Team Size | 3% |
| Work-Life Balance | 2% |

## Scheduled Runs

- **Scanner:** Daily at 09:00 IST (03:30 UTC)
- **Evaluator:** Daily at 09:05 IST (03:35 UTC)

## Resource Limits

- **Scanner Lambda:** 2048 MB memory, 900s timeout
- **Evaluator Lambda:** 1024 MB memory, 600s timeout
- **API Lambda:** 512 MB memory, 30s timeout
- **DynamoDB:** On-demand billing, 90-day TTL
- **S3:** Lifecycle policy deletes objects > 90 days
- **Gemini API:** 15 requests per minute

## Error Codes

### Lambda

- **200:** Success
- **500:** Internal error
- **503:** Service unavailable

### API Gateway

- **200:** Success
- **400:** Bad request
- **404:** Not found
- **429:** Too many requests
- **500:** Internal error

## Useful Queries

### DynamoDB

```bash
# Get A-grade jobs
aws dynamodb scan --table-name jobpilot-applications \
  --filter-expression "grade = :grade" \
  --expression-attribute-values '{":grade":{"S":"A"}}'

# Get jobs by platform
aws dynamodb scan --table-name jobpilot-applications \
  --filter-expression "platform = :platform" \
  --expression-attribute-values '{":platform":{"S":"linkedin"}}'

# Get jobs by status
aws dynamodb query --table-name jobpilot-applications \
  --index-name status-foundAt-index \
  --key-condition-expression "#status = :status" \
  --expression-attribute-names '{"#status":"status"}' \
  --expression-attribute-values '{":status":{"S":"New"}}'
```

### CloudWatch Logs Insights

```bash
# Query for errors
aws logs start-query \
  --log-group-name /aws/lambda/jobpilot-scanner \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 20'

# Query for performance
aws logs start-query \
  --log-group-name /aws/lambda/jobpilot-scanner \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --query-string 'fields @timestamp, @duration | stats avg(@duration), max(@duration), min(@duration)'
```

## Performance Benchmarks

- **Scanner:** < 900 seconds (15 minutes)
- **Evaluator:** < 600 seconds (10 minutes)
- **API:** < 2 seconds response time
- **Dashboard:** < 3 seconds initial load

## Cost Estimates

- **Lambda:** $0 (within free tier)
- **DynamoDB:** $0 (within free tier)
- **S3:** $0 (within free tier)
- **API Gateway:** $0 (within free tier for first 12 months)
- **Gemini API:** ~$0.50/month
- **Total:** $0-5/month

## Support Resources

- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Full deployment instructions
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - Testing procedures
- [README_V2.md](README_V2.md) - Complete documentation
- [CloudWatch Logs](https://console.aws.amazon.com/cloudwatch/home?region=ap-south-1#logsV2:log-groups) - View logs
- [AWS Console](https://console.aws.amazon.com/) - Manage resources
