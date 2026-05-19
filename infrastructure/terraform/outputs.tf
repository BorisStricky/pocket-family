# Outputs surface the values you need for the next steps: pushing images,
# bootstrapping the DB user, and updating CORS_ORIGINS to the ALB DNS.

output "alb_dns_name" {
  description = "Public DNS of the load balancer. Use this for CORS_ORIGINS and to verify in a browser."
  value       = aws_lb.main.dns_name
}

output "ecr_backend_url" {
  description = "Backend ECR repository URI. Pass to build-and-push.sh."
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_url" {
  description = "Frontend ECR repository URI. Pass to build-and-push.sh."
  value       = aws_ecr_repository.frontend.repository_url
}

output "aurora_endpoint" {
  description = "Aurora cluster writer endpoint. Connect to bootstrap the IAM-mapped user."
  value       = aws_rds_cluster.main.endpoint
}

output "aurora_cluster_resource_id" {
  description = "Aurora cluster resource ID (cluster-XXXXXXXX) used in the rds-db:connect IAM policy ARN."
  value       = aws_rds_cluster.main.cluster_resource_id
}

output "ecs_cluster_name" {
  description = "ECS cluster name. Use for force-new-deployment and migrations."
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = aws_ecs_service.main.name
}

output "task_role_arn" {
  description = "ECS task role ARN — confirm rds-db:connect is scoped to this role."
  value       = aws_iam_role.task.arn
}

output "next_steps" {
  description = "Bootstrap commands to run after the first apply."
  value       = <<-EOT

    1. Bootstrap the database and IAM-mapped PostgreSQL user (one-time).
       Aurora Free-plan / Express config is IAM-auth only and skips
       `database_name` — so both the DB and the app user must be created
       manually. Two paths:

       OPTION A — RDS Console → Query Editor (easiest, no CLI):
         a) Console → RDS → Query Editor
         b) Database instance: pocket-family-db-instance-1
         c) Connect with "Connect with a Secrets Manager ARN" (Express stored
            the admin credentials there) OR via temporary credentials.
         d) Run, in this exact order:
              CREATE DATABASE ${var.db_name};
              \\c ${var.db_name}
              CREATE USER ${var.db_app_user};
              GRANT rds_iam TO ${var.db_app_user};
              GRANT USAGE, CREATE ON SCHEMA public TO ${var.db_app_user};
              GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO ${var.db_app_user};
              GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${var.db_app_user};
              ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO ${var.db_app_user};
              ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${var.db_app_user};

       OPTION B — CloudShell + psql with IAM auth token:
         export RDSHOST="${aws_rds_cluster.main.endpoint}"
         export ADMIN_USER="<the admin user Express created — find in Console>"
         export PGPASSWORD=$(aws rds generate-db-auth-token \
           --hostname $RDSHOST --port 5432 \
           --region ${var.aws_region} --username $ADMIN_USER)
         psql "host=$RDSHOST port=5432 dbname=postgres user=$ADMIN_USER sslmode=require" \
           -c "CREATE DATABASE ${var.db_name};"
         # then reconnect to the new DB and run the GRANTs above
         psql "host=$RDSHOST port=5432 dbname=${var.db_name} user=$ADMIN_USER sslmode=require" \
           <<EOSQL
         CREATE USER ${var.db_app_user};
         GRANT rds_iam TO ${var.db_app_user};
         GRANT USAGE, CREATE ON SCHEMA public TO ${var.db_app_user};
         GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO ${var.db_app_user};
         GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${var.db_app_user};
         ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO ${var.db_app_user};
         ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${var.db_app_user};
         EOSQL

    2. Build and push images:

       AWS_REGION=${var.aws_region} AWS_ACCOUNT_ID=${data.aws_caller_identity.current.account_id} \
         ../build-and-push.sh

    3. Set CORS_ORIGINS to the ALB DNS and re-apply:

       cors_origins = "http://${aws_lb.main.dns_name}"

    4. Force a new deployment so the service picks up the new images:

       aws ecs update-service --cluster ${aws_ecs_cluster.main.name} \
         --service ${aws_ecs_service.main.name} --force-new-deployment \
         --region ${var.aws_region}
  EOT
}
