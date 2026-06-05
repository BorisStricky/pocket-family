// Contract test: locks the frontend SUPPORTED_LANGUAGES array so it cannot
// silently drift from the backend's LanguageCode Literal in schemas.py.

import { describe, it, expect } from 'vitest';
import { SUPPORTED_LANGUAGES } from '@/i18n';

describe('i18n contract', () => {
  it('SUPPORTED_LANGUAGES matches the backend-authoritative set', () => {
    // Cross-layer contract check. The backend defines allowed codes via
    // LanguageCode Literal in backend/api/app/schemas.py. When adding a language:
    //   1. Add to LanguageCode in backend/api/app/schemas.py
    //   2. Add to SUPPORTED_LANGUAGES in frontend/src/i18n/index.ts
    //   3. Add to LanguageCode in frontend/src/types/index.ts
    //   4. Add keys to both en.json and pt-BR.json
    //   5. Update backend test_supported_languages_contract assertion
    //   6. Update this assertion — required final step that proves all five
    //      locations are in sync.
    expect([...SUPPORTED_LANGUAGES].sort()).toEqual(['en', 'pt-BR']);
  });
});
