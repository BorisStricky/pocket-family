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

# All route tables in the default VPC. Needed to associate the S3 gateway VPC
# endpoint below: a gateway endpoint works by injecting a prefix-list route into
# each associated route table, so it must cover every route table the in-VPC
# Lambda's subnets might use.
data "aws_route_tables" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ── S3 gateway VPC endpoint ─────────────────────────────────────────────────
# The CSV import Lambda runs inside the VPC (so it can reach the private Aurora
# cluster), and in-VPC Lambda ENIs get NO public IP. The default subnets have no
# NAT gateway, so without this endpoint the Lambda could not reach S3 to delete
# the processed upload. A *gateway* endpoint routes S3 traffic privately via the
# route tables (no ENI, no hourly cost — gateway endpoints are free), unlike an
# interface endpoint. ECS reaches AWS via assign_public_ip, so it never needed this.
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = data.aws_vpc.default.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"

  # Associate with every route table in the default VPC so all subnets can use it.
  route_table_ids = data.aws_route_tables.default.ids
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
  description = "ALB to Fargate task ingress on port 80"
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
  description = "Fargate to Aurora 5432 only"
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
