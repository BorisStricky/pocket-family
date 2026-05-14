# CloudWatch log group + free-tier billing alarms.
#
# The 5 GB/month always-free CloudWatch allowance is generous, but a chatty
# app + 30-day retention adds up. Adjust log_retention_days if you exceed.
#
# Billing alarms only spin up if billing_alarm_email is set.

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.project_name}"
  retention_in_days = var.log_retention_days
}

# ── Billing alarms (optional) ───────────────────────────────────────────────
# Billing metrics live in us-east-1 regardless of resource region, so use a
# dedicated provider alias if your stack region differs.

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

resource "aws_sns_topic" "billing" {
  count = var.billing_alarm_email == "" ? 0 : 1

  provider = aws.us_east_1
  name     = "${var.project_name}-billing-alerts"
}

resource "aws_sns_topic_subscription" "billing_email" {
  count = var.billing_alarm_email == "" ? 0 : 1

  provider  = aws.us_east_1
  topic_arn = aws_sns_topic.billing[0].arn
  protocol  = "email"
  endpoint  = var.billing_alarm_email
}

resource "aws_cloudwatch_metric_alarm" "billing" {
  for_each = var.billing_alarm_email == "" ? toset([]) : toset([for t in var.billing_alarm_thresholds : tostring(t)])

  provider            = aws.us_east_1
  alarm_name          = "${var.project_name}-billing-${each.value}usd"
  alarm_description   = "Estimated AWS charges have exceeded $${each.value}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  period              = 21600 # 6 hours — billing metric updates ~every 4-6h
  statistic           = "Maximum"
  threshold           = tonumber(each.value)
  alarm_actions       = [aws_sns_topic.billing[0].arn]

  dimensions = {
    Currency = "USD"
  }
}
