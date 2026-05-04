# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Mad Factory — Database Schema Notes

The Mad Factory app uses a normalized PostgreSQL schema in `lib/db/src/schema/` with all foreign keys enforced at the database level.

### Master tables
`customers`, `suppliers`, `materials`, `employees`, `shareholders`, `exchange_rates`, `app_settings`.

### Document tables (header + lines)
- `sales_invoices` → `sales_invoice_items`
- `purchase_invoices` → `purchase_invoice_items`

Purchase invoices store a snapshot of the exchange rate (`exchange_rate_value`) at creation time so historical totals stay accurate even if the rate table is edited later.

### Ledger / payment tables
`customer_payments`, `supplier_payments`, `payroll_entries`, `expenses`, `incomes`, `shareholder_transactions`. Customer/supplier statements are computed on the fly by joining invoices + payments + opening balance.

### Foreign-key behavior
- Invoice → customer/supplier: `RESTRICT` (cannot delete a party who has documents).
- Invoice items → invoice: `CASCADE` (items removed with their invoice).
- Items / payments → exchange_rate or material: `SET NULL` (preserve `material_name` snapshot, exchange-rate value stored on the row).
- Payroll → employee, customer/supplier payments → party: `RESTRICT`.
- Shareholder transactions → shareholder: `CASCADE`.

### Unique constraints
- `exchange_rates.rate_date` — one rate per date.
- `payroll_entries (employee_id, period)` — one payroll row per employee per month.
- `sales_invoices.invoice_number`, `purchase_invoices.invoice_number`, `employees.code`.

### Indexes
All FK columns and date columns are indexed for fast statement/report queries.

### Offline-first readiness
Every transactional row carries `sync_status` (default `local`) and stable serial IDs; soft-delete via `deleted_at` on master/document tables; timestamps on every row.

## Final Delivery Plan (when user signals "done")

The user will eventually request TWO deliverables. Keep these in mind during all future development so packaging is painless:

### 1. Offline desktop installer (Windows .exe)
- Single installable `.exe` that bundles everything: frontend, API server, database, and runtime.
- Must work fully offline with no external dependencies after install.
- Recommended approach when packaging: Electron (or Tauri) shell + bundled local DB.
  - **DB strategy**: switch from Postgres to embedded Postgres (e.g. `embedded-postgres` npm pkg) OR migrate Drizzle to SQLite (`better-sqlite3`). Drizzle's schema is portable; the FK behaviors and unique constraints in this app translate cleanly to SQLite.
  - Bundle the API Express server as a child process inside Electron's main process.
  - Frontend served from local files via Electron BrowserWindow.
- Build tool: `electron-builder` (NSIS target → `.exe`).

### 2. Online hosting zip bundle
- A `.zip` the user uploads to their own host (cPanel / VPS / etc).
- Contents: built frontend (`artifacts/mad-factory/dist`), built API server (`artifacts/api-server/dist`), `package.json` + `node_modules` instructions, Drizzle migration files, `.env.example`, README in Kurdish with deployment steps.
- Build tool: `pnpm run build` then a `pack-online.sh` script to zip selected outputs.

### Coding rules to keep BOTH paths viable
- **Never hardcode Replit-specific URLs/paths**. Always use `import.meta.env.BASE_URL`, `process.env.PORT`, and relative API paths.
- **Never depend on Replit Auth or other Replit-only services in production code paths**. Auth must work standalone (current Express session auth is fine).
- **Keep DB layer abstracted**: all DB access goes through Drizzle in `lib/db/src/` so we can swap Postgres → SQLite later with minimal page changes. Avoid raw Postgres-specific SQL.
- **Avoid native modules unless absolutely necessary** (they complicate Electron bundling). If unavoidable, document them.
- **Keep all secrets read from `process.env`** with a documented `.env.example`.
- **Keep file uploads & object-storage usage abstracted** so they can be swapped to local disk in the offline build.
- Migration files (`lib/db/migrations/`) must stay clean and runnable from a fresh DB — both deliverables will run them on first launch.
