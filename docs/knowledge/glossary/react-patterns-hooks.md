---
documentation_status: New
overview: Covers common React patterns and hooks including custom hooks, useState, useEffect, and controlled components. Explains how to encapsulate reusable logic and manage side effects in React applications.
tags:
  - react
  - hooks
  - typescript
  - patterns
---

# React Patterns & Hooks

**Custom Hooks**: Functions starting with `use` that encapsulate reusable logic. We created:
- `useAuth()`: Access auth context (user, login status, tokens)
- `useLogin()`: Login mutation with token storage
- `useSignup()`: Signup mutation
- `useLogout()`: Logout mutation with cleanup

**useEffect Hook**: Runs side effects (API calls, subscriptions, etc.) when component mounts or dependencies change. Example: Check auth status on mount, redirect if authenticated.

**useState Hook**: Creates state variable and setter function. Example: `const [email, setEmail] = useState('')` for form inputs.

**Controlled Components**: Form inputs where React state is the single source of truth. Value comes from state, changes update state via `onChange`. Better than uncontrolled (DOM is source of truth).
