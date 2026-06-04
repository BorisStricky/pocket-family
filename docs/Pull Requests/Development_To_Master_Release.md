# Development → Master Release

**Branch:** `development` → `master`
**Last Updated:** 2026-06-03

## Overview

This release promotes everything merged into `development` since the last master sync. It covers six feature/fix PRs: the CSV import worker migration to AWS Lambda (with follow-up hardening), production schema governance with Alembic, credit-card-aware CSV classification, the interactive monthly reports page, and a full sweep of dependency security advisories. It also reconciles squash-merge history divergence left over from the prior release cycle — no code impact from that reconciliation.

## PRs Included

| PR | Title | Type |
|---|---|---|
| #41 | Dev deployment for CSV import service | Infra |
| #42 | Make Alembic authoritative for prod schema | Infra |
| #43 | Restructure agent config into nested CLAUDE.md files | Tooling |
| #44 | Move CSV import worker from ECS Fargate → AWS Lambda | Infra / Backend |
| #51 | Credit-card-aware expense/income classification on CSV import | Feature |
| #52 | Interactive monthly reports page with cross-filter charts | Feature |
| #53 | Dependabot security updates (idna, urllib3, postcss, vite, vitest) | Security |
| #54 | Fix 3 moderate npm audit advisories (react-router, ws) | Security |
| #55 | Fix 9 backend pip-audit advisories (PyJWT, python-dotenv, mako) | Security |
| #56 | Upgrade FastAPI 0.115.2 → 0.136.3 to clear 3 starlette advisories | Security |

Plus five unmerged commits that hardened the Lambda post-#44:
`a8f7904` Fix image manifest / concurrency / S3 lifecycle  
`229eb21` IAM update for Lambda  
`640c40c` Backend SQS IAM + Lambda image manifest  
`020659f` Fix Lambda cold-start: make copied app tree world-readable  
`d1661a0` Run Lambda outside the VPC to reach public Aurora endpoint  

## Goals Achieved

- **Lambda migration complete**: CSV import worker runs on SQS-triggered Lambda, scales to zero when idle; ECS Fargate import worker retired
- **Schema governance**: Alembic owns production schema; `create_all()` gated behind `AUTO_CREATE_SCHEMA=1` (dev only); deploy pipeline runs `alembic upgrade head` before rollout
- **Credit-card imports work correctly**: Sign convention is now user-selectable with a smart default per account type; explicit Type column still wins
- **Monthly reports shipped**: Four linked interactive charts (category pie, daily bar, account/user donut, KPI totals) with bidirectional cross-filter, subcategory roll-up, and multi-currency support
- **Zero known dependency vulnerabilities**: All 15+ advisories cleared across backend (pip-audit) and frontend (npm audit)
- **Agent config modernised**: Module-level CLAUDE.md files replace standalone agents; orchestrate loop runs as a Dynamic Workflow

## Architecture & Tech Stack Changes

- **Lambda** replaces **ECS Fargate** for the CSV import worker; same SQS queue, same `process_import()` core, no backend API change
- **FastAPI 0.115.2 → 0.136.3** (starlette 0.40 → 1.x) — major framework bump; starlette 1.x deprecation warnings on two status constants noted, cleanup deferred
- **`AUTO_CREATE_SCHEMA`** environment flag introduced; all env templates updated
- **Alembic `migrate.tf`** ECS task added for production migration automation

## Directory Structure

