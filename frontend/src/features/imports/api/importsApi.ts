// src/features/imports/api/importsApi.ts
// API functions for the CSV import wizard, all using the centralized apiFetch client.

import { apiFetch } from '@/lib/apiClient';
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ExecuteRequest,
  ExecuteResponse,
  ImportJobRead,
  ImportUploadResponse,
  JobStatusResponse,
} from '../types';

/**
 * Upload a CSV file and get back column names + sample rows for mapping.
 * Uses multipart/form-data — apiFetch handles Content-Type automatically for FormData.
 */
export async function uploadCsv(file: File): Promise<ImportUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch('/imports/upload', { method: 'POST', body: formData }) as Promise<ImportUploadResponse>;
}

/**
 * Parse the uploaded CSV with the user's column mapping and find duplicate transactions.
 */
export async function analyzeCsv(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  return apiFetch('/imports/analyze', {
    method: 'POST',
    body: JSON.stringify(request),
  }) as Promise<AnalyzeResponse>;
}

/**
 * Dispatch the confirmed row list to the background import worker.
 * Returns a job_id to poll for progress.
 */
export async function executeImport(request: ExecuteRequest): Promise<ExecuteResponse> {
  return apiFetch('/imports/execute', {
    method: 'POST',
    body: JSON.stringify(request),
  }) as Promise<ExecuteResponse>;
}

/**
 * Poll the import job status. Call every 2 seconds until status is "done" or "failed".
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  return apiFetch(`/imports/jobs/${jobId}`) as Promise<JobStatusResponse>;
}

/**
 * Fetch the history of all import jobs for the active tenant (newest first).
 * Backend filters by tenant_id from the JWT, so no params needed here.
 */
export async function listImportJobs(): Promise<ImportJobRead[]> {
  return apiFetch('/imports/jobs') as Promise<ImportJobRead[]>;
}
