# GroupSplits

Group expense splitting for trips and friend hangouts.

## Stack

React 19 + Vite 8 + TypeScript + Tailwind CSS 4 + Supabase + Vitest

## Commands

- `npm run dev` — dev server (localhost:5173)
- `npm run build` — typecheck + production build
- `npm run lint` — oxlint
- `npx vitest run` — tests

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
