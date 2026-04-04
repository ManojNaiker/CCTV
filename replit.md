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
- Features: Dashboard with online/offline split view, Device management, User management, Audit logs, 2-min auto-refresh, manual refresh

### API Server (`artifacts/api-server`)
- Express 5 backend serving all REST API endpoints
- Preview path: `/api`

## Database Schema

Tables in `lib/db/src/schema/`:
- `devices` — CCTV devices with status, serial, branch, state, remark, offline_days
- `users` — System users with username, role (admin/operator/viewer), isActive
- `audit_logs` — Complete audit trail of all user/system actions

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/cctv-dashboard run dev` — run frontend locally

## API Endpoints

All endpoints prefixed with `/api`:
- `GET /devices` — list devices (filter by status, state, search)
- `POST /devices` — add device
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

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
