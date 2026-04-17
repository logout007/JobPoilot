# JobPilot V2 Deployment Guide

## Overview

This guide covers the complete deployment process for JobPilot V2, including infrastructure setup, Lambda function deployment, and dashboard configuration.

## Architecture

JobPilot V2 consists of:

- **3 Lambda Functions:**
  - `jobpilot-scanner`: Scrapes 12 job platforms, captures screenshots (2048 MB, 900s timeout)
  - `jobpilot-evaluator`: Evaluates jobs with Gemini AI, generates reports (1024 MB, 600s timeout)
  - `jobpilot-api`: Provides REST API for dashboard (512 MB, 30s timeout)

- **DynamoDB Table:** `jobpilot-applications` with GSI for status queries

- **S3 Bucket:** Stores screenshots, reports, and hosts dashboard

- **API Gateway:** REST API with 3 endpoints (`/jobs`, `/jobs/{jobId}`, `/jobs/{jobId}/status`)

- **EventBridge Scheduler:** 
  - Scanner runs daily at 09:00 IST (03:30 UTC)
  - Evaluator runs daily at 09:05 IST (03:35 UTC)

## Prerequisites

1. **AWS CLI** installed and configured with credentials
2. **Terraform** v1.0+ installed
3. **Node.js** v20+ installed
4. **AWS Account** with appropriate permissions
5. **Gemini API Key** from Google AI Studio

## Configuration

### 1. Create `terraform.tfvars`

Create a `terraform.tfvars` file with your credentials:

```hcl
# Platform Credentials
linkedin_email      = "your-email@example.com"
linkedin_password   = "your-password"
naukri_email        = "your-email@example.com"
naukri_password     = "your-password"
internshala_email   = "your-email@example.com"
internshala_password = "your-password"
shine_email         = "your-email@example.com"
shine_password      = "your-password"
wellfound_email     = "your-email@example.com"
wellfound_password  = "your-password"

# Gemini AI
gemini_api_key      = "your-gemini-api-key"

# Notifications
notify_email        = "your-email@example.com"

# Candidate Info
candidate_phone     = "+91XXXXXXXXXX"
cv_text             = "Your CV text here..."

# User Profile (Optional - defaults provided)
profile_name            = "Your Name"
profile_role            = "Software Engineer"
profile_experience      = "2"
profile_skills          = "JavaScript,Node.js,React,TypeScript,AWS"
profile_location        = "Kolkata, India"
profile_work_arrangement = "Remote"
profile_min_salary      = "500000"
profile_target_roles    = "Software Engineer,Full Stack Developer,Backend Developer"
```

### 2. Verify SES Email

Before deployment, verify your notification email in AWS SES:

```bash
aws ses verify-email-identity --email-address your-email@example.com
```

Check your email and click the verification link.

## Deployment Methods

### Method 1: Automated Deployment (Recommended)

#### Windows (PowerShell)

```powershell
.\deploy.ps1
```

#### Linux/Mac (Bash)

```bash
chmod +x deploy.sh
./deploy.sh
```

The automated script will:
1. Install dependencies
2. Build all Lambda packages
3. Upload packages to S3
4. Deploy infrastructure with Terraform
5. Update Lambda function code
6. Display deployment summary

### Method 2: Manual Deployment

#### Step 1: Install Dependencies

```bash
npm install
```

#### Step 2: Build Lambda Packages

```bash
npm run build:all
```

This creates:
- `build/scanner.zip`
- `build/evaluator.zip`
- `build/api.zip`
- `lambda.zip` (legacy)

#### Step 3: Initialize Terraform

```bash
terraform init
```

#### Step 4: Deploy Infrastructure

```bash
terraform apply
```

Review the plan and type `yes` to confirm.

#### Step 5: Upload Lambda Packages

