---
title: Redis Deep Dive - Message Broker for Pocket Family App
date: 2026-02-09
tags:
  - redis
  - message-queue
  - celery
  - architecture
  - aws
  - pocket-family-app
type: learning-session
duration: 85min
related:
  - "[[Celery]]"
  - "[[AWS SQS]]"
  - "[[Pocket Family App]]"
  - "[[System Architecture]]"
---

# Redis Deep Dive for Pocket Family App

**Session Date:** February 9, 2026  
**Duration:** ~85 minutes  
**Context:** Week 8-9 of Frontend completion roadmap - Queue Deep Dive phase

---

## Executive Summary

Redis is an in-memory data structure store used as a message broker between FastAPI and Celery workers. It solves the problem of background processing by acting as a fast, simple job queue that prevents blocking HTTP requests during long-running operations like CSV imports.

**Key Decisions:**
- **Development:** Use Redis + Celery (Docker Compose)
- **Production:** Migrate to SQS + Lambda for cost savings
- **Future:** Add Redis back for caching if needed

---

## Part 1: The Problem Redis Solves

### The CSV Import Challenge

When a user uploads a CSV file with 1,000 transactions, processing directly in FastAPI creates problems:

**Without background processing:**
```
User clicks "Import" 
    ↓
FastAPI processes ALL 1,000 rows (45 seconds)
    ↓
Response: "Import complete!"
```

**Problems:**
1. **User waits 45 seconds** - Poor UX, staring at loading spinner
2. **HTTP timeout risk** - Most servers timeout after 30 seconds
3. **Server blocked** - That FastAPI worker can't handle other requests
4. **No progress updates** - User doesn't know if it's working or frozen

### The Job Queue Solution

**What's needed:**
- Immediate response to user ("Import started!")
- Process CSV in the background
- Update progress as it runs
- Handle failures gracefully

### Restaurant Kitchen Analogy

Think of Redis like a **restaurant kitchen ticket board:**

- **Waiter (FastAPI)** takes order, writes ticket, hangs it up → responds immediately to customer
- **Kitchen ticket board (Redis)** holds all pending orders
- **Cooks (Celery workers)** grab tickets and complete orders
- **Ticket system** tracks what's done, what's in progress, what failed

---

## Part 2: Redis in Software Architecture

### The Three-Layer Pattern

Modern apps separate concerns into layers:

```
┌─────────────────────┐
│   Request Layer     │ ← FastAPI (handles HTTP requests)
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   Queue Layer       │ ← Redis (stores jobs, passes messages)
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   Worker Layer      │ ← Celery (processes jobs)
└─────────────────────┘
```

**Redis sits in the middle** as the **message broker** - it's the communication channel between your API and your workers.

### Redis Dual Role

Redis acts as **two things simultaneously**:

1. **Job Queue** - Holds pending work
   - FastAPI: "Hey Redis, store this import job"
   - Celery: "Hey Redis, got any jobs for me?"

2. **Result Store** - Tracks job status
   - Celery: "Redis, I'm 50% done with job #123"
   - FastAPI: "Redis, what's the status of job #123?" → "50% complete"

### Why Not PostgreSQL for Queues?

| Concern | PostgreSQL | Redis |
|---------|-----------|-------|
| **Speed** | Disk-based, slower | In-memory, microseconds |
| **Purpose** | Long-term data storage | Temporary messaging |
| **Querying** | Complex SQL queries | Simple key lookups |
| **Polling** | Heavy on DB | Optimized for this |
| **Operations/sec** | ~1,000-10,000 | ~100,000+ |

**Analogy:**
- PostgreSQL is a **librarian** (organized, permanent storage)
- Redis is a **bulletin board** (fast, temporary notes)

---

## Part 3: What is Redis?

### Definition

**Redis = Remote Dictionary Server**

It's an **in-memory data structure store** that acts like a super-fast dictionary (key-value pairs) accessible over the network.

