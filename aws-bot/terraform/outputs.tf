output "api_endpoint" {
  value       = aws_apigatewayv2_api.chat.api_endpoint
  description = "Base URL — chat is at {this}/chat"
}

output "rate_limit_table" {
  value = aws_dynamodb_table.rate_limit.name
}

output "lambda_function_name" {
  value = aws_lambda_function.chat.function_name
}
