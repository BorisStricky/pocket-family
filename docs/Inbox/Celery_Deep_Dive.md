# Celery Deep Dive: Distributed Task Queue for Python

**Date:** 2026-02-09  
**Topic:** Celery Architecture & Implementation  
**Context:** Family Expense Tracker - CSV Import Background Processing  
**Tags:** #celery #distributed-systems #background-jobs #architecture #python

---

## Executive Summary

[[Celery]] is a distributed task queue that solves the problem of long-running operations blocking web requests. It enables asynchronous task execution through a producer-broker-worker architecture, allowing FastAPI to respond immediately while background workers process CPU-intensive or time-consuming jobs.

**Key Takeaway:** Use Celery when tasks take >1 second or require retries/scheduling. Keep synchronous operations for fast database updates (<100ms).

---

## 1. The Problem: Synchronous Web Requests

### The Core Issue

When a user makes a web request (like uploading a CSV), your FastAPI server has **one thread handling that request**.

**What happens with synchronous execution:**

```python
# BAD: This blocks the web request
@app.post("/import-csv")
async def import_csv(file: UploadFile):
    data = parse_csv(file)  # Takes 30 seconds
    validate_rows(data)      # Takes 20 seconds  
    insert_to_db(data)       # Takes 40 seconds
    return {"status": "done"}  # User waits 90 seconds!
```

**Problems:**
1. **User waits 90 seconds** staring at loading spinner
2. **Request timeout** - Most servers timeout after 30-60 seconds
3. **Server blocked** - That FastAPI worker can't handle other requests
4. **Poor UX** - User doesn't know if it's working or stuck

### The Solution: Asynchronous Task Execution

```python
# GOOD: Immediate response, work happens in background
@app.post("/import-csv")
async def import_csv(file: UploadFile):
    # Save file to S3 quickly (2 seconds)
    file_path = upload_to_s3(file)
    
    # Schedule background job
    job = process_csv.delay(file_path)  # Returns immediately!
    
    return {"job_id": job.id, "status": "processing"}
    # User gets response in 2 seconds, can continue using app
```

### Real-World Analogy

**Without Celery:** You go to a restaurant and order food. The waiter takes your order, goes to the kitchen, waits for the food to cook (30 min), then brings it to you. No other customers can order during this time. **One waiter, one order at a time.**

**With Celery:** The waiter takes your order (2 seconds), gives you a ticket number, and immediately helps the next customer. The kitchen (Celery workers) processes orders independently. You check your ticket number to see when food is ready. **Many orders processed in parallel.**

---

## 2. async/await vs Background Processing

### Important Distinction

`async/await` is **NOT** the same as background processing.

**What async/await Actually Does:**

```python
# async/await is good for I/O-bound operations
@app.post("/fetch-data")
async def fetch_data():
    response1 = await http_client.get("api1.com")  # Waits without blocking
    response2 = await http_client.get("api2.com")  # Waits without blocking
    return combine(response1, response2)
```

**During `await`:** The thread is **freed up** to handle other requests while waiting for network/database response.

### What async/await CANNOT Do

```python
# async/await does NOT help with CPU-bound work
@app.post("/import-csv")
async def import_csv(file: UploadFile):
    # This still blocks the thread for 10 seconds!
    data = parse_csv_intensive_calculation(file)  # 10 seconds of CPU work
    return {"status": "done"}
```

**The problem:** While the CPU is crunching numbers (parsing CSV, validating data), the thread is **completely blocked**. No `await` keyword exists here because there's no I/O to wait for - it's pure computation.

### The Key Distinction

| Type | Example | async/await Helps? | Celery Needed? |
|------|---------|-------------------|----------------|
| **I/O-bound** | Database query, HTTP call, file read | ✅ Yes | ❌ Usually no |
| **CPU-bound** | CSV parsing, image processing, data validation | ❌ No | ✅ Yes |
| **Long I/O** | Processing 10,000 database inserts (even async) | ⚠️ Helps but may timeout | ✅ Yes for reliability |