```python
# Think of it like Python's dict, but:
# 1. Stored in RAM (not your app's memory)
# 2. Accessible by multiple processes/servers
# 3. Persists to disk (optional)
# 4. Has expiration/TTL built-in

local_dict = {"job:123": "pending"}  # Dies when process ends
redis_dict = redis.set("job:123", "pending")  # Survives, shared
```

### Core Characteristics

| Aspect | Description |
|--------|-------------|
| **Storage** | RAM (with optional disk backup) |
| **Speed** | Sub-millisecond response time |
| **Data Model** | Key-value pairs with rich data types |
| **Network** | Client-server (like PostgreSQL) |
| **Durability** | Configurable (speed vs safety tradeoff) |

### Redis Data Structures

Redis isn't just "strings" - it has specialized structures:

#### 1. Strings
Simple values
```redis
SET job:123:status "processing"
GET job:123:status → "processing"
```

#### 2. Lists
Ordered collections (perfect for queues!)
```redis
LPUSH queue:imports "job:123"  # Add to left
RPOP queue:imports → "job:123"  # Take from right
```

#### 3. Hashes
Nested key-value (like Python dict)
```redis
HSET job:123 status "processing" progress 45
HGET job:123 progress → "45"
```

#### 4. Sets
Unique items

#### 5. Sorted Sets
Ranked items (leaderboards)

**For Celery:** We mainly use **Lists** (for the job queue) and **Strings** (for results).

---

## Part 4: How Redis Works

### Architecture Overview

```
┌─────────────────────────────────────┐
│       Redis Server Process          │
│                                     │
│  ┌─────────────────────────────┐   │
│  │   In-Memory Data Structures │   │ ← Main storage
│  │   (Hash tables, lists, etc) │   │
│  └─────────────────────────────┘   │
│              │                      │
│  ┌───────────▼──────────────────┐  │
│  │  Network Protocol Handler    │  │ ← Accepts connections
│  │  (TCP on port 6379)          │  │
│  └──────────────────────────────┘  │
│              │                      │
│  ┌───────────▼──────────────────┐  │
│  │  Optional: Persistence       │  │ ← Save to disk
│  │  (RDB snapshots or AOF log)  │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 1. Single-Threaded Event Loop

**Redis uses ONE thread** to process all commands.

**Why it's fast despite being single-threaded:**

```
Traditional multi-threaded server:
Request 1 → Thread 1 (context switching overhead)
Request 2 → Thread 2 (locking overhead)
Request 3 → Thread 3 (coordination complexity)

Redis single-threaded:
Request 1 → Process → Done (50 microseconds)
Request 2 → Process → Done (50 microseconds)
Request 3 → Process → Done (50 microseconds)
```

**Key insights:**
- **No locks needed** - Only one thing happens at a time
- **No context switching** - No thread overhead
- **Operations are so fast** (microseconds) that one thread can handle 100K ops/sec
- **Network I/O is async** - While waiting for network, processes next command

**Limitation:** One slow command blocks everything
```python
# BAD: This blocks Redis for seconds
KEYS * on database with 10 million keys

# GOOD: O(1) operations
GET job:123
LPUSH queue:imports "job:456"
```

### 2. Redis as Network Service in Docker

Redis is **not embedded in your app** - it's a **separate server process** that accepts network connections.

```
┌─────────────────┐         ┌─────────────────┐
│  FastAPI        │         │  Celery Worker  │
│  Container      │         │  Container      │
│                 │         │                 │
│  [Redis Client] │────┐    │  [Redis Client] │
└─────────────────┘    │    └─────────────────┘
                       │              │
                       ▼              ▼
                ┌─────────────────────────┐
                │   Redis Container       │
                │   Port: 6379            │
                │   RAM: Data stored here │
                └─────────────────────────┘
