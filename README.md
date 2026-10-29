# GroupSplits

Group expense splitting for trips and friend hangouts.

## Stack

React 19 + Vite 8 + TypeScript + Tailwind CSS 4 + Supabase + Vitest

## Commands

- `npm run dev` — dev server (localhost:5173)
- `npm run build` — typecheck + production build
- `npm run lint` — oxlint
- `npx vitest run` — tests
- `npm run icons` — regenerate favicon PNGs
- `npm run import:sheet -- <file.xlsx>` — import a trip spreadsheet to `src/data/harshilTrip.ts`

## Features

- Create trips, add members
- Add expenses: equal or custom split
- Quick-add presets: Cab, Cold drinks, Lunch, Homestay
- Balances per member, debt simplification / settle up
- Currency: ₹ (INR) via Intl
- Local persistence (localStorage) + Supabase cloud sync (auth)

## Supabase

- Client: `src/lib/supabase.ts`
- DB helpers: `src/lib/db.ts`
- Schema: `supabase/schema.sql`
- Env: `.env.example` → copy to `.env`, fill `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Docs

- `plan.md` — implementation plan
- `PRD.md` — product requirements

## Imported trip

The sheet `Harshil_Rishikesh_Trip Expense.xlsx` is imported once on first run as
**Harshil–Rishikesh Trip**: 6 members, 72 custom-split expenses, ₹61,750 itemised.

- Sheet columns = each member's share; the app stores them as custom split amounts.
- Payer comes from the sheet's cell colour legend (green Akshay, orange Chinta,
  grey Debashish, blue Bibhu, pink Ashish, yellow Ayush). Uncoloured rows default
  to Akshay.
- Sheet footer says ₹61,910; itemised shares add to ₹61,750 (the sheet's own
  totals differ by a few rupees on ~12 rows).
- Re-import with `npm run import:sheet -- "path\to\sheet.xlsx"`.