**Rule:** If you use `async def` for a function that does 30 seconds of CPU-intensive math, the thread is still blocked for 30 seconds, just like a regular function.

---

## 3. Where Celery Fits in Software Architecture

### The Big Picture: Distributed Systems Patterns

Modern applications are built from **specialized components** that do one thing well:

```
┌─────────────┐
│   Client    │ (Browser/Mobile)
└──────┬──────┘
       │ HTTP Request
       ▼
┌─────────────┐
│  Web Server │ (FastAPI) - Handles requests quickly
└──────┬──────┘
       │
       ├──────────────┐
       │              │
       ▼              ▼
┌─────────────┐  ┌─────────────┐
│  Database   │  │Task Queue   │ (Celery) - Processes long jobs
└─────────────┘  │   Workers   │
                 └─────────────┘
```

### Three Core System Components

**1. Request/Response Layer (FastAPI)**
- **Job:** Handle user requests FAST (< 1 second)
- **Strength:** Many concurrent connections
- **Weakness:** Can't run long tasks

**2. Data Layer (PostgreSQL)**
- **Job:** Store and retrieve data reliably
- **Strength:** ACID transactions, complex queries
- **Weakness:** Not for computation

**3. Background Processing Layer (Celery)**
- **Job:** Execute long-running, CPU-intensive tasks
- **Strength:** Scalable, retryable, parallel processing
- **Weakness:** Not for real-time responses

### Enterprise Patterns Using Task Queues

| Pattern | Example in Your App | Why Queue? |
|---------|---------------------|------------|
| **Batch Processing** | Import 10,000 transactions from CSV | Too slow for HTTP request |
| **Scheduled Jobs** | Generate monthly reports at 2 AM | Happens when no user is waiting |
| **Fan-Out Work** | Send notification to 500 family members | Parallelizable across workers |
| **Retry Logic** | Email sending (might fail, retry later) | Network issues need retry |
| **Resource Intensive** | Generate PDF reports with charts | High CPU/memory usage |

### Architectural Principle: Separation of Concerns

**Bad Architecture:**
```
Web Server does everything
├─ Handle HTTP requests
├─ Process CSV files (blocks!)
├─ Send emails (blocks!)
├─ Generate reports (blocks!)
└─ Database queries
```
Result: **Slow, unreliable, can't scale**

**Good Architecture (with Celery):**
```
Web Server (FastAPI)
├─ Handle HTTP requests ✓
├─ Schedule background jobs ✓
└─ Database queries ✓

Task Workers (Celery)
├─ Process CSV files ✓
├─ Send emails ✓
└─ Generate reports ✓
```
Result: **Fast responses, scalable, reliable**

---

## 4. What is Celery

### Core Definition

**Celery** is a **distributed task queue** written in Python that lets you:
1. **Define tasks** (Python functions that do work)
2. **Queue tasks** (send them to be processed later)
3. **Execute tasks** (workers pick them up and run them)

### The Three Components

Every Celery setup has these parts:

#### 1. Producer (Your FastAPI app)
```python
# This is your FastAPI code
result = process_csv.delay(file_path)  # ← Sends task to queue
```
**Role:** Creates tasks and sends them to the broker

#### 2. Broker (Redis in your case)
```
Task Queue: [task1, task2, task3, ...]
```
**Role:** Message queue that holds tasks waiting to be processed  
**Think:** Post office mailbox

#### 3. Worker (Celery worker processes)
```python
# Separate process running on same/different machine
@celery.task
def process_csv(file_path):
    # Does the actual work
    data = parse_csv(file_path)
    insert_to_db(data)
```
**Role:** Pulls tasks from broker and executes them

### The Flow

```
1. FastAPI creates task
   ↓
2. Task sent to Redis (broker)
   ↓
3. Redis stores in queue
   ↓
4. Worker pulls task from queue
   ↓
5. Worker executes task
   ↓
6. Worker stores result (optional)
```

### Key Characteristics

**Celery is NOT:**
- ❌ A web server
- ❌ A database
- ❌ Part of FastAPI
- ❌ Built-in to Python

