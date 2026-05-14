# AWS Hosting Plan

## Overview

The pocket-family app is hosted on AWS using:
- **AWS Fargate** (ECS) — runs both the frontend (nginx + React) and backend (FastAPI) containers in a single task
- **AWS Aurora Serverless v2** — managed PostgreSQL-compatible database with IAM authentication
- **Application Load Balancer (ALB)** — routes public traffic to the Fargate task
- **Amazon ECR** — stores Docker images for both services

---

## Architecture

```
Internet
    │
    ▼
Application Load Balancer (port 80 / 443)
    │
    ▼
ECS Fargate Task (awsvpc network mode)
┌──────────────────────────────────────────────┐
│                                              │
│  frontend container (nginx, port 80)         │
│  ┌─────────────────────────────────────┐     │
│  │  /api/* → localhost:8000 (proxy)    │     │
│  │  /*     → React SPA (static files) │     │
│  └─────────────────────────────────────┘     │
│               ↕ localhost                    │
│  backend container (FastAPI, port 8000)      │
│                                              │
└──────────────────────────────────────────────┘
                    │
                    ▼
            AWS Aurora Serverless
            (private subnet, port 5432)
```

### Key networking fact

Fargate uses `awsvpc` network mode. All containers in the same task share a single network namespace — they communicate via `localhost`, not Docker service names. This is why [frontend/nginx.aws.conf](../frontend/nginx.aws.conf) proxies to `http://localhost:8000/` instead of `http://backend:8000/` (which only works in local docker-compose).

---

## Repository Files for AWS

| File | Purpose |
|---|---|
| `frontend/nginx.aws.conf` | Fargate nginx config — proxies `/api/` to `localhost:8000` |
| `frontend/nginx.conf` | Local docker-compose nginx config — keep unchanged |
| `frontend/Dockerfile` | Accepts `--build-arg NGINX_CONF=nginx.aws.conf` to select config |
| `aws/ecs-task-definition.json` | ECS task definition template |
| `.env.aws.production.example` | Template for AWS Aurora Serverless environment variables |
| `.env.production.example` | Template for local/traditional production environment variables |

---

## Step 1 — AWS Infrastructure Setup

### 1a. Create an ECR repository for each image
 - [x] Done - created one ECR repo for both images

```bash
aws ecr create-repository --repository-name pocket-family-backend --region <AWS_REGION>
aws ecr create-repository --repository-name pocket-family-frontend --region <AWS_REGION>
```

### 1b. Create an Aurora Serverless v2 cluster
 - [x] Done - db details in the env file

- Engine: Aurora PostgreSQL-Compatible (Serverless v2)
- Engine version: PostgreSQL 15.x compatible
- DB name: `pfinancedb`
- Master username: `postgres`
- Master password: strong random password (used only for initial setup, not by the app)
- **Enable IAM database authentication**: yes (critical — the app uses IAM tokens instead of passwords)
- Capacity range: 0.5 - 4 ACU (adjust based on load)
- VPC: same VPC as your Fargate cluster
- Subnet group: private subnets (no public access)
- Security group: allow inbound port 5432 **only from the Fargate task security group**

Note the **cluster writer endpoint** after creation — it looks like:
```
pocket-family-db.cluster-xxxxxxxxxx.us-east-1.rds.amazonaws.com
```

### 1b-ii. Create an IAM-mapped database user
 - [x] Done

Connect to the Aurora cluster using the CloudShell, and pasting the connection guide from the console
```bash
export RDSHOST="pocket-family-demo.cluster-cxq82mmaurbx.sa-east-1.rds.amazonaws.com" 
psql "host=$RDSHOST port=5432 dbname=postgres user=postgres sslmode=require password=$(aws rds generate-db-auth-token --hostname $RDSHOST --port 5432 --username postgres --region sa-east-1)"
```
 and create a user for IAM auth:


```sql
-- Create the application user mapped to IAM authentication
CREATE USER pf_iam_app_user;
GRANT rds_iam TO pf_iam_app_user;

-- Grant permissions the app needs
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pf_iam_app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pf_iam_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO pf_iam_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO pf_iam_app_user;
```

### 1b-iii. Create the ECS task IAM role

- [X] Created the policy with the following:
The ECS task role (separate from the execution role) needs `rds-db:connect` permission so the backend can generate IAM auth tokens:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "rds-db:connect",
      "Resource": "arn:aws:rds-db:<AWS_REGION>:<AWS_ACCOUNT_ID>:dbuser:<CLUSTER_RESOURCE_ID>/iam_app_user"
    }
  ]
}
```

- [X] Done

Find `<CLUSTER_RESOURCE_ID>` in the RDS console under the cluster's "Configuration" tab (looks like `cluster-XXXXXXXXXXXXXXXXXXXXXXXXXX`).

```bash
# Create the task role
aws iam create-role --role-name pocketFamilyTaskRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach the RDS IAM auth policy
aws iam put-role-policy --role-name pocketFamilyTaskRole \
  --policy-name aurora-iam-auth \
  --policy-document file://aurora-iam-policy.json
