# Application Load Balancer in front of the Fargate service.
#
# HTTP only — HTTPS deferred until a custom domain + ACM certificate exists.
# The free-tier covers 750 ALB-hours/month (one ALB 24/7 = 720h, fits).

resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = data.aws_subnets.default.ids

  # Disable deletion protection so `terraform destroy` works without manual steps.
  enable_deletion_protection = false
}

resource "aws_lb_target_group" "frontend" {
  name        = "${var.project_name}-frontend"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip" # required for Fargate awsvpc networking

  health_check {
    path                = "/"
    matcher             = "200"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  # Drain connections quickly during deploys so rolling updates are responsive.
  deregistration_delay = 30
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  # Reject requests that don't match any listener rule — blocks direct ALB DNS
  # access and unwanted scanners. The host_filter rule below is the only allowed path.
  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not found"
      status_code  = "403"
    }
  }
}

# Forward requests whose Host header belongs to the custom domain and its subdomains.
# count = 0 when app_domain is unset, making this a no-op in vanilla deployments.
resource "aws_lb_listener_rule" "host_filter" {
  count        = var.app_domain != "" ? 1 : 0
  listener_arn = aws_lb_listener.http.arn
  priority     = 100

  condition {
    host_header {
      values = [var.app_domain, "*.${var.app_domain}"]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}