**Celery IS:**
- ✅ A separate Python library
- ✅ Runs in separate processes from your web server
- ✅ Can run on different machines
- ✅ Language: Python only (producers and workers)

### Simple Code Example

```python
# 1. Define the Celery app
from celery import Celery

celery_app = Celery('myapp', broker='redis://localhost:6379/0')

# 2. Define a task
@celery_app.task
def add_numbers(x, y):
    return x + y

# 3. Call it from FastAPI (producer)
@app.get("/calculate")
def calculate():
    result = add_numbers.delay(5, 10)  # ← Queues the task
    return {"task_id": result.id}
    # Returns immediately! Doesn't wait for calculation.

# 4. Worker executes (running separately)
# $ celery -A myapp worker --loglevel=info
# Worker picks up task and runs add_numbers(5, 10)
```

---

## 5. How Celery Works

### Message Flow: Task Journey

When you call `process_csv.delay(file_path)`, here's what happens:

```
1. PRODUCER (FastAPI)
   │
   ├─> Serializes task: {"task": "process_csv", "args": ["/path/file.csv"]}
   │
   ├─> Sends to Redis BROKER
   │
2. BROKER (Redis)
   │
   ├─> Stores message in queue: celery (default queue name)
   │
   ├─> Queue: ["task1", "task2", "task3", ...]
   │
3. WORKER (Celery Process)
   │
   ├─> Long-polls broker: "Any tasks for me?"
   │
   ├─> Receives task message
   │
   ├─> Deserializes: Converts JSON back to Python objects
   │
   ├─> Executes: process_csv("/path/file.csv")
   │
   ├─> (Optional) Stores result in RESULT BACKEND
   │
4. RESULT BACKEND (Redis or PostgreSQL)
   │
   └─> Stores: {"task_id": "abc-123", "status": "SUCCESS", "result": {...}}
```

### Code Example

```python
# In FastAPI (Producer)
from app.celery_app import celery_app

@app.post("/import")
async def import_csv(file: UploadFile):
    file_path = await save_to_s3(file)
    
    # This creates and sends the message
    result = process_csv.delay(file_path)  
    # ↑ Returns AsyncResult object immediately
    
    return {
        "job_id": result.id,  # UUID like "abc-123-def-456"
        "status": "PENDING"
    }

# In Celery worker (separate process)
@celery_app.task
def process_csv(file_path: str):
    # Worker executes this
    data = parse_csv(file_path)
    rows = validate_and_insert(data)
    return {"imported": len(rows)}
```

### What Gets Sent to Redis?

**Actual message in Redis** (simplified):

```json
{
  "task": "app.tasks.process_csv",
  "id": "abc-123-def-456",
  "args": ["/uploads/file.csv"],
  "kwargs": {},
  "retries": 0,
  "eta": null,
  "expires": null
}
```

### Task Lifecycle: States and Transitions

Every Celery task goes through states:

```
PENDING → STARTED → SUCCESS
            ↓
          RETRY → STARTED → SUCCESS
            ↓
          FAILURE
```

**The States Explained:**

| State | Meaning | When It Happens |
|-------|---------|-----------------|
| **PENDING** | Task waiting in queue | Right after `.delay()` call |
| **STARTED** | Worker picked it up | Worker begins execution |
| **RETRY** | Task failed, retrying | Network error, temporary issue |
| **SUCCESS** | Task completed | Function returned successfully |
| **FAILURE** | Task failed permanently | Unhandled exception, max retries exceeded |

### Worker Architecture

**What Is a Worker?**

A **Celery worker** is a **separate Python process** that:
1. Connects to Redis broker
2. Long-polls for tasks (sits waiting for new messages)
3. Executes task functions
4. Reports results back

**Worker Internals:**

```
Celery Worker Process
├── Main Process (orchestrator)
│   └── Monitors broker for new tasks
│
├── Worker Pool (execution)
│   ├── Process 1 (executes task A)
│   ├── Process 2 (executes task B)
│   ├── Process 3 (executes task C)
│   └── Process 4 (executes task D)
│
└── Result Backend Client
    └── Stores task results
```