```

**Docker Compose Example:**
```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    # This container has its own RAM allocation
    
  api:
    build: ./backend
    environment:
      REDIS_URL: "redis://redis:6379/0"  # ← Network connection
    depends_on:
      - redis
      
  celery_worker:
    build: ./backend
    command: celery -A app.celery worker
    environment:
      REDIS_URL: "redis://redis:6379/0"  # ← Same Redis, different client
    depends_on:
      - redis
```

**Connection String:**
```python
REDIS_URL = "redis://redis:6379/0"
#                   ↑      ↑    ↑
#                   |      |    └─ Database number (0-15)
#                   |      └────── Port
#                   └──────────── Docker service name (resolves to IP)
```

**Key Point:** When FastAPI crashes and restarts, jobs in Redis remain intact because Redis runs in a separate container.

### 3. Data Structures in RAM

Redis organizes data using **hash tables** as the foundation:

```
Redis Memory Layout:

┌─────────────────────────────────────┐
│  Main Hash Table (Dictionary)       │
│                                     │
│  "job:123" ──────────┬─────────────┐│
│  "job:124" ──────┐   │             ││
│  "queue:imports" │   │   ┌─────────▼┤
│                  │   │   │ String  ││
│                  │   │   │ "pending"││
│                  │   │   └──────────┤│
│                  │   │              ││
│                  │   └───► Hash     ││
│                  │         {status: ││
│                  │    "processing", ││
│                  │    progress: 45} ││
│                  │                  ││
│                  └─────► List       ││
│                          ["job:125",││
│                           "job:126"]││
└─────────────────────────────────────┘
```

**For Celery, the job queue is a List:**
```python
# Celery adds job to queue (left side)
LPUSH celery "task-id-123"

# Worker takes job from queue (right side)
BRPOP celery 1  # Block for 1 second if empty
→ "task-id-123"

# This is a FIFO queue: First In, First Out
```

### 4. Persistence Options

**Redis is in-memory, so restarts = data loss**... unless you configure persistence.

#### RDB (Redis Database) - Snapshots
```
Save entire dataset to disk periodically

save 900 1    # After 900 sec if ≥1 key changed
save 300 10   # After 300 sec if ≥10 keys changed
save 60 10000 # After 60 sec if ≥10,000 keys changed
```

**Pro:** Fast, compact file  
**Con:** Can lose recent data (up to snapshot interval)

#### AOF (Append-Only File) - Transaction Log
```
Log every write command to disk

appendfsync always    # Sync after every command (slowest, safest)
appendfsync everysec  # Sync every second (good balance)
appendfsync no        # Let OS decide (fastest, riskiest)
```

**Pro:** Minimal data loss  
**Con:** Slower, larger files

**For Pocket Family App:** RDB with everysec sync - good balance of speed and safety.

**Why persistence might not matter for Celery:**
- Jobs are temporary anyway
- If Redis restarts, import can be retried
- Job results stored in PostgreSQL eventually

### 5. Job Loss on Worker Crash

**Important:** When a Celery worker does `BRPOP`, Redis **removes the job immediately**.

```
Before:
Queue: ["job:125", "job:124", "job:123"]

Worker: BRPOP celery
Redis removes and returns "job:123"

After:
Queue: ["job:125", "job:124"]  ← job:123 is GONE
Worker has job:123 in memory
```

**If worker crashes:** Job is lost (was in worker's RAM).

**Solution: Acknowledgment Pattern**
```python
# 1. Worker moves job from pending → processing
RPOPLPUSH "queue:pending" "queue:processing"

# 2. Worker does the work

# 3. On success: remove from processing
LREM "queue:processing" 1 "job:123"

