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

## Sensitive Actions (PIN Protection)

Import, Reset, Decommission, and Add Asset are gated behind `PinModal.tsx`. The PIN is stored in sessionStorage. Always route new sensitive actions through this pattern.

## Key Utilities

- `src/lib/parseInventory.ts` — parses Excel files with flexible French/English column name mapping
- `src/lib/exportUtils.ts` — PDF (jsPDF) and Excel (XLSX) export
- `src/lib/zapierWebhook.ts` — Zapier webhook, URL persisted in localStorage

## Deployment

`deploy.sh` pushes to GitHub then SSHs into `karinventaire01.in.karavel.com` to pull, build, and restart PM2 (`karavundoboard-front`). The script requires a clean git working tree before running.
