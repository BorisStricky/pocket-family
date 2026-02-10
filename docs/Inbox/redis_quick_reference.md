---
title: Redis Quick Reference - Pocket Family App
date: 2026-02-09
tags:
  - redis
  - quick-reference
  - cheatsheet
  - pocket-family-app
type: quick-reference
related:
  - "[[Redis Deep Dive]]"
  - "[[Celery]]"
---

# Redis Quick Reference

**TL;DR:** In-memory key-value store used as message broker between FastAPI and Celery workers.

---

## What Problem Does It Solve?

**Without Redis:**
```
User uploads CSV → FastAPI blocks for 45 seconds → User waits → Timeout risk
```

**With Redis:**
```
User uploads CSV → FastAPI queues job in Redis → Returns immediately
                           ↓
                    Celery worker processes in background
```

---

## Architecture Position

```
FastAPI (Request) → Redis (Queue) → Celery (Worker)
```

**Redis serves two roles:**
1. **Broker** - Stores pending jobs
2. **Backend** - Stores job status/results

---

## Core Characteristics

| Aspect | Value |
|--------|-------|
| **Storage** | RAM (in-memory) |
| **Speed** | Sub-millisecond |
| **Threading** | Single-threaded |
| **Network** | TCP port 6379 |
| **Durability** | Optional (configurable) |
| **Max throughput** | 100K+ ops/sec |

---

## Essential Commands

### Queue Operations (for Celery)
```redis
# Add job to queue (left side)
LPUSH celery "task-id-123"

# Worker takes job (right side, blocking)
BRPOP celery 1
→ "task-id-123"

# Result: FIFO queue (First In, First Out)
```

### Key-Value Operations
```redis
# Set/Get simple values
SET job:123:status "processing"
GET job:123:status → "processing"

# Set with expiration (24 hours)
SETEX job:123:result 86400 '{"imported": 1000}'

# Check if key exists
EXISTS job:123 → 1 (exists) or 0 (doesn't exist)

# Delete key
DEL job:123
```

### Hash Operations
```redis
# Store structured data
HSET job:123 status "processing" progress 45
HGET job:123 progress → "45"
HGETALL job:123 → {"status": "processing", "progress": "45"}
```

---

## Data Structures

| Type | Use Case | Operations |
|------|----------|------------|
| **String** | Simple values, job status | SET, GET, SETEX |
| **List** | Job queues (FIFO/LIFO) | LPUSH, RPOP, BRPOP |
| **Hash** | Structured objects | HSET, HGET, HGETALL |
| **Set** | Unique items | SADD, SMEMBERS |
| **Sorted Set** | Leaderboards, rankings | ZADD, ZRANGE |

**For Celery:** Primarily **Lists** (queue) and **Strings** (results)

---

## Configuration

### Docker Compose
```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes  # Enable persistence
```

### Connection String
```python
REDIS_URL = "redis://redis:6379/0"
#                   ↑      ↑    ↑
#                   |      |    └─ Database (0-15)
#                   |      └────── Port
#                   └──────────── Docker service name
```

### Celery Configuration
```python
from celery import Celery

celery = Celery(
    "pocket_family",
    broker="redis://redis:6379/0",      # Job queue
    backend="redis://redis:6379/0"      # Results
)

# Reliability settings
celery.conf.update(
    task_acks_late=True,                 # Ack after completion
    task_reject_on_worker_lost=True,     # Re-queue on crash
)
```

---

## Persistence Options

### RDB (Snapshots)
```redis
# Save periodically
save 900 1      # After 900s if ≥1 key changed
save 300 10     # After 300s if ≥10 keys changed
save 60 10000   # After 60s if ≥10,000 keys changed
```
**Pro:** Fast, compact  
**Con:** Can lose recent data

### AOF (Append-Only File)
```redis
appendfsync everysec  # Sync every second (recommended)
```
**Pro:** Minimal data loss  
**Con:** Slower, larger files

**For dev:** Either works  
**For prod:** Consider RDB + everysec or migrate to SQS

---

## Import Flow in Pocket Family App

### 1. FastAPI Queues Job
```python
@router.post("/import")
async def start_import(file: UploadFile):
    job_id = str(uuid4())
    
    # Queue task (writes to Redis)
    process_import.delay(job_id, s3_key, tenant_id)
    # ↑ Does: LPUSH celery "task-abc123"
    
    return {"job_id": job_id}
```

### 2. Worker Processes
```python
@celery.task(bind=True)
def process_import(self, job_id, s3_key, tenant_id):
    # Worker did BRPOP to get this task
    
    # Update progress
    self.update_state(
        state="PROGRESS",
        meta={"percent": 50}
    )
    # ↑ Does: SET celery-task-meta-abc123 {...}
    
    # Process CSV...
    
    return {"imported": 1000}
```

