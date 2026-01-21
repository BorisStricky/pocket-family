// src/lib/errorUtils.ts
// Utility functions for extracting user-friendly error messages

import { ApiError } from './apiClient';

/**
 * Extracts a user-friendly error message from various error types.
 *
 * Priority order:
 * 1. ApiError with body.detail (from FastAPI HTTPException)
 * 2. ApiError with status-specific fallback messages
 * 3. Network/fetch errors with connection message
 * 4. Error objects with message property
 * 5. Generic fallback message
 *
 * @param error - The error object (unknown type from React Query)
 * @returns User-friendly error message string
 *
 * @example
 * // FastAPI HTTPException error
 * const apiErr = new ApiError("API error 400", 400, { detail: "Email already registered" });
 * getErrorMessage(apiErr); // "Email already registered"
 *
 * @example
 * // Network error
 * const netErr = new TypeError("Failed to fetch");
 * getErrorMessage(netErr); // "Unable to connect. Please check your internet connection."
 */
export function getErrorMessage(error: unknown): string {
  // 1. Handle ApiError with body.detail (FastAPI standard)
  if (error instanceof ApiError && error.body?.detail) {
    return error.body.detail;
  }

  // 2. Handle ApiError with status-specific messages
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return "Invalid request. Please check your input.";
      case 401:
        return "Authentication failed.";
      case 403:
        return "Access denied.";
      case 404:
        return "Resource not found.";
      case 500:
      case 502:
      case 503:
      case 504:
        return "Server error. Please try again later.";
      default:
        return `Error: ${error.status}`;
    }
  }

  // 3. Handle network/fetch errors
  if (error instanceof TypeError && error.message?.includes('fetch')) {
    return "Unable to connect. Please check your internet connection.";
  }

  // 4. Handle Error objects with message
  if (error instanceof Error && error.message) {
    return error.message;
  }

  // 5. Fallback for unknown errors
  return "An unexpected error occurred. Please try again.";
}
