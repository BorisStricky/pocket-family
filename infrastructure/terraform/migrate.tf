# One-off database migration task.
#
# Runs `alembic upgrade head` using the same backend image, environment, and roles
# as the API — there is no separate migration image because alembic/env.py imports
# app.models and reuses the Aurora IAM auth path, so the migration needs the backend
# code anyway. Using one image also guarantees the applied migration head and the
# running app code never drift apart.
#
# This is a *task definition* only — nothing runs it on a schedule. It is launched on
# demand (build-and-push.sh runs it after pushing a new image, before the service
# rollout; you can also `aws ecs run-task` it by hand). `alembic upgrade head` is
# idempotent, so re-running it when the DB is already at head is a no-op.
#
# Unlike the demo-reset task (eventbridge.tf), this is NOT gated on demo_mode — every
# deployment needs a way to apply migrations.

resource "aws_ecs_task_definition" "migrate" {
  family                   = "${var.project_name}-migrate"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  # task role carries rds-db:connect for the IAM-mapped DB user — required so Alembic
  # can authenticate to Aurora with a generated IAM token (no static password).
  task_role_arn = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "migrate"
      image     = local.backend_image
      essential = true
      # Override the default uvicorn entrypoint: this is a one-shot command, not a
      # web server. `uv run` so it picks up the same locked deps as the API.
      command = [
        "sh", "-c",
        "uv run alembic upgrade head"
      ]
      workingDirectory = "/app"
      # Reuse the backend environment so DB_INSTANCE=aws_aurora_serverless, DB_HOST,
      # DB_USER, AWS_REGION, etc. are all inherited (alembic/env.py reads these).
      environment = local.backend_environment
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "migrate"
        }
      }
    }
  ])
}