```bash
# Get S3 bucket name
S3_BUCKET=$(terraform output -raw s3_bucket_name)

# Upload packages
aws s3 cp build/scanner.zip s3://$S3_BUCKET/scanner.zip
aws s3 cp build/evaluator.zip s3://$S3_BUCKET/evaluator.zip
aws s3 cp build/api.zip s3://$S3_BUCKET/api.zip
aws s3 cp lambda.zip s3://$S3_BUCKET/lambda.zip
```

#### Step 6: Upload Dashboard

```bash
aws s3 cp dashboard-v2.html s3://$S3_BUCKET/dashboard-v2.html --content-type "text/html"
aws s3 cp index.html s3://$S3_BUCKET/index.html --content-type "text/html"
```

#### Step 7: Update Lambda Functions

```bash
aws lambda update-function-code --function-name jobpilot-scanner --s3-bucket $S3_BUCKET --s3-key scanner.zip
aws lambda update-function-code --function-name jobpilot-evaluator --s3-bucket $S3_BUCKET --s3-key evaluator.zip
aws lambda update-function-code --function-name jobpilot-api --s3-bucket $S3_BUCKET --s3-key api.zip
```

## Post-Deployment

### 1. Get Deployment URLs

```bash
# Dashboard URL
terraform output dashboard_v2_url

# API Gateway URL
terraform output dashboard_api_url
```

### 2. Test Lambda Functions

#### Test Scanner

```bash
aws lambda invoke --function-name jobpilot-scanner output.json
cat output.json
```

#### Test Evaluator

```bash
aws lambda invoke --function-name jobpilot-evaluator output.json
cat output.json
```

#### Test API

```bash
# Get API URL
API_URL=$(terraform output -raw dashboard_api_url)

# Test GET /jobs
curl $API_URL
```

### 3. View CloudWatch Logs

```bash
# Scanner logs
aws logs tail /aws/lambda/jobpilot-scanner --follow

# Evaluator logs
aws logs tail /aws/lambda/jobpilot-evaluator --follow

# API logs
aws logs tail /aws/lambda/jobpilot-api --follow
```

### 4. Open Dashboard

Open the Dashboard URL in your browser. You should see:
- Statistics cards (Total Jobs, A-Grade Jobs, etc.)
- Filter buttons (Grade and Status)
- Sort dropdown
- Search input
- Job cards with screenshots and evaluation data

## Updating the System

### Update Lambda Code

After making changes to handler files:

```bash
# Rebuild packages
npm run build:all

# Upload to S3
S3_BUCKET=$(terraform output -raw s3_bucket_name)
aws s3 cp build/scanner.zip s3://$S3_BUCKET/scanner.zip
aws s3 cp build/evaluator.zip s3://$S3_BUCKET/evaluator.zip
aws s3 cp build/api.zip s3://$S3_BUCKET/api.zip

# Update Lambda functions
aws lambda update-function-code --function-name jobpilot-scanner --s3-bucket $S3_BUCKET --s3-key scanner.zip
aws lambda update-function-code --function-name jobpilot-evaluator --s3-bucket $S3_BUCKET --s3-key evaluator.zip
aws lambda update-function-code --function-name jobpilot-api --s3-bucket $S3_BUCKET --s3-key api.zip
```

### Update Dashboard

```bash
S3_BUCKET=$(terraform output -raw s3_bucket_name)
aws s3 cp dashboard-v2.html s3://$S3_BUCKET/dashboard-v2.html --content-type "text/html"
```

### Update Infrastructure

After making changes to `main.tf`:

```bash
terraform plan
terraform apply
```

## Troubleshooting

### Lambda Function Errors

1. **Check CloudWatch Logs:**
   ```bash
   aws logs tail /aws/lambda/jobpilot-scanner --follow
   ```

2. **Check Lambda Configuration:**
   ```bash
   aws lambda get-function-configuration --function-name jobpilot-scanner
   ```

3. **Verify Environment Variables:**
   ```bash
   aws lambda get-function-configuration --function-name jobpilot-scanner --query 'Environment'
   ```