```

### 1c. Create a CloudWatch log group

- [X]
```bash
aws logs create-log-group --log-group-name /ecs/pocket-family --region <AWS_REGION>
```

### 1d. Create an ECS cluster
 - [X] 
```bash
aws ecs create-cluster --cluster-name pocket-family --capacity-providers FARGATE
```

### 1e. Create an Application Load Balancer
- [X] Done

- Scheme: Internet-facing
- Listeners: port 80 (add HTTPS/443 + ACM certificate when you have a domain)
- Target group: IP type, port 80, health check path `/` (the React index.html)
- VPC: same as Fargate

---

## Step 2 — Build and Push Docker Images

```bash
# Log in to ECR
aws ecr get-login-password --region <AWS_REGION> \
  | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com

# Build frontend — select Fargate nginx config at build time
docker build -t pocket-family-frontend ./frontend \
  --build-arg NGINX_CONF=nginx.aws.conf \
  --build-arg VITE_API_URL=/api

# Build backend
docker build -t pocket-family-backend ./backend --file backend/api/Dockerfile

# Tag and push
docker tag pocket-family-frontend:latest \
  <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/pocket-family-frontend:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/pocket-family-frontend:latest

docker tag pocket-family-backend:latest \
  <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/pocket-family-backend:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/pocket-family-backend:latest
```

---

## Step 3 — Configure the Task Definition

Edit `aws/ecs-task-definition.json` and replace every `<PLACEHOLDER>`:

| Placeholder | Value |
|---|---|
| `<AWS_ACCOUNT_ID>` | Your 12-digit AWS account ID |
| `<AWS_REGION>` | e.g. `us-east-1` |
| `<DB_HOST>` | Aurora cluster writer endpoint from Step 1b |
| `<DB_USER>` | IAM-mapped database user from Step 1b-ii (e.g. `iam_app_user`) |
| `<JWT_SECRET>` | Output of `openssl rand -hex 32` |
| `<ALB_OR_DOMAIN>` | ALB DNS name or custom domain (used for `CORS_ORIGINS`) |

Register the task definition:

```bash
aws ecs register-task-definition --cli-input-json file://aws/ecs-task-definition.json
```

---

## Step 4 — Create the ECS Service

```bash
aws ecs create-service \
  --cluster pocket-family \
  --service-name pocket-family-svc \
  --task-definition pocket-family \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[<subnet-id-1>,<subnet-id-2>],
    securityGroups=[<fargate-sg-id>],
    assignPublicIp=ENABLED
  }" \
  --load-balancers "targetGroupArn=<target-group-arn>,containerName=frontend,containerPort=80"
```

---

## Step 5 — Run Database Migrations

Run Alembic migrations as a one-off ECS task (do this once after first deploy, and again after schema changes):

```bash
aws ecs run-task \
  --cluster pocket-family \
  --task-definition pocket-family \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[<subnet-id-1>],
    securityGroups=[<fargate-sg-id>],
    assignPublicIp=ENABLED
  }" \
  --overrides '{
    "containerOverrides": [{
      "name": "backend",
      "command": ["uv", "run", "alembic", "upgrade", "head"]
    }]
  }'
```

---

## Step 6 — Verify

1. Open the ALB DNS name in a browser — you should see the React login page
2. Open DevTools → Network tab and check that `/api/ping` returns `{"ok":true}`
3. Create an account and log in to confirm the full auth flow works

**Troubleshooting:**

| Symptom | Likely cause |
|---|---|
| CORS error in browser | `CORS_ORIGINS` env var doesn't match the URL in the address bar (check port, http vs https) |
| `502 Bad Gateway` from nginx | Backend container failed to start — check ECS task logs in CloudWatch (`/ecs/pocket-family`) |
| Database connection error in backend logs | RDS security group not allowing inbound 5432 from Fargate security group |
| Blank page, no React app | Frontend image built with wrong `VITE_API_URL` — rebuild with `--build-arg VITE_API_URL=/api` |

---

## Redeployment (after code changes)

```bash
# 1. Rebuild and push updated images (same commands as Step 2)

# 2. Force ECS to pull the new images
aws ecs update-service \
  --cluster pocket-family \
  --service pocket-family-svc \
  --force-new-deployment
```

---

## Environment Variables Reference

| Variable | Where it lives | Value |
|---|---|---|
| `DB_INSTANCE` | ECS task definition (backend env) | `aws_aurora_serverless` |
| `DB_HOST` | ECS task definition (backend env) | Aurora cluster writer endpoint |
| `DB_PORT` | ECS task definition (backend env) | `5432` |
| `DB_USER` | ECS task definition (backend env) | IAM-mapped user (e.g. `iam_app_user`) |
| `DB_NAME` | ECS task definition (backend env) | `pfinancedb` |
| `AWS_REGION` | ECS task definition (backend env) | e.g. `us-east-1` |
| `JWT_SECRET` | ECS task definition (backend env) | 64-char hex string — `openssl rand -hex 32` |
| `TEST_MODE` | ECS task definition (backend env) | `0` (always in production) |
| `CORS_ORIGINS` | ECS task definition (backend env) | ALB DNS name or custom domain |
| `VITE_API_URL` | Docker build ARG (baked into JS bundle) | `/api` — do not change |

> `DB_INSTANCE=aws_aurora_serverless` tells the backend to use IAM database authentication via boto3. No static `DATABASE_URL` or `DB_PASSWORD` is needed — the backend generates short-lived IAM auth tokens automatically on each new connection.

> `VITE_API_URL` is a **build-time** argument baked into the JavaScript bundle by Vite. It cannot be injected at runtime. Always pass it as `--build-arg VITE_API_URL=/api` when building the frontend image.
