---
documentation_status: New
overview: Covers fundamental TypeScript concepts including interfaces, type safety, generics, union types, and optional properties. Explains how TypeScript helps catch errors at compile time and improves code maintainability.
tags:
  - typescript
  - type-safety
---

# TypeScript

**Interface**: TypeScript structure defining the shape of an object. Used for props, API responses, domain models. Example: `interface User { id: string; email: string; }`

**Type Safety**: Catching errors at compile time instead of runtime. TypeScript checks that you're using correct types (string vs number, required vs optional fields).

**Generics**: Type parameters that make components/functions reusable with different types. Example: `ApiResponse<T>` can be `ApiResponse<User>` or `ApiResponse<Transaction>`.

**Union Types**: Type that can be one of several types. Example: `mode: 'login' | 'signup'` means mode can only be those two strings.

**Optional Properties**: Object properties that may or may not exist. Denoted with `?`. Example: `name?: string` means name can be string or undefined.
