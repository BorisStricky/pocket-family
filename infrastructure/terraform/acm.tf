# Look up the ACM certificate that was issued manually in the Console.
# Terraform reads the ARN at plan time; the cert itself is not managed here.

data "aws_acm_certificate" "main" {
  count       = var.app_domain != "" ? 1 : 0
  domain      = var.app_domain
  types       = ["AMAZON_ISSUED"]
  most_recent = true
  statuses    = ["ISSUED"]
}
