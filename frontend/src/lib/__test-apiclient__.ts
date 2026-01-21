// src/lib/__test-apiclient__.ts
// Simple manual test file for apiClient
// To test: Import this in browser console or run with ts-node

import { apiFetch, ApiError } from './apiClient';

/**
 * Test the /ping endpoint
 * Expected response: { ok: true }
 */
export async function testPing() {
  console.log('Testing /ping endpoint...');
  try {
    const response = await apiFetch('/ping');
    console.log('✅ Success:', response);
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('❌ API Error:', {
        status: error.status,
        body: error.body,
        message: error.message
      });
    } else {
      console.error('❌ Network Error:', error);
    }
    throw error;
  }
}

/**
 * Test error handling with invalid endpoint
 */
export async function testErrorHandling() {
  console.log('Testing error handling with invalid endpoint...');
  try {
    const response = await apiFetch('/invalid-endpoint-that-does-not-exist');
    console.log('❌ Should have thrown error but got:', response);
  } catch (error) {
    if (error instanceof ApiError) {
      console.log('✅ Correctly caught ApiError:', {
        status: error.status,
        message: error.message
      });
    } else {
      console.error('❌ Wrong error type:', error);
    }
  }
}

// Uncomment to run tests immediately:
// testPing();
// testErrorHandling();