### SSM Parameter Issues

1. **List Parameters:**
   ```bash
   aws ssm describe-parameters --filters "Key=Name,Values=/jobpilot/"
   ```

2. **Get Parameter Value:**
   ```bash
   aws ssm get-parameter --name /jobpilot/gemini/apikey --with-decryption
   ```

### DynamoDB Issues

1. **Check Table Status:**
   ```bash
   aws dynamodb describe-table --table-name jobpilot-applications
   ```

2. **Scan Table:**
   ```bash
   aws dynamodb scan --table-name jobpilot-applications --limit 10
   ```

### S3 Issues

1. **List Bucket Contents:**
   ```bash
   S3_BUCKET=$(terraform output -raw s3_bucket_name)
   aws s3 ls s3://$S3_BUCKET/ --recursive
   ```

2. **Check Bucket Policy:**
   ```bash
   aws s3api get-bucket-policy --bucket $S3_BUCKET
   ```

### API Gateway Issues

1. **Test API Endpoint:**
   ```bash
   API_URL=$(terraform output -raw dashboard_api_url)
   curl -v $API_URL
   ```

2. **Check API Gateway Logs:**
   ```bash
   aws logs tail /aws/apigateway/jobpilot-dashboard-api --follow
   ```

## Cost Optimization

JobPilot V2 is designed to run on AWS Free Tier:

- **Lambda:** 1M requests/month free, 400,000 GB-seconds compute
- **DynamoDB:** 25 GB storage, 25 read/write capacity units
- **S3:** 5 GB storage, 20,000 GET requests, 2,000 PUT requests
- **API Gateway:** 1M API calls/month free (first 12 months)
- **EventBridge:** Free for scheduled rules

**Estimated Monthly Cost:** $0-5 (mostly Gemini API usage)

## Security Best Practices

1. **Rotate Credentials Regularly:**
   ```bash
   # Update SSM parameters
   aws ssm put-parameter --name /jobpilot/linkedin/password --value "new-password" --type SecureString --overwrite
   ```

2. **Enable CloudTrail:** Monitor API calls and changes

3. **Use IAM Roles:** Never hardcode credentials

4. **Enable S3 Versioning:** Protect against accidental deletions

5. **Set Up CloudWatch Alarms:** Monitor Lambda errors and API Gateway 5xx errors

## Monitoring

### CloudWatch Dashboards

Create a custom dashboard to monitor:
- Lambda invocations and errors
- DynamoDB read/write capacity
- S3 storage usage
- API Gateway request count and latency

### CloudWatch Alarms

Set up alarms for:
- Lambda function errors > 5 in 5 minutes
- API Gateway 5xx errors > 10 in 5 minutes
- DynamoDB throttled requests > 0

## Backup and Recovery

### Backup DynamoDB

```bash
aws dynamodb create-backup --table-name jobpilot-applications --backup-name jobpilot-backup-$(date +%Y%m%d)
```

### Restore DynamoDB

```bash
aws dynamodb restore-table-from-backup --target-table-name jobpilot-applications-restored --backup-arn <backup-arn>
```

### Backup S3

Enable S3 versioning and cross-region replication for critical data.

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning:** This will delete all data including job records, screenshots, and reports.

## Support

For issues or questions:
1. Check CloudWatch Logs
2. Review Terraform state: `terraform show`
3. Verify AWS credentials: `aws sts get-caller-identity`
4. Check AWS service quotas and limits

## Next Steps

1. **Customize User Profile:** Update SSM parameters with your profile data
2. **Add More Platforms:** Extend scrapers in `scanner-handler.js`
3. **Customize Evaluation:** Adjust dimension weights in `evaluator-handler.js`
4. **Enhance Dashboard:** Modify `dashboard-v2.html` for custom UI
5. **Set Up Monitoring:** Create CloudWatch dashboards and alarms
