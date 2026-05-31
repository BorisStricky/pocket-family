# Input variables. Sensitive values (passwords, JWT secret) must come from
# terraform.tfvars (not committed) or environment variables (TF_VAR_*).

variable "aws_region" {
  description = "AWS region for all resources. Defaults to us-east-1 to avoid collision with the live sa-east-1 deployment."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name prefix applied to every resource."
  type        = string
  default     = "pocket-family"
}

# ── Database ────────────────────────────────────────────────────────────────

variable "db_name" {
  description = "Initial Aurora database name (created on cluster bootstrap)."
  type        = string
  default     = "pfinancedb"
}

variable "db_master_username" {
  description = "Aurora master username. Used only for initial setup — the app connects as db_app_user via IAM auth."
  type        = string
  default     = "postgres"
}

variable "db_master_password" {
  description = "Aurora master password. Generate with `openssl rand -base64 24`. Used only for initial setup."
  type        = string
  sensitive   = true
}

variable "db_app_user" {
  description = "PostgreSQL role mapped to IAM authentication. Created out-of-band via psql after the cluster is up."
  type        = string
  default     = "pf_iam_app_user"
}

variable "min_acu" {
  description = "Minimum Aurora capacity units. 0 = scale to zero when idle (since Mar 2025)."
  type        = number
  default     = 0
}

variable "max_acu" {
  description = "Maximum Aurora capacity units. 4 = AWS free-plan ceiling."
  type        = number
  default     = 4
}

# ── Application config ──────────────────────────────────────────────────────

variable "jwt_secret" {
  description = "JWT signing secret. Generate with `openssl rand -hex 32`."
  type        = string
  sensitive   = true
}

variable "cors_origins" {
  description = "Comma-separated list of CORS-allowed origins. Leave empty on first apply; set to ALB DNS afterwards and re-apply."
  type        = string
  default     = ""
}

variable "app_domain" {
  description = "Custom domain (e.g. example.com). Derives CORS origins and ALB host-header allow-list. Leave empty to skip ALB filtering."
  type        = string
  default     = ""
}

# ── Container images ────────────────────────────────────────────────────────

variable "image_tag" {
  description = "Docker image tag deployed by the ECS task (matches what build-and-push.sh pushes)."
  type        = string
  default     = "latest"
}

variable "task_cpu" {
  description = "Fargate task CPU units. 512 = 0.5 vCPU."
  type        = string
  default     = "512"
}

variable "task_memory" {
  description = "Fargate task memory in MiB."
  type        = string
  default     = "1024"
}

# ── Observability ───────────────────────────────────────────────────────────

variable "log_retention_days" {
  description = "CloudWatch log retention. 30 days keeps us comfortably within the 5 GB/month always-free allowance."
  type        = number
  default     = 30
}

variable "billing_alarm_thresholds" {
  description = "Dollar amounts at which to alarm against the AWS free credit balance."
  type        = list(number)
  default     = [50, 100, 150]
}

variable "billing_alarm_email" {
  description = "Email address for billing alarm notifications. Leave empty to skip alarm creation."
  type        = string
  default     = ""
}

# ── Demo instance ───────────────────────────────────────────────────────────

variable "demo_mode" {
  description = "When true, this deployment is the public demo: backend disables signup and the EventBridge daily reset rule is created."
  type        = bool
  default     = false
}

# ── Import worker ───────────────────────────────────────────────────────────
# The worker_task_cpu / worker_task_memory variables were removed when the ECS
# Fargate import worker was replaced by an SQS-triggered Lambda (see lambda.tf).
# The Lambda's memory/timeout are set directly in lambda.tf, not via variables.

variable "demo_reset_cron" {
  description = "CloudWatch Events cron expression for the daily demo data reset. AWS cron uses 6 fields (min hour day month day-of-week year). Default 06:00 UTC daily."
  type        = string
  default     = "cron(0 6 * * ? *)"
}
