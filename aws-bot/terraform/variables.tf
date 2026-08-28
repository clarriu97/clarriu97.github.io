variable "aws_region" {
  type        = string
  default     = "eu-west-1"
  description = "Must be a region with Bedrock Nova access — check availability before changing."
}

variable "aws_profile" {
  type        = string
  default     = null
  description = "Named AWS CLI profile to use locally. Leave null in CI (OIDC-assumed role has no profile)."
}

variable "environment" {
  type        = string
  default     = "prod"
  description = "Single-environment project — no Terraform workspaces. Only override for an ad-hoc scratch stack."
}

variable "allowed_origins" {
  type        = string
  default     = "https://larri.dev,http://localhost:4321"
  description = "Comma-separated CORS origins, forwarded to the Lambda as an env var."
}

variable "bedrock_model_id" {
  type        = string
  default     = "eu.amazon.nova-lite-v1:0"
  description = "Bedrock inference-profile model ID. Requires model access granted in the AWS console first."
}

variable "lambda_timeout_seconds" {
  type        = number
  default     = 15
  description = "Default Lambda timeout (3s) is too short for a model call — see aws-bot/README.md footguns."
}

variable "alert_email" {
  type        = string
  description = "Where CloudWatch alarms and budget notifications go. Required — no default on purpose."
}

variable "log_retention_days" {
  type        = number
  default     = 30
  description = "CloudWatch log retention for the Lambda's log group. Unset, logs are kept forever (cost)."
}

variable "bedrock_hourly_invocation_alarm_threshold" {
  type        = number
  default     = 100
  description = "Fires if Bedrock invocations in a single hour exceed this — signals abuse past the app-level rate limit."
}

variable "monthly_budget_usd" {
  type        = number
  default     = 10
  description = "Hard monthly cost ceiling. Alerts at 50% actual, 100% actual, 100% forecasted."
}

variable "turnstile_secret_key" {
  type        = string
  sensitive   = true
  description = "Same Turnstile secret already used by the Cloudflare Worker (worker/README.md) — one widget, two backends."
}
