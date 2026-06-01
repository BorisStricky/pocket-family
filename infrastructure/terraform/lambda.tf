# CSV import worker as an SQS-triggered Lambda.
#
# This replaces the always-on ECS Fargate Celery worker (removed in ecs.tf). The
# backend still dispatches with celery_client.send_task(...) to the same SQS queue;
# only the consumer changed. The Lambda handler decodes the Celery/kombu envelope
# and calls the shared process_import() core. Lambda scales to zero when idle, so
# there is no 24/7 cost for a queue that is empty almost all the time.

locals {
  # Derive the Lambda environment from the canonical worker_environment list
  # (defined in ecs.tf) by removing keys the Lambda must not / does not need:
  #   - BROKER_URL / CELERY_DEFAULT_QUEUE: the Lambda does not run Celery; the
  #     SQS event source mapping (below) feeds it messages directly.
  #   - AWS_REGION: this is a RESERVED Lambda runtime environment variable. AWS
  #     injects it automatically and rejects any attempt to set it in the
  #     function's `environment` block (apply would fail with "Lambda was unable
  #     to configure your environment variables because the environment variables
  #     you have provided contains reserved keys"). The app's db.py reads
  #     AWS_REGION from os.environ, which the Lambda runtime populates — so
  #     omitting it here is correct, not a regression.
  lambda_excluded_env_keys = ["BROKER_URL", "CELERY_DEFAULT_QUEUE", "AWS_REGION"]

  # aws_lambda_function.environment wants a flat map { KEY = value }, whereas
  # worker_environment is a list of { name, value } (the ECS container format).
  # Convert + filter in one comprehension.
  import_lambda_environment = {
    for pair in local.worker_environment :
    pair.name => pair.value
    if !contains(local.lambda_excluded_env_keys, pair.name)
  }
}

# Dedicated log group so we control retention (matches the ECS log retention var)
# and so the group exists with the expected name before the first invocation.
resource "aws_cloudwatch_log_group" "import_lambda" {
  name              = "/aws/lambda/${var.project_name}-import"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "import" {
  function_name = "${var.project_name}-import"
  role          = aws_iam_role.import_lambda.arn

  # Container-image Lambda: psycopg2 is a native dependency, so building it in a
  # Linux image (reusing the ECR + uv pipeline) avoids manylinux/zip gymnastics.
  package_type = "Image"
  image_uri    = "${aws_ecr_repository.import_lambda.repository_url}:${var.image_tag}"

  # 300s ≤ the SQS 1800s visibility timeout (with the 6x margin AWS requires:
  # 6 * 300 = 1800), so no SQS change is needed. 512 MB matches the old worker.
  timeout     = 300
  memory_size = 512

  # NOTE: we intentionally do NOT set reserved_concurrent_executions. Concurrency
  # is capped at the SQS event source mapping instead (scaling_config.
  # maximum_concurrency below), which protects Aurora's connection count without
  # carving capacity out of the account's reserved pool. Reserving here fails on
  # accounts with a low total concurrency limit ("decreases UnreservedConcurrent
  # Execution below its minimum value of [10]"), and the mapping-level cap is the
  # right knob for an SQS-driven function anyway.

  # NO vpc_config — the Lambda runs OUTSIDE the VPC, and that is deliberate.
  #
  # The Aurora "Free plan / Express" cluster (aurora_free.tf) has VPC networking
  # DISABLED: it is reachable only over a PUBLIC IAM-authenticated gateway
  # endpoint (the `*.apgpxy.*.rdsrelay.aws.dev` relay), not via a private in-VPC
  # ENI or a security group. The ECS backend connects to it over the public
  # endpoint precisely because its tasks get a public IP (assignPublicIp=ENABLED).
  #
  # A VPC-attached Lambda gets NO public IP and there is no NAT gateway in this
  # (default) VPC, so attaching the function to the VPC left it with no route to
  # Aurora's public endpoint — every connection timed out after 30s. Running the
  # Lambda WITHOUT a vpc_config gives it AWS-managed internet egress, so it reaches
  # both the public Aurora endpoint (like Fargate) and S3 directly. No SG is
  # needed because Aurora's relay authenticates with IAM + TLS, not a VPC SG. The
  # S3 gateway endpoint (network.tf) is consequently unused by this function.

  environment {
    variables = local.import_lambda_environment
  }

  # Ensure the log group exists (and is owned by Terraform with our retention)
  # before the function can write to it. No VPC-access role dependency: the
  # function is not in a VPC, so AWSLambdaVPCAccessExecutionRole is not required.
  depends_on = [
    aws_cloudwatch_log_group.import_lambda,
    aws_iam_role_policy_attachment.import_lambda_basic,
  ]
}

# SQS event source mapping: the Lambda service polls the Celery broker queue and
# invokes the function per message. batch_size = 1 means one import job per
# invocation, matching the old task_acks_late semantics — an unhandled exception
# makes the whole batch (the single message) visible again, so SQS retries and,
# after maxReceiveCount (3, in sqs.tf), routes it to the DLQ. No SQS change needed.
resource "aws_lambda_event_source_mapping" "import" {
  event_source_arn = aws_sqs_queue.celery.arn
  function_name    = aws_lambda_function.import.arn
  batch_size       = 1

  scaling_config {
    maximum_concurrency = 5
  }

  # The execution role's sqs:ReceiveMessage/DeleteMessage/GetQueueAttributes
  # (iam.tf) must exist before the mapping is created, or AWS rejects it.
  depends_on = [aws_iam_role_policy.import_lambda_sqs]
}
