# ECS Fargate cluster, task definition, and service.
#
# Mirrors aws/ecs-task-definition.json from the manual deployment, but with
# all placeholders replaced by Terraform references — no copy/paste needed.

resource "aws_ecs_cluster" "main" {
  name = var.project_name

  setting {
    name  = "containerInsights"
    value = "disabled" # disabled to keep CloudWatch costs near zero
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

# ── Task definition: backend (FastAPI, port 8000) + frontend (nginx, port 80) ──

locals {
  backend_image       = "${aws_ecr_repository.backend.repository_url}:${var.image_tag}"
  frontend_image      = "${aws_ecr_repository.frontend.repository_url}:${var.image_tag}"
  import_worker_image = "${aws_ecr_repository.import_worker.repository_url}:${var.image_tag}"

  # Append the canonical frontend origin when app_domain is configured.
  # Handles empty cors_origins base gracefully.
  cors_origins_computed = var.app_domain != "" ? (
    var.cors_origins != ""
      ? "${var.cors_origins},https://pocket-family-demo.${var.app_domain}"
      : "https://pocket-family-demo.${var.app_domain}"
  ) : var.cors_origins

  backend_environment = [
    { name = "DB_INSTANCE",  value = "aws_aurora_serverless" },
    { name = "DB_HOST",      value = aws_rds_cluster.main.endpoint },
    { name = "DB_PORT",      value = "5432" },
    { name = "DB_USER",      value = var.db_app_user },
    { name = "DB_NAME",      value = var.db_name },
    { name = "AWS_REGION",   value = var.aws_region },
    { name = "JWT_SECRET",   value = var.jwt_secret },
    { name = "TEST_MODE",    value = "0" },
    { name = "DEMO_MODE",    value = var.demo_mode ? "1" : "0" },
    { name = "CORS_ORIGINS", value = local.cors_origins_computed },
    { name = "APP_DOMAIN",        value = var.app_domain },
    # Import service: SQS broker + S3 storage (no RESULT_BACKEND — status is in importjob table)
    { name = "BROKER_URL",        value = "sqs://" },
    { name = "CELERY_DEFAULT_QUEUE", value = aws_sqs_queue.celery.name },
    { name = "STORAGE_BACKEND",   value = "s3" },
    { name = "S3_BUCKET",         value = aws_s3_bucket.csv_uploads.bucket },
    { name = "S3_REGION",         value = var.aws_region },
  ]

  # Environment for the import worker. Mirrors the backend DB vars so the worker
  # can use the same IAM token auth path (DB_INSTANCE=aws_aurora_serverless).
  worker_environment = [
    { name = "DB_INSTANCE",          value = "aws_aurora_serverless" },
    { name = "DB_HOST",              value = aws_rds_cluster.main.endpoint },
    { name = "DB_PORT",              value = "5432" },
    { name = "DB_USER",              value = var.db_app_user },
    { name = "DB_NAME",              value = var.db_name },
    { name = "AWS_REGION",           value = var.aws_region },
    { name = "BROKER_URL",           value = "sqs://" },
    { name = "CELERY_DEFAULT_QUEUE", value = aws_sqs_queue.celery.name },
    { name = "STORAGE_BACKEND",      value = "s3" },
    { name = "S3_BUCKET",            value = aws_s3_bucket.csv_uploads.bucket },
    { name = "S3_REGION",            value = var.aws_region },
  ]
}

resource "aws_ecs_task_definition" "main" {
  family                   = var.project_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = local.backend_image
      essential = true
      cpu       = 256
      portMappings = [{
        containerPort = 8000
        protocol      = "tcp"
      }]
      environment = local.backend_environment
      # python:3.11-slim has no curl — use python's stdlib for the health check.
      healthCheck = {
        command = [
          "CMD-SHELL",
          "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/ping')\" || exit 1"
        ]
        interval    = 15
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }
    },
    {
      name      = "frontend"
      image     = local.frontend_image
      essential = true
      cpu       = 256
      portMappings = [{
        containerPort = 80
        protocol      = "tcp"
      }]
      # frontend waits for backend HEALTHY so nginx never proxies to a dead upstream.
      dependsOn = [{
        containerName = "backend"
        condition     = "HEALTHY"
      }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "frontend"
        }
      }
    }
  ])
}

# ── Service ─────────────────────────────────────────────────────────────────

resource "aws_ecs_service" "main" {
  name            = "${var.project_name}-svc"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.main.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  # Circuit breaker auto-rolls back failed deploys (matched the manual setup
  # before we disabled it for debugging — now safe to re-enable).
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.fargate.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 80
  }

  # The HTTP listener must exist before the service registers targets.
  depends_on = [aws_lb_listener.http]

  lifecycle {
    # `terraform apply` would otherwise reset desired_count every run.
    ignore_changes = [desired_count]
  }
}

# ── Import worker task definition and service ────────────────────────────────
# Persistent Celery worker that processes CSV import tasks from SQS.
# No load balancer — the worker pulls tasks rather than receiving HTTP requests.

resource "aws_ecs_task_definition" "import_worker" {
  family                   = "${var.project_name}-import-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.worker_task_cpu
  memory                   = var.worker_task_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.worker_task.arn

  container_definitions = jsonencode([
    {
      name        = "import-worker"
      image       = local.import_worker_image
      essential   = true
      cpu         = tonumber(var.worker_task_cpu)
      environment = local.worker_environment
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "import-worker"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "import_worker" {
  name            = "${var.project_name}-import-worker-svc"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.import_worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.fargate.id]
    assign_public_ip = true
  }

  # No load_balancer block — the worker pulls tasks from SQS, not HTTP.

  lifecycle {
    ignore_changes = [desired_count]
  }
}
