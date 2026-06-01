# ECR repositories for both container images.
#
# Lifecycle policy caps storage growth so the repos stay within (or near)
# the 500 MB free-tier allowance:
#   - keep the 5 most recent tagged images
#   - expire untagged images after 7 days

resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend"
  image_tag_mutability = "MUTABLE" # `latest` overwrites — fine for this stack

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "${var.project_name}-frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

locals {
  ecr_lifecycle_policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images older than 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep only the 5 most recent tagged images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = { type = "expire" }
      }
    ]
  })
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name
  policy     = local.ecr_lifecycle_policy
}

resource "aws_ecr_lifecycle_policy" "frontend" {
  repository = aws_ecr_repository.frontend.name
  policy     = local.ecr_lifecycle_policy
}

resource "aws_ecr_repository" "import_worker" {
  name                 = "${var.project_name}-import-worker"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "import_worker" {
  repository = aws_ecr_repository.import_worker.name
  policy     = local.ecr_lifecycle_policy
}

# Dedicated repo for the CSV-import Lambda container image. Kept separate from
# the import_worker repo so the two image types (Celery worker for local/self-host
# vs. the AWS Lambda handler) stay distinct and their lifecycle/tags don't collide.
resource "aws_ecr_repository" "import_lambda" {
  name                 = "${var.project_name}-import-lambda"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "import_lambda" {
  repository = aws_ecr_repository.import_lambda.name
  policy     = local.ecr_lifecycle_policy
}
