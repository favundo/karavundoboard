# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Dev server on port 8080
npm run build     # Production build
npm run lint      # ESLint
npm run test      # Vitest (single run)
npm run test:watch
./deploy.sh       # Deploy to production (requires clean git state)
```

## Architecture

React 18 + TypeScript app with three independent dashboard sections for Karavel's IT inventory:

- **Siège et Groupes** → `src/pages/Index.tsx` → table `inventory_items`
- **Réseau Agences** → `src/pages/Agency.tsx` → table `agency_inventory`
- **ABcroisière** → `src/pages/Abcroisiere.tsx` → table `abcroisiere_inventory`

Each section follows the same pattern: a page component orchestrating stats cards, a data table, charts, and action modals. Components are scoped per section under `src/components/dashboard/`, `src/components/agency/`, `src/components/abcroisiere/`.

## Supabase

Client at `src/integrations/supabase/client.ts`, types in `src/integrations/supabase/types.ts`.
All data fetching goes through custom hooks in `src/hooks/` using TanStack React Query. Mutations invalidate their query key automatically. Batch upserts are used for imports (200 items/batch for siège, 500 for agencies).

## Authentication and Sensitive Actions

Access is gated by **Authelia** in front of Nginx, backed by Active Directory
(`in.karavel.com`). The portal is served at `/authelia` on the same vhost. Two AD
groups: `karinventaire-tech` grants access, `karinventaire-admin` grants the
destructive actions. See `deploy/authelia/README.md`.

The app learns who is connected through `GET /api/me` (`server/index.js`), which
echoes the `Remote-User` / `Remote-Groups` headers Authelia sets. Consume it via
`useMe()` / `useMeAsTechnician()` in `src/hooks/useMe.ts`. `uid` is the AD
`sAMAccountName` and matches both `src/lib/technicians.ts` ids and
`support_appointments.uid_technicien` — no mapping table.

Those headers are only trustworthy because Nginx **overwrites** any client-sent
`Remote-*` and because the API listens on `127.0.0.1` only. Never bind it to
`0.0.0.0`.

**Bulk-destructive actions** (Import, Reset) are reserved for
`karinventaire-admin`: wrap their trigger in `<AdminOnly>` and add
`if (!isAdmin) return <AdminRequired onClose={onClose} />;` inside the modal —
see `src/components/AdminOnly.tsx`. Route any new bulk action through this
pattern.

This is a guardrail against mistakes, **not a security boundary**: an
authenticated technician can still call PostgREST directly with the anon key
from the browser console. A real boundary would require routing writes through
the Express API, which can check `Remote-Groups` server-side.

## Key Utilities

- `src/lib/parseInventory.ts` — parses Excel files with flexible French/English column name mapping
- `src/lib/exportUtils.ts` — PDF (jsPDF) and Excel (XLSX) export
- `src/lib/zapierWebhook.ts` — Zapier webhook, URL persisted in localStorage

## Deployment

`deploy.sh` pushes to GitHub then SSHs into `karinventaire01.in.karavel.com` to pull, build, and restart PM2 (`karavundoboard-front`). The script requires a clean git working tree before running.
