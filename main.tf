# ============================================================
# JobPilot — Terraform Infrastructure (deploy everything in 1 cmd)
# Cost: $0/mo AWS + ~$0.50/mo Gemini API
# Region: ap-south-1 (Mumbai) — closest to Kolkata
# ============================================================

terraform {
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.0" }
  }
}

provider "aws" {
  region = "ap-south-1"
}

# ── Variables (all sensitive values — no hardcoded credentials)
variable "gemini_api_key" { sensitive = true }
variable "linkedin_email" { sensitive = true }
variable "linkedin_password" { sensitive = true }
variable "naukri_email" { sensitive = true }
variable "naukri_password" { sensitive = true }
variable "notify_email" {}
variable "cv_text" { sensitive = true }
variable "candidate_phone" { sensitive = true }
variable "internshala_email" { sensitive = true }
variable "internshala_password" { sensitive = true }
variable "shine_email" { sensitive = true }
variable "shine_password" { sensitive = true }
variable "wellfound_email" { sensitive = true }
variable "wellfound_password" { sensitive = true }

# ── User Profile Variables (V2)
variable "profile_name" { default = null }
variable "profile_role" { default = null }
variable "profile_experience" { default = null }
variable "profile_skills" { default = null }
variable "profile_location" { default = null }
variable "profile_work_arrangement" { default = null }
variable "profile_min_salary" { default = null }
variable "profile_target_roles" { default = null }


# ── SSM Parameters (encrypted at rest, free)
resource "aws_ssm_parameter" "linkedin_email" {
  name      = "/jobpilot/linkedin/email"
  type      = "SecureString"
  value     = var.linkedin_email
  overwrite = true
}

resource "aws_ssm_parameter" "linkedin_password" {
  name      = "/jobpilot/linkedin/password"
  type      = "SecureString"
  value     = var.linkedin_password
  overwrite = true
}

resource "aws_ssm_parameter" "naukri_email" {
  name      = "/jobpilot/naukri/email"
  type      = "SecureString"
  value     = var.naukri_email
  overwrite = true
}

resource "aws_ssm_parameter" "naukri_password" {
  name      = "/jobpilot/naukri/password"
  type      = "SecureString"
  value     = var.naukri_password
  overwrite = true
}

resource "aws_ssm_parameter" "gemini_key" {
  name      = "/jobpilot/gemini/apikey"
  type      = "SecureString"
  value     = var.gemini_api_key
  overwrite = true
}

resource "aws_ssm_parameter" "cv_text" {
  name      = "/jobpilot/cv/text"
  type      = "SecureString"
  value     = var.cv_text
  overwrite = true
}

resource "aws_ssm_parameter" "notify_email" {
  name      = "/jobpilot/notify/email"
  type      = "String"
  value     = var.notify_email
  overwrite = true
}

resource "aws_ssm_parameter" "candidate_phone" {
  name      = "/jobpilot/candidate/phone"
  type      = "SecureString"
  value     = var.candidate_phone
  overwrite = true
}

resource "aws_ssm_parameter" "internshala_email" {
  name      = "/jobpilot/internshala/email"
  type      = "SecureString"
  value     = var.internshala_email
  overwrite = true
}

resource "aws_ssm_parameter" "internshala_password" {
  name      = "/jobpilot/internshala/password"
  type      = "SecureString"
  value     = var.internshala_password
  overwrite = true
}

resource "aws_ssm_parameter" "shine_email" {
  name      = "/jobpilot/shine/email"
  type      = "SecureString"
  value     = var.shine_email
  overwrite = true
}

resource "aws_ssm_parameter" "shine_password" {
  name      = "/jobpilot/shine/password"
  type      = "SecureString"
  value     = var.shine_password
  overwrite = true
}

resource "aws_ssm_parameter" "wellfound_email" {
  name      = "/jobpilot/wellfound/email"
  type      = "SecureString"
  value     = var.wellfound_email
  overwrite = true
}

resource "aws_ssm_parameter" "wellfound_password" {
  name      = "/jobpilot/wellfound/password"
  type      = "SecureString"
  value     = var.wellfound_password
  overwrite = true
}

# ── User Profile SSM Parameters (V2)
resource "aws_ssm_parameter" "profile_name" {
  name      = "/jobpilot/profile/name"
  type      = "String"
  value     = var.profile_name != null ? var.profile_name : "Job Seeker"
  overwrite = true
}