### 3. FastAPI Checks Status
```python
@router.get("/import/{job_id}/status")
async def get_status(job_id: str):
    result = celery.AsyncResult(job_id)
    # ↑ Does: GET celery-task-meta-abc123
    
    return {
        "status": result.state,  # PENDING, PROGRESS, SUCCESS
        "progress": result.info.get("percent", 0)
    }
```

---

## Redis State During Import

**Queued:**
```
Queue: ["task-abc123"]
celery-task-meta-abc123: {"status": "PENDING"}
```

**Processing (50%):**
```
Queue: []  ← Removed when worker took it
celery-task-meta-abc123: {
  "status": "PROGRESS",
  "result": {"percent": 50}
}
```

**Completed:**
```
Queue: []
celery-task-meta-abc123: {
  "status": "SUCCESS",
  "result": {"imported": 1000}
}
```

---

## Common Patterns

### Check if Job Exists
```python
# Using Celery
result = celery.AsyncResult(job_id)
if result.state == "PENDING":
    # Either doesn't exist or not started yet
    # Check your database to distinguish
```

### Set Result Expiration
```python
celery.conf.result_expires = 86400  # 24 hours
```

### Cancel Job
```python
celery.control.revoke(task_id, terminate=True)
# Note: Only works if task hasn't started or is in progress
```

---

## Troubleshooting

### Worker Not Picking Up Jobs
```bash
# Check queue length
redis-cli LLEN celery
# If > 0, jobs are queued but not processed

# Check worker is running
celery -A app.celery inspect active
```

### Jobs Disappearing
**Problem:** Worker crashes, job lost (was removed from queue via BRPOP)

**Solution:** Enable acknowledgment
```python
task_acks_late = True
task_reject_on_worker_lost = True
```

### Redis Out of Memory
```bash
# Check memory usage
redis-cli INFO memory

# Set max memory limit
maxmemory 1gb
maxmemory-policy allkeys-lru  # Evict least recently used
```

---

## When to Use Alternatives

### Use Redis When:
- ✅ Simple job queue
- ✅ Speed is critical
- ✅ Learning/development
- ✅ Need caching + queues

### Use RabbitMQ When:
- Complex message routing
- Need guaranteed delivery
- Enterprise reliability requirements

### Use AWS SQS When:
- Already on AWS
- Want zero ops overhead
- Cost-sensitive ($0 vs $50/month)
- Can tolerate 20-50ms latency

### Don't Use PostgreSQL When:
- ❌ Building production SaaS
- ❌ Need high throughput
- ❌ Want proper queue semantics

---

## Cost Comparison (Production)

| Solution | Cost/Month | Ops Overhead | When to Use |
|----------|-----------|--------------|-------------|
| **Redis (ElastiCache)** | $24-50 | Medium | Need caching + queue |
| **SQS + Lambda** | $0-5 | Zero | Job queue only |
| **RabbitMQ (self-hosted)** | $15-30 | High | Complex routing |

**Recommendation for Pocket Family App:**
- **Dev:** Redis (Docker Compose) - learn patterns
- **Prod:** SQS + Lambda - cost-effective, managed

---

## Migration Path

### Phase 1: Development (Now)
```python
broker = "redis://redis:6379/0"
backend = "redis://redis:6379/0"
```

### Phase 2: Production (AWS Deployment)
```python
broker = "sqs://"
backend = "rds://"  # Or keep Redis for results
broker_transport_options = {
    'region': 'us-east-1',
    'queue_name_prefix': 'pocket-family-'
}
```

### Phase 3: Add Redis for Caching (If Needed)
```python
# Separate Redis for caching
CACHE_URL = "redis://cache:6379/0"

# Session storage
cache.set(f"session:{user_id}", data, ttl=3600)

# API rate limiting
cache.incr(f"rate:{user_id}:{endpoint}")
```

---

## Key Takeaways

1. **Redis = In-memory key-value store** used for message queuing
2. **Single-threaded but fast** - handles 100K+ ops/sec
3. **Survives app crashes** - runs in separate container
4. **Optional persistence** - can lose data on restart
5. **Best for dev** - use SQS for production to save costs
6. **Job loss risk** - enable `task_acks_late` for reliability

---

## Quick Commands Cheatsheet

```bash
# Start Redis (Docker)
docker-compose up redis

# Connect to Redis CLI
redis-cli

# Monitor all commands in real-time
redis-cli MONITOR

# Check queue length
redis-cli LLEN celery

# See all keys
redis-cli KEYS "*"

# Flush all data (DANGEROUS)
redis-cli FLUSHALL

# Get Redis info
redis-cli INFO
```

---

## Related Notes
- [[Redis Deep Dive]] - Comprehensive learning session
- [[Celery]] - Task queue implementation
- [[AWS SQS]] - Production alternative
- [[Pocket Family App]] - Your project

---

## Next Steps

**Week 9 Tasks:**
1. ✅ Understand Redis (completed)
2. Implement progress tracking
3. Add partial failure handling
4. Add per-row error reporting
5. Add import cancellation

**Documentation:**
Create `docs/architecture/import-queue.md` explaining your import pipeline.