**Key point:** By default, each worker spawns **multiple sub-processes** (concurrency) to handle tasks in parallel.

**Worker Configuration:**

```bash
# Start worker with 4 concurrent processes
celery -A app.celery_app worker --concurrency=4

# Each worker can handle 4 tasks simultaneously
```

For your expense tracker:
- **4 concurrent processes** = Can process 4 CSV files at once
- **1 worker with concurrency=4** on one machine
- **OR 4 workers with concurrency=1** spread across machines (same total capacity)

### Serialization: How Tasks Are Encoded

When you call `.delay()`, Python objects must be converted to a format Redis can store.

**Default: JSON**

```python
# In FastAPI
process_csv.delay("/path/file.csv", tenant_id=123)

# Becomes this JSON in Redis:
{
  "task": "process_csv",
  "args": ["/path/file.csv"],
  "kwargs": {"tenant_id": 123}
}
```

**What Can Be Serialized?**

**✅ Safe to pass:**
- Strings: `"file.csv"`
- Numbers: `123`, `45.67`
- Lists/Dicts: `[1, 2, 3]`, `{"key": "value"}`
- None, True, False

**❌ Cannot pass directly:**
- File objects: `UploadFile`
- Database sessions: `db: Session`
- Custom class instances (without special setup)

**Your Pattern (Correct!):**

```python
# ❌ WRONG - Can't serialize UploadFile
process_csv.delay(file)

# ✅ CORRECT - Pass string path
file_path = await save_to_s3(file)
process_csv.delay(file_path)  # Just a string!
```

### Result Backend: Where Results Are Stored

After a task completes, where does the result go?

**Option 1: Redis (Fast, temporary)**
```python
celery_app = Celery(
    broker='redis://localhost:6379/0',
    backend='redis://localhost:6379/1'  # Different Redis DB
)
```
- ✅ Fast retrieval
- ❌ Results expire (default: 1 day)
- **Use for:** Temporary job status

**Option 2: PostgreSQL (Persistent)**
```python
celery_app = Celery(
    broker='redis://localhost:6379/0',
    backend='db+postgresql://user:pass@localhost/dbname'
)
```
- ✅ Permanent storage
- ✅ Query with SQL
- ❌ Slightly slower
- **Use for:** Import job history, audit trail

**Recommendation for Your App: PostgreSQL Backend**

Why? You want to show users their import history:
```sql
-- Query import jobs from last month
SELECT * FROM celery_taskmeta 
WHERE date_done > NOW() - INTERVAL '30 days'
AND status = 'SUCCESS';
```

---

## 6. Celery in Your Expense Tracker

### Your Import Flow Architecture

```
1. User uploads CSV
   ↓
2. FastAPI saves to S3 (2 sec)
   ↓
3. FastAPI creates ImportJob record
   ↓
4. FastAPI queues Celery task
   ↓
5. Returns immediately to user (total: 2 sec)
   ↓
6. Celery worker processes (30-60 sec)
   │
   ├─ Downloads CSV from S3
   ├─ Parses rows
   ├─ Validates each row
   ├─ Updates ImportJob progress
   └─ Creates Expense records
   ↓
7. Frontend polls ImportJob status
   ↓
8. Shows completion to user
```

### Code Implementation

**Backend structure:**
```
backend/
├── app/
│   ├── celery_app.py        # Celery configuration
│   ├── tasks/
│   │   └── import_tasks.py  # CSV import task
│   ├── api/
│   │   └── imports.py       # Import endpoints
│   └── models/
│       └── import_job.py    # ImportJob model
```

#### 1. Celery Configuration

```python
# app/celery_app.py
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    'expense_tracker',
    broker=settings.REDIS_URL,  # redis://localhost:6379/0
    backend=settings.REDIS_URL  # Store results in Redis
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,  # Track when task starts
    task_time_limit=30 * 60,  # 30 min max per task
)
```

#### 2. Import Task

