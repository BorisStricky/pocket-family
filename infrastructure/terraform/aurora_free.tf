# Aurora Serverless v2 — Free Plan workaround (Express configuration).
#
# ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
# On AWS Free plan accounts (post July 2025), Aurora clusters require
# WithExpressConfiguration=true on the CreateDBCluster API call. That flag is
# NOT yet exposed by the Terraform AWS provider or CloudFormation (verified
# May 2026). On a free-plan account `terraform apply` returns:
#   FreeTierRestrictionError: To use Aurora clusters with free plan accounts
#   you need to set WithExpressConfiguration.
#
# The canonical full-config version lives in aurora.tf.disabled — restore it
# (and disable this file) once the provider supports the Express flag:
#   mv aurora_free.tf aurora_free.tf.disabled && mv aurora.tf.disabled aurora.tf
#
# ── ONE-TIME BOOTSTRAP (cluster cannot be created by Terraform) ─────────────
#   1. RDS Console -> Create database -> Aurora (PostgreSQL) -> "Free plan"
#      template. Match the cluster identifier below. Express config picks its
#      own subnet group, engine version, skips encryption, AND disables VPC
#      networking entirely (Fargate reaches Aurora via the public IAM-auth
#      gateway endpoint, not a VPC SG). That's why several attributes here
#      are either left unset or moved into `ignore_changes`.
#   2. terraform import aws_rds_cluster.main           pocket-family-db
#      terraform import aws_rds_cluster_instance.writer pocket-family-db-instance-1
#   3. terraform apply - only the dependent resources (ECS service, IAM
#      policy, etc.) are touched; the cluster itself is left alone.
# ────────────────────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "aurora" {
  name        = "${var.project_name}-aurora-subnets"
  description = "Subnets for Aurora Serverless cluster (unused under Free plan - Express config picks its own)"
  subnet_ids  = data.aws_subnets.default.ids
}

resource "aws_rds_cluster" "main" {
  cluster_identifier = "${var.project_name}-db"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned" # Serverless v2 uses provisioned mode with serverlessv2_scaling_configuration
  engine_version     = "17.7"        # Version Express config provisioned (Free plan ignores requested version)

  # Express config does NOT accept these - left unset:
  #   database_name          -> create via RDS Query Editor after provision
  #   master_username/pass   -> IAM authentication only
  #   db_subnet_group_name   -> Express picks its own subnet group
  #   storage_encrypted      -> defaults to false under Express; cannot toggle without replacement
  #   vpc_security_group_ids -> Express disables VPC networking; uses a public
  #                             IAM-authenticated gateway endpoint instead. Fargate
  #                             connects via the gateway DNS, not a VPC SG.

  iam_database_authentication_enabled = true

  # Skip the final snapshot for an easy `terraform destroy` — change in production.
  skip_final_snapshot       = true
  final_snapshot_identifier = null

  serverlessv2_scaling_configuration {
    min_capacity = var.min_acu
    max_capacity = var.max_acu
  }

  lifecycle {
    # Attributes managed entirely by Express config / RDS itself - never reconcile.
    ignore_changes = [
      master_password,
      master_username,
      database_name,
      db_subnet_group_name,
      storage_encrypted,
      engine_version,
      vpc_security_group_ids,
    ]
  }
}

# At least one cluster instance is required even for Serverless v2.
resource "aws_rds_cluster_instance" "writer" {
  identifier          = "${var.project_name}-db-instance-1"
  cluster_identifier  = aws_rds_cluster.main.id
  instance_class      = "db.serverless"
  engine              = aws_rds_cluster.main.engine
  engine_version      = aws_rds_cluster.main.engine_version
  publicly_accessible = false

  lifecycle {
    # promotion_tier defaults differ under Express; let RDS manage it.
    ignore_changes = [promotion_tier]
  }
}