# 4. On crash: Job still in processing queue
# Supervisor can detect stale jobs and re-queue them
```

**Celery has this built-in** with:
- `task_acks_late=True`
- `task_reject_on_worker_lost=True`

---

## Part 5: Redis in Pocket Family App

### How Celery Uses Redis

Redis serves **two distinct purposes**:

#### 1. Message Broker (Job Queue)
- **What:** Stores pending jobs
- **Who writes:** FastAPI (when user triggers import)
- **Who reads:** Celery workers (pick up jobs to process)

#### 2. Result Backend (Status Storage)
- **What:** Stores job progress and results
- **Who writes:** Celery workers (update status as they work)
- **Who reads:** FastAPI (when user checks import status)

```
┌──────────────┐
│   FastAPI    │
└───┬──────┬───┘
    │      │
    │ 1    │ 4
    │      │
    ▼      ▼
┌─────────────────┐
│      Redis      │
│                 │
│  Broker: Queue  │ ← Job IDs waiting
│  Backend: State │ ← Job status/results
└─────────────────┘
    │      ▲
    │ 2    │ 3
    │      │
    ▼      │
┌──────────────┐
│Celery Worker │
└──────────────┘

Flow:
1. FastAPI: "Redis, add this job to queue"
2. Worker: "Redis, give me next job"
3. Worker: "Redis, I'm 50% done"
4. FastAPI: "Redis, what's job status?" → "50%"
```

### Configuration

**Environment Variables:**
```bash
# .env file
REDIS_URL=redis://redis:6379/0
```

**Celery Configuration:**
```python
# backend/app/celery_app.py
from celery import Celery

celery = Celery(
    "pocket_family",
    broker="redis://redis:6379/0",      # Where to queue jobs
    backend="redis://redis:6379/0"      # Where to store results
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    
    # Reliability settings
    task_acks_late=True,                 # Acknowledge after completion
    task_reject_on_worker_lost=True,     # Re-queue if worker dies
)
```

### CSV Import Flow with Redis

#### Step 1: User Uploads CSV
```python
# FastAPI endpoint
@router.post("/import")
async def start_import(file: UploadFile, tenant_id: str):
    # Save file to S3
    s3_key = f"{tenant_id}/imports/{uuid4()}.csv"
    await s3.upload(file, s3_key)
    
    # Create job record in PostgreSQL
    job = ImportJob(
        id=str(uuid4()),
        tenant_id=tenant_id,
        status="pending",
        s3_key=s3_key
    )
    db.add(job)
    db.commit()
    
    # Send to Celery (writes to Redis queue)
    process_import.delay(job.id, s3_key, tenant_id)
    # ↑ This writes to Redis: LPUSH celery "task-abc123"
    
    return {"job_id": job.id, "status": "queued"}
```

**Redis state after this:**
```
Queue (broker):
  celery: ["task-abc123"]

Results (backend):
  celery-task-meta-abc123: {
    "status": "PENDING",
    "result": null
  }