```python
# app/tasks/import_tasks.py
from app.celery_app import celery_app
from app.models import ImportJob, Expense
from app.db import get_db
import csv

@celery_app.task(bind=True, max_retries=3)
def process_csv_import(
    self, 
    job_id: str, 
    s3_path: str, 
    tenant_id: str
):
    db = next(get_db())
    
    # Get job record
    job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
    job.status = "PROCESSING"
    job.started_at = datetime.utcnow()
    db.commit()
    
    try:
        # Download from S3
        file_content = s3_client.download(s3_path)
        
        # Parse CSV
        reader = csv.DictReader(file_content.splitlines())
        rows = list(reader)
        
        job.total_rows = len(rows)
        db.commit()
        
        # Process each row
        for i, row in enumerate(rows):
            try:
                expense = Expense(
                    tenant_id=tenant_id,
                    amount=float(row['amount']),
                    description=row['description'],
                    category=row['category'],
                    date=datetime.strptime(row['date'], '%Y-%m-%d'),
                    created_by='import'
                )
                db.add(expense)
                
                # Update progress every 100 rows
                if i % 100 == 0:
                    job.processed_count = i
                    db.commit()
                    
            except Exception as row_error:
                # Store row error, continue processing
                job.errors.append({
                    'row': i,
                    'data': row,
                    'error': str(row_error)
                })
        
        # Final commit
        db.commit()
        
        # Mark success
        job.status = "SUCCESS"
        job.processed_count = len(rows)
        job.completed_at = datetime.utcnow()
        db.commit()
        
        return {"imported": len(rows) - len(job.errors)}
        
    except Exception as exc:
        # Task failed
        job.status = "FAILED"
        job.error_message = str(exc)
        db.commit()
        
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    
    finally:
        db.close()
```

#### 3. API Endpoints

```python
# app/api/imports.py
from fastapi import APIRouter, UploadFile, Depends
from app.tasks.import_tasks import process_csv_import
from app.models import ImportJob
import uuid

router = APIRouter()

@router.post("/import")
async def create_import(
    file: UploadFile,
    tenant_id: str = Depends(get_current_tenant)
):
    # Generate job ID
    job_id = str(uuid.uuid4())
    
    # Upload to S3
    s3_path = f"imports/{tenant_id}/{job_id}/{file.filename}"
    await s3_client.upload(file, s3_path)
    
    # Create job record
    job = ImportJob(
        id=job_id,
        tenant_id=tenant_id,
        file_name=file.filename,
        file_path=s3_path,
        status="PENDING"
    )
    db.add(job)
    db.commit()
    
    # Queue Celery task (returns immediately)
    process_csv_import.delay(job_id, s3_path, tenant_id)
    
    return {"job_id": job_id, "status": "PENDING"}

@router.get("/import/{job_id}")
def get_import_status(job_id: str):
    job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404)
    
    return {
        "id": job.id,
        "status": job.status,
        "total_rows": job.total_rows,
        "processed_count": job.processed_count,
        "errors": job.errors,
        "created_at": job.created_at,
        "completed_at": job.completed_at
    }
```

#### 4. Frontend Polling

```typescript
// React component
function ImportProgress({ jobId }: { jobId: string }) {
  const [status, setStatus] = useState<ImportStatus | null>(null);
  
  useEffect(() => {
    const pollStatus = async () => {
      const response = await api.getImportStatus(jobId);
      setStatus(response);
      
      // Stop polling when complete
      if (response.status === 'SUCCESS' || response.status === 'FAILED') {
        clearInterval(interval);
      }
    };
    
    const interval = setInterval(pollStatus, 2000);
    pollStatus(); // Initial call
    
    return () => clearInterval(interval);
  }, [jobId]);
  
  if (!status) return <Spinner />;
  
  return (
    <Card>
      <Typography>Status: {status.status}</Typography>
      <LinearProgress 
        value={(status.processed_count / status.total_rows) * 100} 
      />
      <Typography>
        {status.processed_count} / {status.total_rows} rows processed
      </Typography>
      {status.errors.length > 0 && (
        <Alert severity="warning">
          {status.errors.length} rows failed
        </Alert>
      )}
    </Card>
  );
}
```

---

