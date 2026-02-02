# Sprint 6: Import Flow (1 week)

## Goal
Users can import transactions in bulk via CSV upload. Multi-step flow with file upload, preview, column mapping, and confirmation.

## Success Criteria
- [ ] Users can upload CSV file
- [ ] Preview shows parsed data in AG Grid
- [ ] Users can map CSV columns to transaction fields
- [ ] Import creates transactions in batch
- [ ] Import job status tracked (optional: background job)

---

## Components Checklist

### Import Hooks

| Done | Hook | File Path | Purpose | Implementation Notes |
|------|------|-----------|---------|---------------------|
| [ ] | useUploadImport | `src/features/import/hooks/useUploadImport.ts` | Upload CSV mutation | • Call `POST /import/upload`<br>• Returns import job ID or preview data |
| [ ] | useConfirmImport | `src/features/import/hooks/useConfirmImport.ts` | Confirm import mutation | • Call `POST /import/confirm`<br>• Creates transactions in batch |
| [ ] | useImportJob | `src/features/import/hooks/useImportJob.ts` | Fetch import job status | • Query key: `['importJob', jobId]`<br>• Poll for status if async |

### API Functions

| Done | Function | File Path | Method | Endpoint | Request | Response | Notes |
|------|----------|-----------|--------|----------|---------|----------|-------|
| [ ] | uploadImport | `src/features/import/api/importApi.ts` | POST | `/import/upload` | FormData (CSV file) | Preview data or job ID | Check OpenAPI for exact endpoint |
| [ ] | confirmImport | `src/features/import/api/importApi.ts` | POST | `/import/confirm` | Mapped data | `{success: true}` | Confirm and create transactions |

**Note:** Check OpenAPI spec for exact import endpoints. May vary by implementation.

### Domain Components (AG Grid)

| Done | Component | File Path | Props | Story | Notes |
|------|-----------|-----------|-------|-------|-------|
| [ ] | ImportPreviewGrid | `src/components/domain/ag/ImportPreviewGrid.tsx` | `rows, columns, onEdit?` | `Domain/ImportPreviewGrid` | • AG Grid wrapper for CSV preview<br>• Editable cells (optional)<br>• Validation indicators |

### Feature Components (Import)

| Done | Component | File Path | Props | Used In | Notes |
|------|-----------|-----------|-------|---------|-------|
| [ ] | FileUploader | `src/features/import/components/FileUploader.tsx` | `onUpload, accept?` | Import page | • Drag-and-drop area<br>• File input fallback<br>• Validate file type (.csv) |
| [ ] | MappingForm | `src/features/import/components/MappingForm.tsx` | `csvColumns, onMap` | Import page | • Map CSV columns to transaction fields<br>• Dropdowns: account, category, amount, date, description<br>• Validation |
| [ ] | ImportStepper | `src/features/import/components/ImportStepper.tsx` | `activeStep, steps` | Import page | • Multi-step indicator<br>• Steps: Upload → Preview → Map → Confirm |

### Pages

| Done | Page | File Path | Route | Protected | Dependencies | Notes |
|------|------|-----------|-------|-----------|--------------|-------|
| [ ] | ImportPage | `src/features/import/pages/ImportPage.tsx` | `/app/:familyId/import` | Yes | FileUploader, ImportPreviewGrid, MappingForm | Multi-step import flow |

### Testing

| Done | Test | File Path | Purpose | Notes |
|------|------|-----------|---------|-------|
| [ ] | FileUploader tests | `src/features/import/__tests__/FileUploader.test.tsx` | Test file upload | Mock file input |
| [ ] | MappingForm tests | `src/features/import/__tests__/MappingForm.test.tsx` | Test mapping logic | Test validation |

---

## Implementation Steps (Sprint 6)

### Step 1: Import API & Hooks
- [ ] Check OpenAPI spec for import endpoints
- [ ] Implement `importApi.ts` (upload, confirm)
- [ ] Create React Query hooks: `useUploadImport`, `useConfirmImport`

### Step 2: File Uploader
- [ ] Build `FileUploader` component
- [ ] Add drag-and-drop area
- [ ] Validate file type and size
- [ ] Show upload progress (optional)

### Step 3: CSV Parsing & Preview
- [ ] Parse CSV client-side (use PapaParse library)
- [ ] Display parsed data in `ImportPreviewGrid`
- [ ] Allow editing cells (optional)
- [ ] Show validation errors (missing required fields)

### Step 4: Column Mapping
- [ ] Build `MappingForm` component
- [ ] Detect CSV columns automatically
- [ ] Show dropdowns to map: date → transaction_date, amount → amount, etc.
- [ ] Add validation (required fields must be mapped)

### Step 5: Import Page Flow
- [ ] Create `ImportPage` with multi-step layout
- [ ] Step 1: Upload CSV
- [ ] Step 2: Preview data
- [ ] Step 3: Map columns
- [ ] Step 4: Confirm and import
- [ ] Show success/error message

### Step 6: Backend Integration
- [ ] Send mapped data to backend
- [ ] Handle async job (optional: poll for status)
- [ ] Invalidate transactions query after import

### Step 7: Testing & Polish
- [ ] Test with sample CSV files
- [ ] Test error cases (invalid CSV, missing columns)
- [ ] Add help text and examples
- [ ] Add loading states during import

---

## API Endpoints Reference (Sprint 6)

**Note:** Exact endpoints depend on backend implementation. Check OpenAPI spec.

Typical flow:
| Endpoint | Method | Request | Response | Notes |
|----------|--------|---------|----------|-------|
| `/import/upload` | POST | FormData (file) | Preview data or job ID | Validates and returns preview |
| `/import/confirm` | POST | Mapped data | `{success: true, count: N}` | Creates transactions |

---

## Notes & Assumptions

- **CSV parsing:** Use PapaParse (client-side) or send file to backend
- **Column detection:** Auto-detect common column names (date, amount, description)
- **Validation:** Warn on missing required fields (account, amount, date)
- **Duplicate detection:** Optional feature (detect and skip duplicates)
- **Async jobs:** If backend uses Celery, poll for job status (optional for MVP)
- **Supported formats:** CSV only for MVP; defer OFX/QFX to future sprints
