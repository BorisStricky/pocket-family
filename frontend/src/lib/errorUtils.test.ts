// src/lib/errorUtils.test.ts
// Unit tests for error message extraction utility

import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './errorUtils';
import { ApiError } from './apiClient';

describe('getErrorMessage', () => {
  describe('ApiError with body.detail', () => {
    it('should extract detail from ApiError with body.detail', () => {
      const error = new ApiError(
        'API error 400',
        400,
        { detail: 'Email already registered' }
      );
      expect(getErrorMessage(error)).toBe('Email already registered');
    });

    it('should extract detail for 401 Invalid credentials', () => {
      const error = new ApiError(
        'API error 401',
        401,
        { detail: 'Invalid credentials' }
      );
      expect(getErrorMessage(error)).toBe('Invalid credentials');
    });

    it('should extract detail for 403 Not a member error', () => {
      const error = new ApiError(
        'API error 403',
        403,
        { detail: 'Not a member of the family' }
      );
      expect(getErrorMessage(error)).toBe('Not a member of the family');
    });

    it('should extract detail for custom server error message', () => {
      const error = new ApiError(
        'API error 500',
        500,
        { detail: 'Database connection failed' }
      );
      expect(getErrorMessage(error)).toBe('Database connection failed');
    });
  });

  describe('ApiError without body.detail (fallback messages)', () => {
    it('should return fallback message for 400 without detail', () => {
      const error = new ApiError('API error 400', 400, {});
      expect(getErrorMessage(error)).toBe('Invalid request. Please check your input.');
    });

    it('should return fallback message for 401 without detail', () => {
      const error = new ApiError('API error 401', 401, null);
      expect(getErrorMessage(error)).toBe('Authentication failed.');
    });

    it('should return fallback message for 403 without detail', () => {
      const error = new ApiError('API error 403', 403, '');
      expect(getErrorMessage(error)).toBe('Access denied.');
    });

    it('should return fallback message for 404 without detail', () => {
      const error = new ApiError('API error 404', 404, {});
      expect(getErrorMessage(error)).toBe('Resource not found.');
    });

    it('should return fallback message for 500 without detail', () => {
      const error = new ApiError('API error 500', 500, {});
      expect(getErrorMessage(error)).toBe('Server error. Please try again later.');
    });

    it('should return fallback message for 502 Bad Gateway', () => {
      const error = new ApiError('API error 502', 502, {});
      expect(getErrorMessage(error)).toBe('Server error. Please try again later.');
    });

    it('should return fallback message for 503 Service Unavailable', () => {
      const error = new ApiError('API error 503', 503, {});
      expect(getErrorMessage(error)).toBe('Server error. Please try again later.');
    });

    it('should return fallback message for 504 Gateway Timeout', () => {
      const error = new ApiError('API error 504', 504, {});
      expect(getErrorMessage(error)).toBe('Server error. Please try again later.');
    });

    it('should return status code for unknown HTTP status', () => {
      const error = new ApiError('API error 418', 418, {});
      expect(getErrorMessage(error)).toBe('Error: 418');
    });
  });

  describe('Network errors', () => {
    it('should return connection message for fetch TypeError', () => {
      const error = new TypeError('Failed to fetch');
      expect(getErrorMessage(error)).toBe(
        'Unable to connect. Please check your internet connection.'
      );
    });

    it('should return connection message for fetch errors', () => {
      const error = new TypeError('NetworkError when attempting to fetch resource');
      expect(getErrorMessage(error)).toBe(
        'Unable to connect. Please check your internet connection.'
      );
    });
  });

  describe('Generic Error objects', () => {
    it('should return error message from Error object', () => {
      const error = new Error('Something went wrong');
      expect(getErrorMessage(error)).toBe('Something went wrong');
    });

    it('should return error message from custom Error subclass', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }
      const error = new CustomError('Custom error occurred');
      expect(getErrorMessage(error)).toBe('Custom error occurred');
    });
  });

  describe('Edge cases', () => {
    it('should return fallback message for null', () => {
      expect(getErrorMessage(null)).toBe('An unexpected error occurred. Please try again.');
    });

    it('should return fallback message for undefined', () => {
      expect(getErrorMessage(undefined)).toBe('An unexpected error occurred. Please try again.');
    });

    it('should return fallback message for string', () => {
      expect(getErrorMessage('some error')).toBe('An unexpected error occurred. Please try again.');
    });

    it('should return fallback message for number', () => {
      expect(getErrorMessage(404)).toBe('An unexpected error occurred. Please try again.');
    });

    it('should return fallback message for plain object', () => {
      expect(getErrorMessage({ message: 'error' })).toBe('An unexpected error occurred. Please try again.');
    });

    it('should return fallback message for Error without message', () => {
      const error = new Error();
      error.message = '';
      expect(getErrorMessage(error)).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle signup with existing email scenario', () => {
      const error = new ApiError(
        'API error 400',
        400,
        { detail: 'Email already registered' }
      );
      expect(getErrorMessage(error)).toBe('Email already registered');
    });

    it('should handle login with wrong password scenario', () => {
      const error = new ApiError(
        'API error 401',
        401,
        { detail: 'Invalid credentials' }
      );
      expect(getErrorMessage(error)).toBe('Invalid credentials');
    });

    it('should handle server down scenario', () => {
      const error = new TypeError('Failed to fetch');
      expect(getErrorMessage(error)).toBe(
        'Unable to connect. Please check your internet connection.'
      );
    });

    it('should handle database error scenario', () => {
      const error = new ApiError(
        'API error 500',
        500,
        { detail: 'Internal server error' }
      );
      expect(getErrorMessage(error)).toBe('Internal server error');
    });
  });
});