## 7. Deployment Architecture

### Development: Co-located (Docker Compose)

```yaml
# docker-compose.yml
services:
  api:
    build: .
    command: uvicorn main:app --reload
    ports:
      - "8000:8000"
  
  worker:
    build: .
    command: celery -A app.celery_app worker --loglevel=info
  
  redis:
    image: redis:7
    ports:
      - "6379:6379"
  
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: expense_tracker
```

### Production: Separate ECS Services

```
┌─────────────────┐     ┌─────────────────┐
│  ECS Service 1  │     │  ECS Service 2  │
│                 │     │                 │
│  FastAPI (2 GB) │     │ Celery Worker   │
│  Min: 2 tasks   │     │     (4 GB)      │
│  Max: 10 tasks  │     │  Min: 1 task    │
│                 │     │  Max: 5 tasks   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │   ElastiCache Redis   │
         │   RDS PostgreSQL      │
         └───────────────────────┘
```

**Why Separate Services:**
- ✅ **Independent scaling** - Scale workers during import spikes
- ✅ **Resource isolation** - Workers can't affect API performance
- ✅ **Different instance types** - API = CPU-optimized, Workers = memory-optimized
- ✅ **Better monitoring** - Separate metrics for API vs workers
- ✅ **Fault isolation** - Worker crash doesn't affect API

**Cost Efficiency:**
- Scale workers only when needed (queue depth metric)
- API always on, workers scale 1-5 based on load

---

## 8. Database Transactions & Idempotency

### Transaction Strategies

**Single Transaction (Recommended for CSV Import):**

```python
@celery_app.task
def process_csv_import(job_id: str, s3_path: str, tenant_id: str):
    db = next(get_db())
    
    try:
        rows = parse_csv(download_from_s3(s3_path))
        
        # All in one transaction
        for row in rows:
            expense = Expense(tenant_id=tenant_id, **row)
            db.add(expense)
        
        job.status = "SUCCESS"
        db.commit()  # Single commit - fast + safe
        
    except Exception as e:
        db.rollback()  # Undoes all expenses
        job.status = "FAILED"
        db.commit()  # Just save the failure status
        raise
```

**Performance for 5,000 rows:**

| Strategy | Disk Writes | Time Estimate | Risk if Crash |
|----------|-------------|---------------|---------------|
| Per-row commit | 5,000 | ~50 seconds | Partial data in DB |
| Single transaction | 1 | ~2 seconds | Nothing in DB (clean) |
| Batch (100 rows) | 50 | ~5 seconds | Last batch lost |

**Recommendation:** Single transaction for imports up to ~10,000 rows.

### Idempotency Pattern

Make tasks safe to run multiple times:

```python
@celery_app.task
def process_csv_import(job_id: str, s3_path: str, tenant_id: str):
    # Check if already processed (idempotency)
    job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
    if job.status == "SUCCESS":
        return {"message": "Already completed"}
    
    # Use unique constraint on expenses
    for row in rows:
        expense = Expense(
            tenant_id=tenant_id,
            import_job_id=job_id,  # Link to import
            import_row_number=i,
            **row
        )
        # ON CONFLICT DO NOTHING if duplicate
        db.merge(expense)
```

**Why This Matters:**
- If task crashes at row 2000, Celery retries from row 0
- Without idempotency → rows 0-2000 are duplicated
- With idempotency → safe to retry

---

## 9. When to Use Celery vs Synchronous

### Use Synchronous (API Endpoint) When:

**✅ Operation is fast (<100ms):**
```python
@app.post("/transactions")
def create_transaction(txn: TransactionCreate):
    # 1. INSERT transaction (~2ms)
    transaction = Transaction(**txn.dict())
    db.add(transaction)
    
    # 2. SELECT account by PK (~1ms) - Indexed lookup!
    account = db.query(Account).filter(
        Account.id == txn.account_id
    ).first()
    
    # 3. UPDATE account balance (~2ms)
    account.balance += txn.amount
    
    # 4. COMMIT (~5ms)
    db.commit()
    
    return transaction  # Total: ~10ms
```

