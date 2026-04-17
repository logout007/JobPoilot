# ── Outputs
output "dashboard_url" {
  value = "http://${aws_s3_bucket.dashboard.bucket}.s3-website.ap-south-1.amazonaws.com"
}

output "dashboard_v2_url" {
  value = "http://${aws_s3_bucket.dashboard.bucket}.s3-website.ap-south-1.amazonaws.com/dashboard-v2.html"
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

output "api_gateway_url" {
  value = "https://${aws_api_gateway_rest_api.jobpilot_dashboard_api.id}.execute-api.ap-south-1.amazonaws.com/${aws_api_gateway_stage.prod.stage_name}"
}
