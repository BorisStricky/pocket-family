# Daily demo data reset.
#
# When var.demo_mode is true, this file provisions:
#   1. A second ECS task definition that runs the seed_demo_data.py script
#      using the same backend image but with a different command override.
#   2. An EventBridge rule firing on var.demo_reset_cron (default 06:00 UTC).
#   3. An IAM role EventBridge assumes to call ECS RunTask.
#
# RunTask spins up a Fargate task on demand and tears it down when the script
# exits, so the reset costs only the seconds of compute it actually uses.

# ── Task definition: demo reset (backend image, override command) ────────────

resource "aws_ecs_task_definition" "demo_reset" {
  count = var.demo_mode ? 1 : 0

  family                   = "${var.project_name}-demo-reset"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "demo-reset"
      image     = local.backend_image
      essential = true
      # Override the default uvicorn entrypoint: this task is a one-shot
      # script chain, not a long-running web server. `uv run` so both steps
      # pick up the same locked dependencies as the API.
      #
      # Step 1: `alembic upgrade head` is idempotent — a no-op once schema is
      # at head. Folding it into the daily reset means every demo refresh
      # also applies any new migration, so we don't maintain a separate
      # migration task definition just for the demo environment.
      # Step 2: re-seed the demo tenant.
      command = [
        "sh", "-c",
        "uv run alembic upgrade head && uv run python /app/scripts/seed_demo_data.py"
      ]
      workingDirectory = "/app"
      environment      = local.backend_environment
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "demo-reset"
        }
      }
    }
  ])
}

# ── IAM role assumed by EventBridge to invoke ECS RunTask ────────────────────

data "aws_iam_policy_document" "eventbridge_assume" {
  count = var.demo_mode ? 1 : 0

  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "eventbridge_ecs_invoke" {
  count = var.demo_mode ? 1 : 0

  name               = "${var.project_name}-eventbridge-ecs-invoke"
  assume_role_policy = data.aws_iam_policy_document.eventbridge_assume[0].json
}

data "aws_iam_policy_document" "eventbridge_ecs_invoke" {
  count = var.demo_mode ? 1 : 0

  statement {
    actions   = ["ecs:RunTask"]
    resources = [aws_ecs_task_definition.demo_reset[0].arn]
  }

  # iam:PassRole is required so EventBridge can hand the task its
  # execution + task roles when launching the Fargate task.
  statement {
    actions = ["iam:PassRole"]
    resources = [
      aws_iam_role.task_execution.arn,
      aws_iam_role.task.arn,
    ]
  }
}

resource "aws_iam_role_policy" "eventbridge_ecs_invoke" {
  count = var.demo_mode ? 1 : 0

  name   = "ecs-run-task"
  role   = aws_iam_role.eventbridge_ecs_invoke[0].id
  policy = data.aws_iam_policy_document.eventbridge_ecs_invoke[0].json
}

# ── EventBridge rule + target ────────────────────────────────────────────────

resource "aws_cloudwatch_event_rule" "demo_reset_daily" {
  count = var.demo_mode ? 1 : 0

  name                = "${var.project_name}-demo-reset-daily"
  description         = "Wipes and re-seeds the demo tenant once per day."
  schedule_expression = var.demo_reset_cron
}

resource "aws_cloudwatch_event_target" "demo_reset_daily" {
  count = var.demo_mode ? 1 : 0

  rule     = aws_cloudwatch_event_rule.demo_reset_daily[0].name
  arn      = aws_ecs_cluster.main.arn
  role_arn = aws_iam_role.eventbridge_ecs_invoke[0].arn

  ecs_target {
    task_definition_arn = aws_ecs_task_definition.demo_reset[0].arn
    launch_type         = "FARGATE"
    task_count          = 1

    network_configuration {
      subnets          = data.aws_subnets.default.ids
      security_groups  = [aws_security_group.fargate.id]
      assign_public_ip = true
    }
  }
}