**Why synchronous works:**
- Primary key lookup is O(log n) - essentially constant time
- Simple addition: `balance += amount` (microseconds)
- Scales to millions of accounts with proper indexes
- Immediate consistency for users

### Use Celery (Background Task) When:

**✅ Long-running operations (>1 second):**
- CSV import with 5,000 rows
- Generating complex reports with charts
- Batch email sending

**✅ External API calls:**
- Payment processing
- Email/SMS notifications
- Third-party integrations

**✅ Scheduled operations:**
- Nightly reconciliation
- Monthly report generation
- Automated backups

**✅ Retry-required operations:**
- Network requests that might fail
- External service calls

### Example: Account Balance Update Decisions

**Scenario A: Single Transaction Create**
```python
# SYNCHRONOUS ✓
@app.post("/transactions")
def create_transaction(txn: TransactionCreate):
    create_txn_and_update_balance(txn)  # ~10ms
    return txn
```

**Scenario B: Bulk CSV Import**
```python
# ASYNC WITH FINAL RECONCILIATION ✓
@celery_app.task
def process_csv_import(job_id: str):
    affected_accounts = set()
    
    for row in rows:
        txn = Transaction(**row)
        db.add(txn)
        affected_accounts.add(txn.account_id)
    
    db.commit()
    
    # Recalculate once per account
    for account_id in affected_accounts:
        recalculate_balance(account_id)
```

**Scenario C: Nightly Reconciliation**
```python
# SCHEDULED CELERY TASK ✓
@celery_app.task
def nightly_reconciliation():
    """Celery Beat runs this at 2 AM"""
    for account in db.query(Account).all():
        calculated = sum_transactions(account.id)
        if account.balance != calculated:
            account.balance = calculated
            log_discrepancy(account)
    db.commit()
```

---

## 10. Alternatives to Celery

### Comparison Table

| Tool | Language | Broker | Best For | Your App? |
|------|----------|--------|----------|-----------|
| **Celery** | Python | Redis/RabbitMQ | Complex workflows, scheduling | ✅ Yes |
| **RQ** | Python | Redis only | Simple background jobs | ❌ Too simple |
| **Dramatiq** | Python | Redis/RabbitMQ | Modern alternative to Celery | ✅ Could use |
| **AWS SQS + Lambda** | Any | AWS SQS | Serverless, cloud-native | ✅ Phase 4 option |
| **Bull** | Node.js | Redis | If using Node backend | ❌ Wrong language |
| **Sidekiq** | Ruby | Redis | If using Rails | ❌ Wrong language |

### AWS SQS + Lambda Alternative

Instead of Celery, AWS has a native equivalent:

```
Celery Pattern:
FastAPI → Redis → Celery Worker

AWS Native Pattern:
FastAPI → SQS → Lambda Function
```

**Component Mapping:**

| Celery | AWS Equivalent |
|--------|----------------|
| Redis Broker | **SQS** (Simple Queue Service) |
| Celery Worker | **Lambda Function** |
| `.delay()` | `sqs.send_message()` |
| Result Backend | **DynamoDB** or **S3** |

**Why Celery Can't Run on Lambda:**
- Lambda is **event-triggered** (runs once per message)
- Celery workers are **long-running processes** (continuously poll)
- Fundamental execution model mismatch

### Recommendation for Your Project

**Phase 1-3 (Now):** Use Celery
- Learn the pattern
- Portfolio shows distributed systems knowledge
- Easy local development (Docker Compose)

**Phase 4 (AWS Deployment):** Start with Celery on ECS
- Proven architecture
- Easier migration from local dev

**Phase 5 (Optional):** Migrate to SQS + Lambda
- Shows you understand multiple approaches
- Blog post: "Migrating from Celery to AWS Native"
- Great portfolio differentiator

---

## 11. Monolith vs Microservices Clarification

### Key Distinction: NOT About Containers

**Monolith = One Codebase, One Business Domain**

```
expense-tracker/
├── api/          (FastAPI - all endpoints)
├── workers/      (Celery - same codebase)
├── models/       (Shared database models)
└── shared/       (Common utilities)

ALL code is in ONE repository, shares ONE database
```