resource "aws_ssm_parameter" "profile_role" {
  name      = "/jobpilot/profile/role"
  type      = "String"
  value     = var.profile_role != null ? var.profile_role : "Software Engineer"
  overwrite = true
}

resource "aws_ssm_parameter" "profile_experience" {
  name      = "/jobpilot/profile/experience"
  type      = "String"
  value     = var.profile_experience != null ? var.profile_experience : "2"
  overwrite = true
}

resource "aws_ssm_parameter" "profile_skills" {
  name      = "/jobpilot/profile/skills"
  type      = "String"
  value     = var.profile_skills != null ? var.profile_skills : "JavaScript,Node.js,React,TypeScript"
  overwrite = true
}

resource "aws_ssm_parameter" "profile_location" {
  name      = "/jobpilot/profile/location"
  type      = "String"
  value     = var.profile_location != null ? var.profile_location : "Remote"
  overwrite = true
}

resource "aws_ssm_parameter" "profile_work_arrangement" {
  name      = "/jobpilot/profile/work-arrangement"
  type      = "String"
  value     = var.profile_work_arrangement != null ? var.profile_work_arrangement : "Remote"
  overwrite = true
}

resource "aws_ssm_parameter" "profile_min_salary" {
  name      = "/jobpilot/profile/min-salary"
  type      = "String"
  value     = var.profile_min_salary != null ? var.profile_min_salary : "500000"
  overwrite = true
}

resource "aws_ssm_parameter" "profile_target_roles" {
  name      = "/jobpilot/profile/target-roles"
  type      = "String"
  value     = var.profile_target_roles != null ? var.profile_target_roles : "Software Engineer,Full Stack Developer,Backend Developer"
  overwrite = true
}



# ── DynamoDB Table (25 GB free forever)
resource "aws_dynamodb_table" "applications" {
  name         = "jobpilot-applications"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "jobId"

  attribute {
    name = "jobId"
    type = "S"
  }

  attribute {
    name = "appliedAt"
    type = "S"
  }

  attribute {
    name = "platform"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "foundAt"
    type = "N"
  }

  global_secondary_index {
    name            = "appliedAt-index"
    hash_key        = "appliedAt"
    range_key       = "platform"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "status-foundAt-index"
    hash_key        = "status"
    range_key       = "foundAt"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  tags = { Project = "JobPilot-V2", Cost = "Free" }
}

# ── IAM Role for Scanner Lambda
resource "aws_iam_role" "scanner_role" {
  name = "jobpilot-scanner-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "scanner_policy" {
  role = aws_iam_role.scanner_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem"]
        Resource = aws_dynamodb_table.applications.arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:PutObjectAcl"]
        Resource = "${aws_s3_bucket.dashboard.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters"]
        Resource = "arn:aws:ssm:ap-south-1:*:parameter/jobpilot/*"
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      }
    ]
  })
}

# ── IAM Role for Evaluator Lambda
resource "aws_iam_role" "evaluator_role" {
  name = "jobpilot-evaluator-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "evaluator_policy" {
  role = aws_iam_role.evaluator_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["dynamodb:Query", "dynamodb:Scan", "dynamodb:GetItem", "dynamodb:UpdateItem"]
        Resource = [
          aws_dynamodb_table.applications.arn,
          "${aws_dynamodb_table.applications.arn}/index/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:PutObjectAcl"]
        Resource = "${aws_s3_bucket.dashboard.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters"]
        Resource = "arn:aws:ssm:ap-south-1:*:parameter/jobpilot/*"
      },
      {
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      }
    ]
  })
}

# ── IAM Role for API Lambda
resource "aws_iam_role" "api_role" {
  name = "jobpilot-api-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "api_policy" {
  role = aws_iam_role.api_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["dynamodb:Query", "dynamodb:Scan", "dynamodb:GetItem", "dynamodb:UpdateItem"]
        Resource = [
          aws_dynamodb_table.applications.arn,
          "${aws_dynamodb_table.applications.arn}/index/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      }
    ]
  })
}

# ── IAM Role for Legacy Lambda (kept for backward compatibility)
resource "aws_iam_role" "lambda_role" {
  name = "jobpilot-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  role = aws_iam_role.lambda_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Query", "dynamodb:UpdateItem"]
        Resource = aws_dynamodb_table.applications.arn
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters"]
        Resource = "arn:aws:ssm:ap-south-1:*:parameter/jobpilot/*"
      },
      {
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      }
    ]
  })
}

