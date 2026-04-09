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
- **Frontend**: React + Vite + TailwindCSS + React Query

## Artifacts

### CCTV Monitoring Dashboard (`artifacts/cctv-dashboard`)
- Light Finance branch CCTV monitoring web application
- Preview path: `/`
- Features: Dashboard with online/offline split view, Device management, User management, Audit logs, 2-min auto-refresh, manual refresh, Login system

### API Server (`artifacts/api-server`)
- Express 5 backend serving all REST API endpoints
- Preview path: `/api`

## Authentication

- Session-based login with HTTP-only cookie (7-day TTL)
- Default admin account: **username:** `admin` / **password:** `admin@123`
- Admin is auto-created on first server startup if not present
- Auth routes: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`

## Database Schema

Tables in `lib/db/src/schema/`:
- `devices` — CCTV devices with status, serial, branch, state, remark, **email**, offline_days
- `users` — System users with username, role (admin/operator/viewer), isActive
- `audit_logs` — Complete audit trail of all user/system actions
- `settings` — Key-value store for app configuration (SMTP, Hik-Connect credentials)

## Database Migrations

Migrations are in `lib/db/drizzle/`. The API server **auto-runs migrations on every startup** before accepting requests — no manual step needed on fresh deploys or new environments.

### ⚠️ IMPORTANT — Migration Checklist (MANDATORY before deploy)

Every time the database schema is changed, you MUST run these steps or the app will fail on fresh deploys:

1. Update schema in `lib/db/src/schema/`
2. Run `cd lib/db && pnpm drizzle-kit generate` to generate the migration SQL
3. Verify the new `.sql` file appears in `lib/db/drizzle/`
4. Verify `lib/db/drizzle/meta/_journal.json` has the new entry
5. Restart the API server — migrations run automatically

**Current migrations:**
| File | Description |
|------|-------------|
| `0000_clear_dust.sql` | Initial schema: devices, users, audit_logs, settings |
| `0001_add_email_to_devices.sql` | Added `email` column to `devices` table |

### Adding a new migration

```bash
cd lib/db && pnpm drizzle-kit generate
```

Then restart the API server. The migration runs automatically on startup.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only, bypasses migrations)
- `cd lib/db && pnpm drizzle-kit generate` — generate new migration from schema changes
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/cctv-dashboard run dev` — run frontend locally

## API Endpoints

All endpoints prefixed with `/api`:
- `POST /auth/login` — login (username + password)
- `POST /auth/logout` — logout
- `GET /auth/me` — current session user
- `GET /devices` — list devices (filter by status, state, search)
- `POST /devices` — add device
- `POST /devices/bulk` — bulk import devices (Excel: State, Branch, Serial, Email)
- `POST /devices/refresh` — manual refresh
- `GET /devices/stats/summary` — dashboard stats
- `GET /devices/offline-streak` — offline devices sorted by streak
- `PATCH /devices/:id` — update device/remark
- `DELETE /devices/:id` — delete device
- `GET /users` — list users
- `POST /users` — create user
- `PATCH /users/:id` — update user
- `DELETE /users/:id` — delete user
- `GET /audit-logs` — paginated audit logs
- `GET /audit-logs/recent` — last 20 entries
- `GET /settings` — get all settings
- `POST /settings/hikconnect` — save Hik-Connect credentials
- `POST /settings/email` — save SMTP settings
- `POST /settings/email/test` — test SMTP connection

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
