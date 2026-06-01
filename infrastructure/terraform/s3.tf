# S3 bucket for temporary CSV upload storage.
# The import worker reads the file after the task is dispatched, then deletes it on success.
# The lifecycle rule is a safety net: any object not deleted within 1 day is auto-expired
# (guards against files abandoned by failed imports where cleanup was skipped).

resource "aws_s3_bucket" "csv_uploads" {
  bucket = "${var.project_name}-csv-uploads"
  # Allows terraform destroy to succeed even when orphaned objects remain
  # (e.g. a CSV left behind by a failed import).
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "csv_uploads" {
  bucket = aws_s3_bucket.csv_uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "csv_uploads" {
  bucket = aws_s3_bucket.csv_uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "csv_uploads" {
  bucket = aws_s3_bucket.csv_uploads.id

  rule {
    id     = "expire-uploads"
    status = "Enabled"

    # Empty filter = apply to every object in the bucket. Required by the
    # provider: a rule must specify exactly one of `filter` or `prefix`, or it
    # warns now and errors in a future provider version.
    filter {}

    expiration {
      days = 1
    }
  }
}
