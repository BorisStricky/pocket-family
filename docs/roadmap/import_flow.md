# Import Flow (Deferred)

> **Status:** Deferred from Sprint 6. To be implemented at a later stage.
> **Reason:** Requires significant backend infrastructure (job queue, file storage) that is not yet in place.

## Goal
Users can import transactions in bulk via CSV upload. Multi-step flow with file upload, preview, column mapping, and confirmation.

## Success Criteria
- [ ] Users can upload CSV file
- [ ] Preview shows parsed data in AG Grid
- [ ] Users can map CSV columns to transaction fields
- [ ] Import creates transactions in batch
- [ ] Import job status tracked via background job

---

## Backend Work Required

This feature requires backend infrastructure that does not yet exist:

### Job Queue (Celery + Redis)
- [ ] Set up Celery worker with Redis broker
- [ ] Create import job task that processes CSV files asynchronously
- [ ] Implement job status tracking (pending, processing, completed, failed)
- [ ] Add API endpoints for job status polling

### File Storage
- [ ] Implement file upload endpoint that accepts CSV files
- [ ] Store uploaded CSVs (local filesystem or S3-compatible storage)
- [ ] Clean up stored files after import completes or after TTL expires

### Import Processing
- [ ] CSV parsing and validation on the backend
- [ ] Batch transaction creation with rollback on failure
- [ ] Duplicate detection (optional)
- [ ] Error reporting per-row (which rows failed and why)

### API Endpoints
| Endpoint | Method | Request | Response | Notes |
|----------|--------|---------|----------|-------|
| `/import/upload` | POST | FormData (file) | Preview data or job ID | Validates and returns preview |
| `/import/confirm` | POST | Mapped data + job ID | `{success: true, count: N}` | Creates transactions |
| `/import/jobs/{id}` | GET | - | Job status | Poll for async status |

---

## Frontend Components

### Import Hooks
| Hook | File Path | Purpose |
|------|-----------|---------|
| useUploadImport | `src/features/import/hooks/useUploadImport.ts` | Upload CSV mutation |
| useConfirmImport | `src/features/import/hooks/useConfirmImport.ts` | Confirm import mutation |
| useImportJob | `src/features/import/hooks/useImportJob.ts` | Fetch import job status |

### API Functions
| Function | File Path | Method | Endpoint |
|----------|-----------|--------|----------|
| uploadImport | `src/features/import/api/importApi.ts` | POST | `/import/upload` |
| confirmImport | `src/features/import/api/importApi.ts` | POST | `/import/confirm` |

### Domain Components (AG Grid)
| Component | File Path | Notes |
|-----------|-----------|-------|
| ImportPreviewGrid | `src/components/domain/ag/ImportPreviewGrid.tsx` | AG Grid wrapper for CSV preview with editable cells and validation indicators |

### Feature Components
| Component | File Path | Notes |
|-----------|-----------|-------|
| FileUploader | `src/features/import/components/FileUploader.tsx` | Drag-and-drop area, file input fallback, .csv validation |
| MappingForm | `src/features/import/components/MappingForm.tsx` | Map CSV columns to transaction fields via dropdowns |
| ImportStepper | `src/features/import/components/ImportStepper.tsx` | Multi-step indicator: Upload → Preview → Map → Confirm |

### Pages
| Page | Route | Dependencies |
|------|-------|--------------|
| ImportPage | `/app/:familyId/import` | FileUploader, ImportPreviewGrid, MappingForm |

---

## Implementation Steps

### Step 1: Backend Infrastructure
- [ ] Set up Celery + Redis
- [ ] Implement file storage (local or S3)
- [ ] Create import processing pipeline

### Step 2: Backend API
- [ ] Upload endpoint (parse CSV, return preview)
- [ ] Confirm endpoint (create transactions in batch)
- [ ] Job status endpoint (poll for async processing)

### Step 3: Frontend - File Upload & Preview
- [ ] Build FileUploader component
- [ ] Parse CSV client-side (PapaParse) for instant preview
- [ ] Display in ImportPreviewGrid

### Step 4: Frontend - Column Mapping
- [ ] Build MappingForm component
- [ ] Auto-detect common column names (date, amount, description)
- [ ] Validation (required fields must be mapped)

### Step 5: Frontend - Import Page Flow
- [ ] Create ImportPage with multi-step layout (ImportStepper)
- [ ] Wire up upload → preview → map → confirm flow
- [ ] Show success/error with per-row details

### Step 6: Testing
- [ ] Backend: test import processing, job queue, tenant isolation
- [ ] Frontend: test file upload, mapping, confirmation flow

---

## Notes & Assumptions
- **CSV parsing:** Use PapaParse client-side for preview, backend for actual processing
- **Column detection:** Auto-detect common column names (date, amount, description)
- **Validation:** Warn on missing required fields (account, amount, date)
- **Duplicate detection:** Optional (detect and skip duplicates)
- **Supported formats:** CSV only for MVP; defer OFX/QFX to future
