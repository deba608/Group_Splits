# GroupSplits

Group expense splitting for trips and friend hangouts.

## Stack

React 19 + Vite 8 + TypeScript + Tailwind CSS 4 + Supabase + Vitest + oxlint

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (localhost:5173) |
| `npm run build` | Typecheck (`tsc -b`) + production build |
| `npm run lint` | oxlint |
| `npm run preview` | Production preview |
| `npm run test` | Vitest (watch mode); `npx vitest run` for a single run |
| `npm run icons` | Regenerate favicon PNGs (`scripts/gen-icons.mjs`) |
| `npm run import:sheet -- <file.xlsx>` | Import a trip spreadsheet (`scripts/import-xlsx.mjs`) |

## Features

- Create trips, add members, set currency (INR / USD / EUR / GBP / JPY via `Intl`)
- Add expenses: equal or custom split with rounding; date, time, place, receipt image
- Recurring expenses (weekly / monthly) that auto-generate instances
- Quick-add presets: Cab, Cold drinks, Lunch, Dinner, Homestay, Groceries, Tickets
- Balances per member, pending balances after recorded payments, debt simplification / settle-up plan
- Record part-payments (who paid whom, amount, date, note); edit or delete them
- Edit or delete expenses; undo toasts for deletes
- Per-trip passcode lock: content encrypted locally and in the cloud (PBKDF2 + AES-GCM-256)
- Local persistence (`localStorage`) + Supabase cloud sync (email / password, magic link)
- Export trip as JSON, CSV (Excel), PDF (print), or copy summary text to clipboard
- Date-range filter for expenses; trip rename; member rename / remove
- React error boundary; PWA manifest + icons

## Supabase

- Client: `src/lib/supabase.ts`
- DB helpers: `src/lib/db.ts`
- Schema: `supabase/schema.sql` (idempotent) + migration `supabase/migrations/20261029000000_trips_currency_and_policies.sql`
- Env: copy `.env.example` → `.env`, fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Full setup: see `supabase/GUIDE.md`

How sync works:

- Signed out: trips live in `localStorage` only.
- Signed in: the app loads the account's trips from Supabase first, then pushes every local change (upsert) and deletes cloud rows that no longer exist locally, so deletions propagate across devices.
- If the cloud is unreachable, `localStorage` stays the source of truth and the next successful sync catches up.
- Row-level security: each user can only read/write their own trips (`auth.uid() = user_id`).

## Tests

43 tests across 6 files (`splits`, `crypto`, `format`, `id`, `seed`, `harshilTrip`), run with `npx vitest run`.

## Docs

- `plan.md` — implementation plan
- `PRD.md` — product requirements
- `supabase/GUIDE.md` — Supabase project setup

## Imported trip

The sheet `Harshil_Rishikesh_Trip Expense.xlsx` is imported once on first run as **Harshil–Rishikesh Trip**: 6 members (Akshay, Chinta, Debashish, Bibhu, Ashish, Ayush), 72 custom-split expenses, ₹61,750 itemised, created 2026-10-17.

- Sheet columns = each member's share; the app stores them as custom split amounts.
- Payer comes from the sheet's cell colour legend (green Akshay, orange Chinta, grey Debashish, blue Bibhu, pink Ashish, yellow Ayush). Uncoloured rows belong to Debashish; installs seeded before that fix have the payers corrected once.
- Sheet footer says ₹61,910; itemised shares add to ₹61,750 (the sheet's own totals differ by a few rupees on ~12 rows).
- Re-import with `npm run import:sheet -- "path\to\sheet.xlsx"`.
