# IAM: two roles for ECS Fargate.
#
# Execution role: used by the ECS agent itself to pull images and write logs.
# Task role: assumed by the running container — only needs rds-db:connect for IAM DB auth.

data "aws_caller_identity" "current" {}

# ── Trust policy shared by both roles ───────────────────────────────────────

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# ── Execution role ──────────────────────────────────────────────────────────
# The AWS-managed AmazonECSTaskExecutionRolePolicy covers ECR pull + CloudWatch logs.

resource "aws_iam_role" "task_execution" {
  name               = "${var.project_name}-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "task_execution_managed" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ── Task role ───────────────────────────────────────────────────────────────
# Grants rds-db:connect against the IAM-mapped PostgreSQL user.

resource "aws_iam_role" "task" {
  name               = "${var.project_name}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

# Resource ARN format for rds-db:connect:
#   arn:aws:rds-db:<region>:<account>:dbuser:<cluster-resource-id>/<db-user>
data "aws_iam_policy_document" "rds_db_connect" {
  statement {
    actions = ["rds-db:connect"]
    resources = [
      "arn:aws:rds-db:${var.aws_region}:${data.aws_caller_identity.current.account_id}:dbuser:${aws_rds_cluster.main.cluster_resource_id}/${var.db_app_user}"
    ]
  }
}

resource "aws_iam_role_policy" "task_rds_connect" {
  name   = "rds-iam-auth"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.rds_db_connect.json
}

# ── Backend task role additions: SQS dispatch + S3 CSV uploads ───────────────
# The backend API sends tasks to SQS and writes/reads CSV files from S3.

data "aws_iam_policy_document" "backend_sqs_send" {
  statement {
    actions   = ["sqs:SendMessage", "sqs:GetQueueUrl"]
    resources = [aws_sqs_queue.celery.arn]
  }
}

resource "aws_iam_role_policy" "backend_sqs_send" {
  name   = "sqs-send"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.backend_sqs_send.json
}

data "aws_iam_policy_document" "backend_s3_uploads" {
  statement {
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.csv_uploads.arn}/*"]
  }
}

resource "aws_iam_role_policy" "backend_s3_uploads" {
  name   = "s3-csv-uploads"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.backend_s3_uploads.json
}

# ── Import Lambda execution role ─────────────────────────────────────────────
# Replaces the old `worker_task` ECS role. The CSV import worker now runs as an
# SQS-triggered Lambda (see lambda.tf), so its execution role trusts the Lambda
# service rather than ECS tasks. Same least-privilege intent as the old worker:
# read+delete CSVs from S3, connect to Aurora via IAM auth, consume from SQS.

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "import_lambda" {
  name               = "${var.project_name}-import-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# Managed policies:
#   - AWSLambdaBasicExecutionRole: write to CloudWatch Logs.
#   - AWSLambdaVPCAccessExecutionRole: create/delete the ENIs Lambda needs to run
#     inside the VPC (required because it reaches Aurora privately).
resource "aws_iam_role_policy_attachment" "import_lambda_basic" {
  role       = aws_iam_role.import_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "import_lambda_vpc" {
  role       = aws_iam_role.import_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# rds-db:connect for IAM database authentication (same db user as the backend).
data "aws_iam_policy_document" "import_lambda_rds_connect" {
  statement {
    actions = ["rds-db:connect"]
    resources = [
      "arn:aws:rds-db:${var.aws_region}:${data.aws_caller_identity.current.account_id}:dbuser:${aws_rds_cluster.main.cluster_resource_id}/${var.db_app_user}"
    ]
  }
}

resource "aws_iam_role_policy" "import_lambda_rds_connect" {
  name   = "rds-iam-auth"
  role   = aws_iam_role.import_lambda.id
  policy = data.aws_iam_policy_document.import_lambda_rds_connect.json
}

# S3: the handler reads the uploaded CSV and deletes it after a successful import.
data "aws_iam_policy_document" "import_lambda_s3" {
  statement {
    actions   = ["s3:GetObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.csv_uploads.arn}/*"]
  }
}

resource "aws_iam_role_policy" "import_lambda_s3" {
  name   = "s3-csv-read"
  role   = aws_iam_role.import_lambda.id
  policy = data.aws_iam_policy_document.import_lambda_s3.json
}

# SQS: REQUIRED on the function's execution role for an SQS event source mapping.
#
# NOTE / DEVIATION FROM PLAN: the plan (B4) says "No SQS policy on the function
# role" — reasoning that the Lambda *service* polls SQS. That reasoning is wrong
# for SQS event source mappings: AWS requires the *function's execution role* to
# grant sqs:ReceiveMessage, sqs:DeleteMessage, and sqs:GetQueueAttributes on the
# source queue. The Lambda service assumes THIS role to poll/delete on the
# function's behalf; without these permissions the event source mapping reports
# "PROBLEM: Function call failed" / cannot poll and no messages are delivered.
# See AWS docs: "Using Lambda with Amazon SQS" → execution role permissions.
data "aws_iam_policy_document" "import_lambda_sqs" {
  statement {
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
    ]
    resources = [aws_sqs_queue.celery.arn]
  }
}

resource "aws_iam_role_policy" "import_lambda_sqs" {
  name   = "sqs-consume"
  role   = aws_iam_role.import_lambda.id
  policy = data.aws_iam_policy_document.import_lambda_sqs.json
}