```
backend/api/app/
  routers/imports.py        ✏️ _parse_amount gains positive_is_expense; starlette 1.x deprecation note
  schemas.py                ✏️ AnalyzeRequest gains positive_amounts_are_expenses: bool = False
  db.py                     ✏️ init_db() gated behind AUTO_CREATE_SCHEMA flag
backend/api/tests/
  test_imports_helpers.py   ✏️ new TestParseAmountCreditCardConvention class
  test_imports_endpoints.py ✏️ credit flip / default regression / type-column fallback tests
backend/pyproject.toml      ✏️ PyJWT 2.13.0, python-dotenv 1.2.2, fastapi 0.136.3 pins
backend/uv.lock             ✏️ resolved lockfile

frontend/src/
  components/molecules/
    MonthPicker.tsx               🆕 MonthPicker + getMonthRange + getCurrentYearMonth
    index.ts                      ✏️ exports MonthPicker and helpers
  features/
    reports/
      types.ts                    🆕 ReportDimension, ReportSelection, ReportSlice, DailyAmount, MonthlyReportData
      utils.ts                    🆕 CHART_COLORS, formatReportAmount
      hooks/useMonthlyReport.ts   🆕 client-side aggregation with cross-filter
      components/
        CategoryPieChart.tsx      🆕 expense pie + roll-up toggle
        DailyAmountsBarChart.tsx  🆕 grouped income/expense bar
        ReportTotals.tsx          🆕 KPI cards
        UserAccountDonut.tsx      🆕 nested account/user donut
      pages/ReportsPage.tsx       ✏️ replaced UnderConstruction stub
    imports/
      components/steps/MapColumnsStep.tsx  ✏️ credit-card convention checkbox
      types.ts                             ✏️ positive_amounts_are_expenses field
    transactions/pages/TransactionsPage.tsx ✏️ MonthPicker primary filter, DateRangePicker in Collapse
  lib/__tests__/monthRange.test.ts  🆕 unit tests for date helpers
  __tests__/
    reports.integration.test.tsx     🆕 ReportsPage integration tests
    imports.integration.test.tsx     ✏️ credit-on/debit-off checkbox tests
    transactions.integration.test.tsx ✏️ MonthPicker + custom range tests
frontend/package.json       ✏️ react-router-dom patch
frontend/package-lock.json  ✏️ ws, react-router resolved

import-service/             ✏️ Lambda handler, Dockerfile.lambda, hardening (world-readable tree, VPC-external)
infrastructure/             ✏️ lambda.tf, migrate.tf, IAM roles, ECR repo, S3 lifecycle, env templates
.claude/                    ✏️ nested CLAUDE.md files, orchestrate DW skill, settings.json (sandbox off)
docs/
  feature-report-plan.md             🆕 planning document for reports feature
  glossary.md                        🆕 project glossary
  Pull Requests/
    Import_Credit_Card_Classification_PR.md  🆕
    Monthly_Reports_Release.md               🆕
```

## Testing Strategy

| Test suite | Result |
|---|---|
| Backend pytest (231 tests) | ✅ all pass |
| Frontend Vitest (141 tests) | ✅ all pass |
| pip-audit | 0 known vulnerabilities |
| npm audit | 0 vulnerabilities |

## Migration Notes

- `AUTO_CREATE_SCHEMA` must be set to `0` (or omitted) in all non-dev environments — already defaulted in the updated env templates
- FastAPI 0.136.3 / starlette 1.x: two deprecated status constants (`HTTP_422_UNPROCESSABLE_ENTITY`, `HTTP_413_REQUEST_ENTITY_TOO_LARGE`) will emit warnings until a follow-up rename; non-breaking
- Lambda deployment requires the updated IAM role and SQS event source mapping in `lambda.tf`; apply terraform before deploying the Lambda image

## Note on Squash-Merge History Reconciliation

Master's previous release used a squash merge that compresses the underlying commits. This PR resolves the resulting divergence — master's squashed snapshot is superseded by development's individual commits. No code is reverted or changed; this is purely a history reconciliation. Resolve all merge conflicts by accepting the development side.

## Related Documentation

- [docs/Pull Requests/Import_Credit_Card_Classification_PR.md](Import_Credit_Card_Classification_PR.md)
- [docs/Pull Requests/Monthly_Reports_Release.md](Monthly_Reports_Release.md)
- [docs/Pull Requests/csv-import-lambda_PR.md](csv-import-lambda_PR.md)
- [docs/SystemArchitecture.md](../SystemArchitecture.md)
