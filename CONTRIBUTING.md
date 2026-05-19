# Contributing to Pocket Family

Thank you for your interest! Pocket Family is primarily a personal skills showcase project, but feedback, bug reports, and improvements are welcome.

## Getting Started

Follow the setup instructions in [README.md](README.md) to get the project running locally. The [CLAUDE.md](CLAUDE.md) file has comprehensive architecture documentation, coding standards, and common commands.

## Code Style

This project enforces a few strict conventions — please follow them:

- **No abbreviations**: Use full names (`transaction`, not `tx`; `account`, not `acc`)
- **No `any` types** in TypeScript — use proper interfaces
- **Inline comments** explaining *why*, not *what* (for non-obvious logic)
- **Full variable names**: `isLoadingTransactions` not `loading`

See the [Coding Standards section in CLAUDE.md](CLAUDE.md#critical-coding-standards) for the full list.

## Testing

All changes require tests:

- **Backend**: `cd backend && uv run pytest`
- **Frontend**: `cd frontend && npm run test:run`

New features need tests covering the happy path and error cases. Multi-tenant isolation must be validated in backend tests.

## Submitting Changes

1. Fork the repo and create a branch from `master`
2. For non-trivial changes, open an issue first to discuss the approach
3. Make your changes, add tests, and ensure existing tests pass
4. Submit a pull request with a clear description of what changed and why

## Reporting Bugs

Open a [GitHub Issue](https://github.com/BorisStricky/pocket-family/issues) with:
- Steps to reproduce
- Expected vs. actual behavior
- Environment details (OS, browser, Node/Python versions)
