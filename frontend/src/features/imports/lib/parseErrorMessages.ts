// src/features/imports/lib/parseErrorMessages.ts
// Maps backend-generated CSV parse exception strings to friendly, localised
// user-facing messages.
//
// Why this lives on the frontend: the backend emits locale-agnostic str(exception)
// text (e.g. "Cannot parse amount: 'abc'", "Invalid isoformat string"). Rather
// than adding i18n machinery to the backend, we bucket the known technical
// patterns here and return the corresponding translated string. If the backend
// later emits an unrecognised message we fall back to showing it verbatim, so
// novel errors are never silently swallowed.

import type { TFunction } from 'i18next';

/**
 * Translates a raw backend parse-error string into a localised, user-friendly
 * message.
 *
 * Matching is case-insensitive so minor backend wording changes don't break the
 * buckets. The known backend families are:
 *   - Amount failures:  "Cannot parse amount: …"
 *   - ISO date errors:  "Invalid isoformat string"
 *   - Out-of-range:     "out of range" / "month must be in 1..12" / "year … is out of range"
 *   - Unknown format:   "Unknown string format" / "String does not contain a date"
 *   - Everything else:  returned verbatim as graceful fallback
 */
export function translateParseError(rawMessage: string, t: TFunction): string {
  const normalizedMessage = rawMessage.toLowerCase();

  if (normalizedMessage.startsWith('cannot parse amount:')) {
    return t('imports.parseError.invalidAmount');
  }

  if (normalizedMessage.includes('invalid isoformat string')) {
    return t('imports.parseError.invalidDate');
  }

  if (
    normalizedMessage.includes('out of range') ||
    normalizedMessage.includes('month must be in 1..12')
  ) {
    return t('imports.parseError.dateOutOfRange');
  }

  if (
    normalizedMessage.includes('unknown string format') ||
    normalizedMessage.includes('string does not contain a date')
  ) {
    return t('imports.parseError.unrecognizedDateFormat');
  }

  // Graceful fallback: surface the raw backend message so users and developers
  // can still read novel errors that don't match any known bucket.
  return rawMessage;
}