# ── Lambda Functions (3 separate functions for V2 architecture)

# Scanner Lambda - Scrapes 12 platforms, captures screenshots
resource "aws_lambda_function" "scanner" {
  function_name = "jobpilot-scanner"
  role          = aws_iam_role.scanner_role.arn
  runtime       = "nodejs20.x"
  handler       = "scanner-handler.handler"
  s3_bucket     = aws_s3_bucket.dashboard.id
  s3_key        = "scanner.zip"
  memory_size   = 2048
  timeout       = 900

  ephemeral_storage {
    size = 1024
  }

  environment {
    variables = {
      S3_BUCKET      = aws_s3_bucket.dashboard.id
      DYNAMODB_TABLE = aws_dynamodb_table.applications.name
    }
  }

  tags = { Project = "JobPilot-V2", Function = "Scanner" }
}

# Evaluator Lambda - Evaluates jobs with Gemini AI, generates reports
resource "aws_lambda_function" "evaluator" {
  function_name = "jobpilot-evaluator"
  role          = aws_iam_role.evaluator_role.arn
  runtime       = "nodejs20.x"
  handler       = "evaluator-handler.handler"
  s3_bucket     = aws_s3_bucket.dashboard.id
  s3_key        = "evaluator.zip"
  memory_size   = 1024
  timeout       = 600

  environment {
    variables = {
      S3_BUCKET      = aws_s3_bucket.dashboard.id
      DYNAMODB_TABLE = aws_dynamodb_table.applications.name
    }
  }

  tags = { Project = "JobPilot-V2", Function = "Evaluator" }
}

# API Lambda - Provides REST API for dashboard
resource "aws_lambda_function" "api" {
  function_name = "jobpilot-api"
  role          = aws_iam_role.api_role.arn
  runtime       = "nodejs20.x"
  handler       = "api-handler.handler"
  s3_bucket     = aws_s3_bucket.dashboard.id
  s3_key        = "api.zip"
  memory_size   = 512
  timeout       = 30

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.applications.name
    }
  }

  tags = { Project = "JobPilot-V2", Function = "API" }
}

# Legacy Lambda (kept for backward compatibility)
resource "aws_lambda_function" "jobpilot" {
  function_name = "jobpilot-engine"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "handler.handler"
  s3_bucket     = aws_s3_bucket.dashboard.id
  s3_key        = "lambda.zip"
  memory_size   = 2048
  timeout       = 900

  ephemeral_storage {
    size = 1024
  }

  tags = { Project = "JobPilot" }
}

# ── EventBridge Scheduler IAM Role
resource "aws_iam_role" "scheduler_role" {
  name = "jobpilot-scheduler-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "scheduler_policy" {
  role = aws_iam_role.scheduler_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["lambda:InvokeFunction"]
      Resource = [
        aws_lambda_function.scanner.arn,
        aws_lambda_function.evaluator.arn,
        aws_lambda_function.jobpilot.arn
      ]
    }]
  })
}

# ── EventBridge Scheduler for Scanner (03:30 UTC = 09:00 IST)
resource "aws_scheduler_schedule" "scanner_daily" {
  name = "jobpilot-scanner-daily-09-IST"

  schedule_expression = "cron(30 3 * * ? *)"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.scanner.arn
    role_arn = aws_iam_role.scheduler_role.arn
  }
}

# ── EventBridge Scheduler for Evaluator (03:35 UTC = 09:05 IST, 5 minutes after scanner)
resource "aws_scheduler_schedule" "evaluator_daily" {
  name = "jobpilot-evaluator-daily-0905-IST"

  schedule_expression = "cron(35 3 * * ? *)"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.evaluator.arn
    role_arn = aws_iam_role.scheduler_role.arn
  }
}

# ── Legacy EventBridge Scheduler (kept for backward compatibility)
resource "aws_scheduler_schedule" "daily" {
  name = "jobpilot-daily-09-IST"

  schedule_expression = "cron(30 3 * * ? *)"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.jobpilot.arn
    role_arn = aws_iam_role.scheduler_role.arn
  }
}

# ── S3 Static Dashboard Hosting
resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "dashboard" {
  bucket = "jobpilot-dashboard-${random_id.suffix.hex}"
}

