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

# ── Worker task role ─────────────────────────────────────────────────────────
# Separate from the backend task role: the worker consumes (not sends) SQS
# and reads/deletes (not writes) S3, applying least-privilege.

resource "aws_iam_role" "worker_task" {
  name               = "${var.project_name}-worker-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "worker_task_execution_managed" {
  role       = aws_iam_role.worker_task.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "worker_rds_connect" {
  statement {
    actions = ["rds-db:connect"]
    resources = [
      "arn:aws:rds-db:${var.aws_region}:${data.aws_caller_identity.current.account_id}:dbuser:${aws_rds_cluster.main.cluster_resource_id}/${var.db_app_user}"
    ]
  }
}

resource "aws_iam_role_policy" "worker_rds_connect" {
  name   = "rds-iam-auth"
  role   = aws_iam_role.worker_task.id
  policy = data.aws_iam_policy_document.worker_rds_connect.json
}

data "aws_iam_policy_document" "worker_sqs_consume" {
  statement {
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueUrl",
      "sqs:ChangeMessageVisibility",
    ]
    resources = [aws_sqs_queue.celery.arn]
  }
}

resource "aws_iam_role_policy" "worker_sqs_consume" {
  name   = "sqs-consume"
  role   = aws_iam_role.worker_task.id
  policy = data.aws_iam_policy_document.worker_sqs_consume.json
}

data "aws_iam_policy_document" "worker_s3_read" {
  statement {
    actions   = ["s3:GetObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.csv_uploads.arn}/*"]
  }
}

resource "aws_iam_role_policy" "worker_s3_read" {
  name   = "s3-csv-read"
  role   = aws_iam_role.worker_task.id
  policy = data.aws_iam_policy_document.worker_s3_read.json
}
