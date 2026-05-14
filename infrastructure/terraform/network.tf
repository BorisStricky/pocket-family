# Networking: reuse the default VPC + 3 new security groups (one per tier).
#
# Why default VPC? Every AWS account starts with one in every region, so the
# template works without prerequisites. The manual deployment in sa-east-1
# uses the same approach.

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ── ALB security group ──────────────────────────────────────────────────────
# Public ingress on 80 (and 443 for future HTTPS). Egress to anywhere so the
# ALB can reach Fargate targets.

resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb"
  description = "Public HTTP(S) ingress for the ALB"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from anywhere (reserved for future TLS listener)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── Fargate task security group ─────────────────────────────────────────────
# Only the ALB SG may reach port 80 on the task. Egress open so the task can
# pull images from ECR and reach Aurora.

resource "aws_security_group" "fargate" {
  name        = "${var.project_name}-fargate"
  description = "ALB → Fargate task ingress on port 80"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "HTTP from ALB only"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── Aurora security group ───────────────────────────────────────────────────
# Only the Fargate task SG may reach 5432. No public ingress.

resource "aws_security_group" "aurora" {
  name        = "${var.project_name}-aurora"
  description = "Fargate → Aurora 5432 only"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "PostgreSQL from Fargate task"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.fargate.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