resource "aws_s3_bucket_website_configuration" "dashboard" {
  bucket = aws_s3_bucket.dashboard.id

  index_document {
    suffix = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "dashboard" {
  bucket                  = aws_s3_bucket.dashboard.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "dashboard_public_read" {
  bucket = aws_s3_bucket.dashboard.id

  # Must apply after public access block is configured
  depends_on = [aws_s3_bucket_public_access_block.dashboard]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadGetObject"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.dashboard.arn}/*"
    }]
  })
}

resource "aws_s3_object" "dashboard_html" {
  bucket       = aws_s3_bucket.dashboard.id
  key          = "index.html"
  source       = "${path.module}/index.html"
  content_type = "text/html"
  etag         = filemd5("${path.module}/index.html")
}

resource "aws_s3_object" "dashboard_v2_html" {
  bucket       = aws_s3_bucket.dashboard.id
  key          = "dashboard-v2.html"
  source       = "${path.module}/dashboard-v2.html"
  content_type = "text/html"
  etag         = filemd5("${path.module}/dashboard-v2.html")
}

# S3 Lifecycle Policy - Delete screenshots and reports older than 90 days
resource "aws_s3_bucket_lifecycle_configuration" "dashboard_lifecycle" {
  bucket = aws_s3_bucket.dashboard.id

  rule {
    id     = "delete-old-screenshots"
    status = "Enabled"

    filter {
      prefix = "screenshots/"
    }

    expiration {
      days = 90
    }
  }

  rule {
    id     = "delete-old-reports"
    status = "Enabled"

    filter {
      prefix = "reports/"
    }

    expiration {
      days = 90
    }
  }
}

# ── Outputs
output "dashboard_url" {
  value = "http://${aws_s3_bucket.dashboard.bucket}.s3-website.ap-south-1.amazonaws.com"
}

output "dashboard_v2_url" {
  value = "http://${aws_s3_bucket.dashboard.bucket}.s3-website.ap-south-1.amazonaws.com/dashboard-v2.html"
}

output "lambda_arn" {
  value = aws_lambda_function.jobpilot.arn
}

output "scanner_lambda_arn" {
  value = aws_lambda_function.scanner.arn
}

output "evaluator_lambda_arn" {
  value = aws_lambda_function.evaluator.arn
}

output "api_lambda_arn" {
  value = aws_lambda_function.api.arn
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.applications.name
}

output "s3_bucket_name" {
  value = aws_s3_bucket.dashboard.id
}

# ── Dashboard API IAM Role & Policy
resource "aws_iam_role" "dashboard_api_role" {
  name = "jobpilot-dashboard-api-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "dashboard_api_policy" {
  name = "jobpilot-dashboard-api-policy"
  role = aws_iam_role.dashboard_api_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["dynamodb:Scan", "dynamodb:Query"]
        Resource = [
          aws_dynamodb_table.applications.arn,
          "${aws_dynamodb_table.applications.arn}/index/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      }
    ]
  })
}

# ── Dashboard API Lambda Function (Legacy - kept for backward compatibility)
resource "aws_lambda_function" "dashboard_api" {
  function_name = "jobpilot-dashboard-api"
  role          = aws_iam_role.dashboard_api_role.arn
  runtime       = "nodejs20.x"
  handler       = "dashboard-api.handler"
  memory_size   = 256
  timeout       = 10
  s3_bucket     = aws_s3_bucket.dashboard.id
  s3_key        = "lambda.zip"
}

# ── API Gateway REST API
resource "aws_api_gateway_rest_api" "jobpilot_dashboard_api" {
  name = "jobpilot-dashboard-api"
}

# ── API Gateway Usage Plan for Rate Limiting
resource "aws_api_gateway_usage_plan" "dashboard_api_usage_plan" {
  name = "jobpilot-dashboard-usage-plan"

  api_stages {
    api_id = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
    stage  = aws_api_gateway_stage.prod.stage_name
  }

  throttle_settings {
    burst_limit = 200
    rate_limit  = 100
  }
}

# ── /jobs Resource
resource "aws_api_gateway_resource" "jobs_resource" {
  rest_api_id = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  parent_id   = aws_api_gateway_rest_api.jobpilot_dashboard_api.root_resource_id
  path_part   = "jobs"
}