```

#### Step 2: Celery Worker Picks Up Job
```python
@celery.task(bind=True)
def process_import(self, job_id: str, s3_key: str, tenant_id: str):
    # Download CSV from S3
    csv_data = s3.download(s3_key)
    rows = parse_csv(csv_data)
    total = len(rows)
    
    for i, row in enumerate(rows):
        # Create transaction in PostgreSQL
        transaction = Transaction(
            tenant_id=tenant_id,
            amount=row["amount"],
            category=row["category"],
        )
        db.add(transaction)
        
        # Update progress in Redis every 10%
        if i % (total // 10) == 0:
            progress = int((i / total) * 100)
            self.update_state(
                state="PROGRESS",
                meta={"current": i, "total": total, "percent": progress}
            )
            # ↑ Writes to Redis: 
            # SET celery-task-meta-abc123 '{"status":"PROGRESS",...}'
    
    db.commit()
    
    # Update job in PostgreSQL
    job = db.query(ImportJob).get(job_id)
    job.status = "completed"
    db.commit()
    
    return {"imported": total}
```

#### Step 3: FastAPI Checks Progress
```python
@router.get("/import/{job_id}/status")
async def get_import_status(job_id: str):
    # Get Celery task result from Redis
    task_result = celery.AsyncResult(job_id)
    # ↑ Does: GET celery-task-meta-abc123 from Redis
    
    return {
        "status": task_result.state,
        "progress": task_result.info.get("percent") if task_result.info else 0,
        "result": task_result.result if task_result.successful() else None
    }
```

### Redis Data During Import

**At 0% (just queued):**
```
Queue: ["task-abc123"]
celery-task-meta-abc123: {"status": "PENDING"}
```

**At 50% (processing):**
```
Queue: []  ← Job removed when worker picked it up
celery-task-meta-abc123: {
  "status": "PROGRESS",
  "result": {"current": 500, "total": 1000, "percent": 50}
}
```

**At 100% (completed):**
```
Queue: []
celery-task-meta-abc123: {
  "status": "SUCCESS",
  "result": {"imported": 1000}
}
```

### Key Redis Operations

| Operation | Purpose | Example |
|-----------|---------|---------|
| `LPUSH` | Add job to queue | Celery queues task |
| `BRPOP` | Get job from queue (blocking) | Worker waits for jobs |
| `SET` | Store result/status | Worker updates progress |
| `GET` | Retrieve result/status | FastAPI checks progress |
| `EXPIRE` | Auto-delete after time | Results expire after 24h |

---

## Part 6: Alternatives to Redis

### Comparison Table

| Feature | Redis | RabbitMQ | AWS SQS | PostgreSQL |
|---------|-------|----------|---------|------------|
| **Speed** | Fastest (in-memory) | Fast | Medium (network) | Slowest (disk) |
| **Persistence** | Optional | Durable queues | Fully durable | Fully durable |
| **Setup Complexity** | Very simple | Complex | Zero (managed) | N/A |
| **Protocol** | Simple | AMQP (complex) | HTTP REST | SQL |
| **Message Routing** | Basic (lists) | Advanced | Basic | Manual |
| **Celery Support** | Native, excellent | Native, excellent | Via kombu | Custom |
| **Cost** | Free (self-hosted) | Free (self-hosted) | Pay per request | Already paying |
| **Best For** | Simple queues, speed | Complex routing | AWS-native apps | Small projects |

### When to Use Each

#### Redis ✓ (Current Choice)
**Use when:**
- Simple job queue needs
- Speed is priority
- Already using Redis for caching
- Celery is your task processor

**Pocket Family App:** Perfect fit
- CSV imports are simple jobs
- Speed matters for UX
- Can tolerate rare job loss (user can retry)

#### RabbitMQ
**Use when:**
- Need guaranteed message delivery
- Complex routing (priority queues, topic exchanges)
- Multiple consumers with different patterns
- Enterprise-grade reliability

**Example:** E-commerce order processing with multiple services

**Why not for you:** Overkill - too complex for simple CSV imports

#### AWS SQS
**Use when:**
- Already on AWS
- Want zero operational overhead
- Need guaranteed delivery
- Don't need super-low latency

**Future consideration:** Migrate in Phase 4 (AWS deployment)

#### PostgreSQL as Queue
**Use when:**
- Very small scale
- Jobs are infrequent
- Don't want another service

**Problems:**
- Slow (disk I/O)
- Lock contention
- Not designed for this use case

**Why not for you:** Anti-pattern for SaaS apps

---

## Production Architecture: SQS + Lambda

### Cost Comparison

#### Redis (ElastiCache) Infrastructure
```
ElastiCache Redis (AWS):
- cache.t3.micro (0.5 GB RAM): ~$12/month
- cache.t3.small (1.6 GB RAM): ~$24/month
- cache.m5.large (6.4 GB RAM): ~$100/month

For your app's queue needs:
- Job queue: ~100 MB
- Results storage: ~500 MB
- Total needed: ~1 GB RAM = $24-50/month

Problem: Paying 24/7 even if queue empty 90% of time
```

#### SQS + Lambda
```
SQS Pricing:
- First 1M requests/month: FREE
- After that: $0.40 per million requests

Lambda Pricing:
- First 1M requests/month: FREE
- First 400,000 GB-seconds compute: FREE

Your app (10,000 imports/month):
- 10,000 × 5 operations = 50,000 requests
- Cost: $0 (under free tier)

Even at 100,000 imports/month: ~$0.40/month
```

### SQS + Lambda Architecture

```
┌─────────┐    ┌─────┐    ┌────────┐
│ FastAPI │───→│ SQS │───→│ Lambda │
│         │    │     │    │(on-demand)│
└─────────┘    └─────┘    └────────┘
```

**Lambda Function:**
```python
# lambda/import_handler.py
def lambda_handler(event, context):
    for record in event['Records']:
        message = json.loads(record['body'])
        
        job_id = message['job_id']
        s3_key = message['s3_key']
        tenant_id = message['tenant_id']
        
        # Download CSV from S3
        csv_data = s3.get_object(Bucket='my-bucket', Key=s3_key)
        
        # Parse and insert transactions
        rows = parse_csv(csv_data)
        
        # Connect to RDS
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cursor = conn.cursor()
        
        for row in rows:
            cursor.execute(
                "INSERT INTO transactions (...) VALUES (...)",
                (tenant_id, row['amount'], ...)
            )
        
        conn.commit()
        conn.close()
        
        # Update job status
        update_job_status(job_id, "completed")
        
        return {"statusCode": 200}
```

### Lambda Limitations

**15-minute timeout:**
- If CSV takes 20 minutes → Lambda times out at 15 minutes
- **Solution:** Batch processing - split large CSVs into chunks

**Cold starts:**
- First import after 15 minutes idle: 1-2 second initialization
- Celery workers (always on): Immediate processing

**Concurrent execution limits:**
- Default: 1000 concurrent Lambdas per region
- If 1000 imports running: New ones queue

### Hybrid Pattern (Best of Both)

Many production systems use **SQS + S3 folders**:

```
User uploads
    ↓
S3/input/ ← File stored
    ↓
S3 Event Notification
    ↓
SQS ← Message: "New file at s3://input/job123.csv"
    ↓
Lambda → Processes → Moves to archive/ or error/
```

**Benefits:**
- ✅ File preserved in S3 (audit trail)
- ✅ Instant notification (SQS)
- ✅ Built-in concurrency (SQS)
- ✅ State tracking (folder location)

---

## File-Based Workflow Pattern

### How It Works

```
S3 Bucket Structure:
my-bucket/
├── input/           ← New uploads land here
├── processing/      ← Worker moves file when starting
├── archive/         ← Successful imports
└── error/           ← Failed imports
```

### Problems with File-Based

#### 1. Race Conditions
```
Worker A lists input/ → Sees job123.csv
Worker B lists input/ → Sees job123.csv (same file!)
Both try to process → DUPLICATE TRANSACTIONS
```

**Queue solution:** SQS visibility timeout prevents this automatically

#### 2. Polling Latency
```
User uploads at 10:00:00
Worker polls at 10:00:05 → Misses it
Worker polls at 10:00:15 → Finds file
Processing starts at 10:00:15

Delay: 15 seconds

With SQS: Worker notified instantly (milliseconds)
```

#### 3. Scaling Complexity
- Need distributed locks (DynamoDB, Redis)
- Complex coordination logic
- Risk of duplicate processing

**SQS:** Built-in coordination, no extra code

### When File-Based Makes Sense

**Use file-based pattern when:**
1. Batch ETL pipelines (data warehousing)
2. Large files (multi-GB)
3. Simple single-worker setups
4. Audit/compliance requirements

**For Pocket Family App:** Queue-based is better for real-time processing

---

## Recommendations for Pocket Family App

### Development Phase (Now - Week 11)
**Use Redis + Celery (Docker Compose)**
- ✅ Simple setup (one Docker container)
- ✅ Fast (sub-millisecond)
- ✅ Native Celery support
- ✅ Industry standard
- ✅ Learn proper patterns

### Production Phase (Week 14 - AWS Deployment)
**Migrate to SQS + Lambda**
- ✅ $0-5/month vs $50/month for Redis
- ✅ Zero operational overhead
- ✅ Auto-scaling
- ✅ Built-in retry and dead-letter queues
- ✅ CloudWatch integration

**Easy migration:**
```python
# From:
broker="redis://redis:6379/0"

# To:
broker="sqs://"
broker_transport_options={
    'region': 'us-east-1',
    'queue_name_prefix': 'pocket-family-'
}
```

### Future (If Needed)
**Add Redis for other purposes:**
- Session storage
- API response caching
- Rate limiting
- Real-time features

**Don't pay for Redis just for job queue when SQS does it for free.**

---

## Architecture Evolution Path

```
Phase 1 (Local Dev):
FastAPI → Redis → Celery
Learn: Message broker patterns

Phase 2 (AWS Launch):
FastAPI → SQS → Lambda
Benefit: $50/month savings, zero ops

Phase 3 (Growth - if needed):
FastAPI → SQS → Lambda
        ↓
     Redis (cache only)
     - Session storage
     - API caching
     - Rate limiting
```

---

## Key Takeaways

### Redis Fundamentals
1. **In-memory data store** - Fast (sub-millisecond) but volatile
2. **Network service** - Separate container, survives app crashes
3. **Single-threaded** - No locks needed, handles 100K+ ops/sec
4. **Rich data types** - Lists for queues, Hashes for objects, Strings for simple values
5. **Optional persistence** - RDB snapshots or AOF logs

### For Your Project
1. **Development:** Redis + Celery teaches industry patterns
2. **Production:** SQS + Lambda saves $50/month with zero ops
3. **Scaling:** Add Redis back for caching when needed
4. **Anti-pattern:** Don't use PostgreSQL as a queue

### Cost Comparison at 10,000 Users
- **Redis (ElastiCache):** ~$50/month + 2-4 hrs engineering time
- **SQS + Lambda:** ~$1/month + 0 hrs engineering time

### When to Choose What
- **Redis:** Need caching + queues, ultra-low latency, very high throughput
- **SQS:** AWS-native, managed, cost-effective at scale
- **RabbitMQ:** Complex routing, maximum reliability
- **PostgreSQL:** Small scale learning projects only (anti-pattern for production)

---

## Next Steps

According to your roadmap (Week 8-9: Queue Deep Dive):

**Week 9 Tasks:**
1. ✅ Understand Redis architecture (completed this session)
2. ⏭️ Implement progress tracking in Celery tasks
3. ⏭️ Add partial failure handling (continue if some rows fail)
4. ⏭️ Add error reporting per row
5. ⏭️ Add import cancellation support

**Documentation Task:**
Create `docs/architecture/import-queue.md` explaining:
- Why async processing for CSV imports?
- How does a row get from CSV to database?
- What happens if import fails midway?
- How is idempotency ensured?

---

## Related Concepts to Explore

- [[Celery]] - Task queue implementation
- [[AWS SQS]] - Managed queue service
- [[Lambda Functions]] - Serverless compute
- [[System Architecture]] - Overall app design
- [[Docker Compose]] - Container orchestration
- [[Message Brokers]] - General patterns

---

## References

- [Redis Official Documentation](https://redis.io/docs/)
- [Celery Documentation](https://docs.celeryq.dev/)
- [AWS SQS Documentation](https://aws.amazon.com/sqs/)
- [AWS Lambda Documentation](https://aws.amazon.com/lambda/)
- Your project: [[Pocket Family App]]
- Your roadmap: [[Learning Plan]]