Even with separate containers:
- ✅ **API container** runs FastAPI
- ✅ **Worker container** runs Celery
- ✅ **But both use THE SAME CODE** (same repo, same models, same database)

This is a **distributed monolith** - one application split into processes.

### Microservices = Multiple Codebases, Separate Domains

```
expense-service/          (Repo 1)
├── api/
├── workers/
└── database: expenses_db

notification-service/     (Repo 2)
├── api/
├── workers/
└── database: notifications_db

user-service/            (Repo 3)
├── api/
└── database: users_db
```

Each service:
- ❌ **Cannot directly access other service's database**
- ✅ **Communicates via APIs only**
- ✅ **Independently deployable**
- ✅ **Different teams can own different services**

**Your expense tracker:** One codebase + one database = **well-architected monolith** ✓

---

## 12. Scale & Performance Considerations

### Database Query Performance with Proper Indexing

**Without Index (Slow):**

| Accounts | Query Time |
|----------|-----------|
| 1,000 | ~5ms |
| 10,000 | ~50ms |
| 100,000 | ~500ms |
| 1,000,000 | ~5 seconds |

**With Primary Key Index (Fast):**

| Accounts | Query Time |
|----------|-----------|
| 1,000 | ~1ms |
| 10,000 | ~1ms |
| 100,000 | ~1ms |
| 1,000,000 | ~2ms |
| 10,000,000 | ~3ms |

**Why:** B-tree index lookup is O(log n) - practically constant time

### Proper Schema Design

```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY,              -- B-tree index (automatic)
    tenant_id UUID NOT NULL,          
    balance DECIMAL NOT NULL DEFAULT 0,
    created_at TIMESTAMP,
    INDEX idx_tenant_accounts (tenant_id, id)
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    amount DECIMAL NOT NULL,
    date DATE NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    INDEX idx_account_txns (account_id, date DESC),
    INDEX idx_tenant_txns (tenant_id, date DESC)
);
```

**Real-World Scale:**
- **Your expense tracker at scale:**
  - 100,000 users
  - ~500K accounts
  - ~50M transactions
  - **Transaction create: ~10-20ms** ✅ Still fast with proper indexes

---

## 13. Key Takeaways

### When to Use Celery

✅ **Use Celery for:**
- Tasks taking >1 second
- CPU-intensive operations (CSV parsing, report generation)
- External API calls that might fail/need retries
- Scheduled jobs (cron-like tasks)
- Operations that can be delayed

❌ **Don't use Celery for:**
- Fast database lookups (<100ms)
- Simple CRUD operations
- Operations requiring immediate feedback
- Synchronous workflows

### Architecture Decisions

**✅ Recommended:**
- Separate ECS services for API and workers (production)
- PostgreSQL as result backend (audit trail)
- Single transaction for batch inserts (performance)
- Idempotency checks for retry safety
- Synchronous balance updates (fast with indexes)

**❌ Avoid:**
- Running workers on same instance as API (production)
- Per-row commits in batch operations
- Async operations for fast database updates
- Missing database indexes on frequently queried columns

### Portfolio Value

**What This Demonstrates:**
1. Understanding of distributed systems architecture
2. Proper separation of concerns (web vs background processing)
3. Production-ready patterns (retries, idempotency, monitoring)
4. Scalability considerations
5. Multiple deployment options (ECS, Lambda)

---

## Related Topics

- [[Redis]] - Message broker for Celery
- [[PostgreSQL]] - Database and result backend
- [[FastAPI]] - Web framework integration
- [[Docker]] - Containerization for development
- [[AWS ECS]] - Production deployment
- [[AWS SQS]] - Alternative queue service
- [[AWS Lambda]] - Serverless alternative

---

## Next Steps

1. **Week 8:** Document your Celery architecture
2. **Week 9:** Implement progress tracking, partial failures, cancellation
3. **Phase 4:** Deploy to AWS with separate ECS services
4. **Optional:** Write blog post on Celery → SQS migration
