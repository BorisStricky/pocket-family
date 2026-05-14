# Provider version pins.
# Region defaults to us-east-1 (see variables.tf) — keeps this stack distinct
# from the live sa-east-1 manual deployment and the CloudFormation us-east-2 stack.

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "terraform"
      Stack     = "pocket-family-iac"
    }
  }
}
