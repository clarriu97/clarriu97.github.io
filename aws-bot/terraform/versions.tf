terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # S3 backend for state — bucket/table created once per AWS account via
  # a bootstrap step (see ../README.md), then wired in here. Left unconfigured
  # until that bootstrap runs; `terraform init` will prompt for backend config.
  backend "s3" {}
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project     = "larri-aws-bot"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# AWS Budgets' API is only reliably available via us-east-1, regardless of
# where the actual resources live — see observability.tf's aws_budgets_budget.
provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = var.aws_profile
}
