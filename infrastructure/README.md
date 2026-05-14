# pocket-family — Infrastructure as Code

Two parallel templates that recreate the AWS deployment described in [docs/aws_hosting_plan.md](../docs/aws_hosting_plan.md):

| Tool | Region | Folder | Why it's here |
|---|---|---|---|
| Terraform | `us-east-1` | [terraform/](terraform/) | Cleaner syntax, `terraform plan` previews diffs, transfers to most jobs |
| CloudFormation | `us-east-2` | [cloudformation/](cloudformation/) | No external tool to install, native AWS console integration |

Different regions are intentional — you can deploy both side-by-side without resource-name collisions, and neither touches the live `sa-east-1` manual deployment.

---

## What gets created (both stacks)

- 2× ECR repositories (`pocket-family-backend`, `pocket-family-frontend`) with lifecycle policies
- ECS Fargate cluster + task definition + service (single task, 0.5 vCPU / 1 GiB)
- Aurora Serverless v2 cluster with **IAM database authentication** (no static password for the app)
- Application Load Balancer (HTTP only — HTTPS deferred until you have a domain)
- 3× Security groups (ALB public, Fargate from ALB, Aurora from Fargate)
- IAM task role with `rds-db:connect` scoped to the IAM-mapped DB user
- IAM task-execution role with the AWS-managed `AmazonECSTaskExecutionRolePolicy`
- CloudWatch log group with 30-day retention

**Cost on AWS Free Plan** (new accounts, July 2025+): runs entirely against the $200 credit and the always-free allowances. Aurora scales to 0 ACU when idle, ECS Fargate ≈ $25/month for one task, ALB fits within 750 free hours/month.

---

## What's NOT in the templates

- **PostgreSQL-level setup** — `CREATE USER pf_iam_app_user; GRANT rds_iam ...` runs out-of-band via psql. See the `next_steps` output after `terraform apply`, or step 3 below.
- **Alembic migrations** — run as a one-off ECS task after the first deploy.
- **HTTPS / ACM certificate** — add a second listener once you own a domain.
- **VPC creation** — both templates use the **default VPC** in the target region.

---

## Quickstart

### Step 1 — Generate secrets (used by either tool)

```bash
export DB_MASTER_PASSWORD=$(openssl rand -base64 24)
export JWT_SECRET=$(openssl rand -hex 32)
```

### Step 2A — Terraform (us-east-1)

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Paste DB_MASTER_PASSWORD and JWT_SECRET into terraform.tfvars

terraform init
terraform plan
terraform apply
```

### Step 2B — CloudFormation (us-east-2)

```bash
cd infrastructure/cloudformation

# Find your default VPC + subnets in us-east-2:
aws ec2 describe-vpcs --region us-east-2 --filters Name=is-default,Values=true \
  --query 'Vpcs[0].VpcId' --output text
aws ec2 describe-subnets --region us-east-2 \
  --filters "Name=vpc-id,Values=<the-vpc-id-above>" \
  --query 'Subnets[].SubnetId' --output text | tr '\t' ','

export VPC_ID=vpc-xxxxxxxx
export SUBNET_IDS=subnet-aaaa,subnet-bbbb,subnet-cccc
./deploy.sh
```

### Step 3 — Bootstrap the IAM-mapped DB user (one time)

The templates leave PostgreSQL-level setup out by design. After the Aurora cluster is up, in AWS CloudShell:

```bash
export RDSHOST="<paste aurora_endpoint output here>"

psql "host=$RDSHOST port=5432 dbname=pfinancedb user=postgres sslmode=require" <<'EOSQL'
CREATE USER pf_iam_app_user;
GRANT rds_iam TO pf_iam_app_user;
GRANT USAGE, CREATE ON SCHEMA public TO pf_iam_app_user;
GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO pf_iam_app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pf_iam_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO pf_iam_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pf_iam_app_user;
EOSQL
```

(psql prompts for the master password you set in step 1.)

### Step 4 — Build and push container images

```bash
# Get your AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Terraform stack (us-east-1)
AWS_REGION=us-east-1 AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID ./infrastructure/build-and-push.sh

# CloudFormation stack (us-east-2)
AWS_REGION=us-east-2 AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID ./infrastructure/build-and-push.sh
```

### Step 5 — Force the service to pull the new images

```bash
# Terraform stack
aws ecs update-service --region us-east-1 --cluster pocket-family \
  --service pocket-family-svc --force-new-deployment

# CloudFormation stack
aws ecs update-service --region us-east-2 --cluster pocket-family \
  --service pocket-family-svc --force-new-deployment
```

### Step 6 — Set CORS_ORIGINS to the ALB DNS

The first apply leaves `CORS_ORIGINS` empty. Get the ALB DNS from the stack output, then re-apply with the value set so the backend allows browser requests from the ALB.

---

## Redeployment

After code changes:

```bash
./infrastructure/build-and-push.sh        # rebuild + push
aws ecs update-service --force-new-deployment ...
```

For infrastructure changes, re-run `terraform apply` or `./deploy.sh`.

---

## Teardown

```bash
# Terraform
cd infrastructure/terraform && terraform destroy

# CloudFormation
aws cloudformation delete-stack --region us-east-2 --stack-name pocket-family
```

Both templates use `skip_final_snapshot = true` / `DeletionPolicy: Delete` on Aurora, so teardown is one command. Change these for production.
