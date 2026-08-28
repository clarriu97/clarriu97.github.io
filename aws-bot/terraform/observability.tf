# ── Alerting topic ───────────────────────────────────────────────────────
# One SNS topic, subscribed by email. Every alarm below publishes here.

resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ── Log retention ────────────────────────────────────────────────────────
# Without this, Lambda's auto-created log group keeps logs forever — a
# silent, slow-growing cost. Declaring it explicitly also lets Terraform
# manage it (and destroy it on teardown) instead of it being an orphaned
# resource Lambda created on the side.

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.name_prefix}-chat"
  retention_in_days = var.log_retention_days
}

# ── Lambda alarms ────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${local.name_prefix}-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 3
  alarm_description   = "More than 3 Lambda errors in 5 minutes — likely a Bedrock/S3 failure or a bad deploy."
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.chat.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  alarm_name          = "${local.name_prefix}-lambda-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Lambda is being throttled — concurrency limit hit. Usually means abuse or a traffic spike."
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.chat.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration_p90" {
  alarm_name          = "${local.name_prefix}-lambda-duration-p90"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  extended_statistic  = "p90"
  threshold           = var.lambda_timeout_seconds * 1000 * 0.8 # 80% of timeout, in ms
  alarm_description   = "p90 duration is approaching the Lambda timeout — model calls are running slow."
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.chat.function_name
  }
}

# Bedrock has no per-model spend metric exposed to CloudWatch by default;
# invocation count is the leading indicator of cost and of abuse slipping
# past the rate limiter.

resource "aws_cloudwatch_metric_alarm" "bedrock_invocations_spike" {
  alarm_name          = "${local.name_prefix}-bedrock-invocations-spike"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Invocations"
  namespace           = "AWS/Bedrock"
  period              = 3600
  statistic           = "Sum"
  threshold           = var.bedrock_hourly_invocation_alarm_threshold
  alarm_description   = "Unusually high Bedrock invocation volume this hour — check for abuse bypassing the app-level rate limit."
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    ModelId = var.bedrock_model_id
  }
}

# ── Cost control: AWS Budget ────────────────────────────────────────────
# Hard monthly ceiling, independent of anything above going wrong silently.
# Two thresholds: an early warning, and a "this is real" alert.

resource "aws_budgets_budget" "monthly" {
  provider     = aws.us_east_1
  name         = "${local.name_prefix}-monthly"
  budget_type  = "COST"
  limit_amount = var.monthly_budget_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Scoped to this project+environment via the default_tags set on the
  # provider (versions.tf) — every resource here carries Project/Environment.
  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Environment$${var.environment}"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}

# ── Tracing ───────────────────────────────────────────────────────────────
# X-Ray active tracing on the Lambda: lets you see the time breakdown of a
# single request (Bedrock call vs S3 call vs app code) in the AWS console,
# not just aggregate CloudWatch numbers.

resource "aws_iam_role_policy_attachment" "lambda_xray" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}
