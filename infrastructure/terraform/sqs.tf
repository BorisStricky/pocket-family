# SQS queue used as the Celery broker on AWS.
# Replaces Redis so the import stack has no in-memory cache dependency.
# A dead-letter queue (DLQ) captures tasks that fail after max_receive_count attempts.

resource "aws_sqs_queue" "celery_dlq" {
  name = "${var.project_name}-celery-dlq"
  # Retain failed messages for 14 days — enough time to diagnose import failures.
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "celery" {
  name = "${var.project_name}-celery"

  # Must be >= the Celery task timeout. 30 minutes covers very large CSV imports.
  # The worker acknowledges the message only after the task completes (task_acks_late=True),
  # so the visibility window must exceed the longest possible import duration.
  visibility_timeout_seconds = 1800

  # 4 days — tasks older than this are permanently lost and worth investigating in the DLQ.
  message_retention_seconds = 345600

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.celery_dlq.arn
    maxReceiveCount     = 3
  })
}
