locals {
  name_prefix = "larri-aws-bot-${var.environment}"
}

data "aws_caller_identity" "current" {}

# ── Rate-limit table (per-IP, minute + day counters) ────────────────────────
# Pay-per-request: no cost when idle. TTL auto-expires old counters instead
# of a cleanup job.

resource "aws_dynamodb_table" "rate_limit" {
  name         = "${local.name_prefix}-rate-limit"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
}

# ── Lambda execution role ───────────────────────────────────────────────────

resource "aws_iam_role" "lambda_exec" {
  name = "${local.name_prefix}-lambda-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_rate_limit_table" {
  name = "${local.name_prefix}-rate-limit-table-access"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:UpdateItem"]
      Resource = aws_dynamodb_table.rate_limit.arn
    }]
  })
}

resource "aws_iam_role_policy" "lambda_bedrock" {
  name = "${local.name_prefix}-bedrock-invoke"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
      Resource = "*" # Bedrock model ARNs don't support account-scoped resource restriction here
    }]
  })
}

# ── Lambda function ──────────────────────────────────────────────────────
# Deployment package is built by ../scripts/build-lambda-package.sh — see
# that script and ../README.md before running `terraform apply` for the
# first time; filename must exist locally or this resource fails to plan.

resource "aws_lambda_function" "chat" {
  function_name = "${local.name_prefix}-chat"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "handler.handler"
  runtime       = "python3.12"
  architectures = ["arm64"] # match your build platform — see README footguns
  timeout       = var.lambda_timeout_seconds

  filename         = "${path.module}/../build/lambda-package.zip"
  source_code_hash = filebase64sha256("${path.module}/../build/lambda-package.zip")

  tracing_config {
    mode = "Active" # X-Ray — see observability.tf
  }

  environment {
    variables = {
      RATE_LIMIT_TABLE     = aws_dynamodb_table.rate_limit.name
      ALLOWED_ORIGINS      = var.allowed_origins
      BEDROCK_MODEL_ID     = var.bedrock_model_id
      AWS_REGION_NAME      = var.aws_region
      TURNSTILE_SECRET_KEY = var.turnstile_secret_key
    }
  }
}

# ── API Gateway (HTTP API) ──────────────────────────────────────────────────

resource "aws_apigatewayv2_api" "chat" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "chat" {
  api_id                 = aws_apigatewayv2_api.chat.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.chat.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "chat" {
  api_id    = aws_apigatewayv2_api.chat.id
  route_key = "POST /chat"
  target    = "integrations/${aws_apigatewayv2_integration.chat.id}"
}

resource "aws_apigatewayv2_route" "health" {
  api_id    = aws_apigatewayv2_api.chat.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.chat.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.chat.id
  name        = "$default"
  auto_deploy = true

  # Belt-and-braces cost cap alongside the DynamoDB rate limiter and the
  # AWS Budget: even if the app-level limiter is ever bypassed, API Gateway
  # itself won't forward more than this many requests per account.
  default_route_settings {
    throttling_rate_limit  = 10
    throttling_burst_limit = 20
  }
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chat.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chat.execution_arn}/*/*"
}
