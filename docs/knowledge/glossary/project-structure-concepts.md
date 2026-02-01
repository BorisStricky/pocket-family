---
documentation_status: New
overview: Covers architectural patterns for organizing React applications including feature-based organization, atomic design principles, and page structure. Explains how to create maintainable and scalable project structures.
tags:
  - react
  - architecture
  - design-patterns
  - project-structure
---

# Project Structure Concepts

**Feature-Based Organization**: Grouping code by business feature (auth, transactions, accounts) rather than technical type (components, hooks). Each feature has its own components, hooks, API functions.

**Atomic Design**: Component hierarchy:
- **Atoms**: Basic building blocks (Button, Input)
- **Molecules**: Simple combinations (SearchInput with icon)
- **Organisms**: Complex components (TransactionsList, AppShell)

**Pages**: Top-level components that represent routes. Connect data (hooks) to presentation (components). Examples: LoginPage, SignupPage, DashboardPage.

**Public vs Protected Pages**: Public pages (landing, login, signup) are accessible without authentication. Protected pages (dashboard, transactions) require user to be logged in.