resource "aws_api_gateway_method" "jobs_get" {
  rest_api_id   = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id   = aws_api_gateway_resource.jobs_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "jobs_get_integration" {
  rest_api_id             = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id             = aws_api_gateway_resource.jobs_resource.id
  http_method             = aws_api_gateway_method.jobs_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

# ── /jobs/{jobId} Resource
resource "aws_api_gateway_resource" "job_id_resource" {
  rest_api_id = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  parent_id   = aws_api_gateway_resource.jobs_resource.id
  path_part   = "{jobId}"
}

resource "aws_api_gateway_method" "job_id_get" {
  rest_api_id   = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id   = aws_api_gateway_resource.job_id_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "job_id_get_integration" {
  rest_api_id             = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id             = aws_api_gateway_resource.job_id_resource.id
  http_method             = aws_api_gateway_method.job_id_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

# ── /jobs/{jobId}/status Resource
resource "aws_api_gateway_resource" "job_status_resource" {
  rest_api_id = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  parent_id   = aws_api_gateway_resource.job_id_resource.id
  path_part   = "status"
}

resource "aws_api_gateway_method" "job_status_put" {
  rest_api_id   = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id   = aws_api_gateway_resource.job_status_resource.id
  http_method   = "PUT"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "job_status_put_integration" {
  rest_api_id             = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id             = aws_api_gateway_resource.job_status_resource.id
  http_method             = aws_api_gateway_method.job_status_put.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

# ── CORS OPTIONS Method for /jobs
resource "aws_api_gateway_method" "jobs_options" {
  rest_api_id   = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id   = aws_api_gateway_resource.jobs_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "jobs_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id = aws_api_gateway_resource.jobs_resource.id
  http_method = aws_api_gateway_method.jobs_options.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "jobs_options_200" {
  rest_api_id = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id = aws_api_gateway_resource.jobs_resource.id
  http_method = aws_api_gateway_method.jobs_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "jobs_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id = aws_api_gateway_resource.jobs_resource.id
  http_method = aws_api_gateway_method.jobs_options.http_method
  status_code = aws_api_gateway_method_response.jobs_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# ── CORS OPTIONS Method for /jobs/{jobId}
resource "aws_api_gateway_method" "job_id_options" {
  rest_api_id   = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id   = aws_api_gateway_resource.job_id_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "job_id_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id = aws_api_gateway_resource.job_id_resource.id
  http_method = aws_api_gateway_method.job_id_options.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "job_id_options_200" {
  rest_api_id = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id = aws_api_gateway_resource.job_id_resource.id
  http_method = aws_api_gateway_method.job_id_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "job_id_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id = aws_api_gateway_resource.job_id_resource.id
  http_method = aws_api_gateway_method.job_id_options.http_method
  status_code = aws_api_gateway_method_response.job_id_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# ── CORS OPTIONS Method for /jobs/{jobId}/status
resource "aws_api_gateway_method" "job_status_options" {
  rest_api_id   = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id   = aws_api_gateway_resource.job_status_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "job_status_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id = aws_api_gateway_resource.job_status_resource.id
  http_method = aws_api_gateway_method.job_status_options.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "job_status_options_200" {
  rest_api_id = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id = aws_api_gateway_resource.job_status_resource.id
  http_method = aws_api_gateway_method.job_status_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "job_status_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  resource_id = aws_api_gateway_resource.job_status_resource.id
  http_method = aws_api_gateway_method.job_status_options.http_method
  status_code = aws_api_gateway_method_response.job_status_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# ── API Gateway Deployment & Stage
resource "aws_api_gateway_deployment" "dashboard" {
  rest_api_id = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  depends_on = [
    aws_api_gateway_integration.jobs_get_integration,
    aws_api_gateway_integration.jobs_options_integration,
    aws_api_gateway_integration.job_id_get_integration,
    aws_api_gateway_integration.job_id_options_integration,
    aws_api_gateway_integration.job_status_put_integration,
    aws_api_gateway_integration.job_status_options_integration
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "prod" {
  rest_api_id   = aws_api_gateway_rest_api.jobpilot_dashboard_api.id
  deployment_id = aws_api_gateway_deployment.dashboard.id
  stage_name    = "prod"
}

resource "aws_lambda_permission" "apigw_dashboard" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.dashboard_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.jobpilot_dashboard_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "apigw_api" {
  statement_id  = "AllowAPIGatewayInvokeAPI"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.jobpilot_dashboard_api.execution_arn}/*/*"
}

# ── Dashboard API URL Output
output "dashboard_api_url" {
  value = "${aws_api_gateway_stage.prod.invoke_url}/jobs"
}
