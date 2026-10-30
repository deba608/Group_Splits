# Supabase Setup Guide

## 1. Create project

- supabase.com → sign in → **New project**
- Name: `group-splits`
- Region: nearest

## 2. Get credentials

- Dashboard → **Settings** → **API**
- Copy: Project URL, anon public key

## 3. Run schema

Two options:

**Option A — Supabase CLI (recommended)**

```bash
# One-time setup
supabase init
supabase link --project-ref <your-project-ref>

# Push schema + migrations to the remote project
supabase db push
```

**Option B — Dashboard**

- Dashboard → **SQL Editor**
- Paste `supabase/schema.sql` and run it

The script is idempotent, so re-running it is safe. On a project that already
has the `trips` table, run
`supabase/migrations/20261029000000_trips_currency_and_policies.sql` instead
(or just re-run `schema.sql`).

## 4. Enable auth

- Dashboard → **Authentication** → **Sign In / Up**
- Enable **Email** provider (password and magic link both work)

## 5. Env vars

- Copy `.env.example` → `.env`
- Fill:

```
VITE_SUPABASE_URL=<project-url>
VITE_SUPABASE_ANON_KEY=<anon-key>
```

## 6. Restart + verify

- Stop dev server, restart it
- Open the app, sign up / sign in
- Create a trip → reload → trip should still be there
- Sign in on another device → same trips

## 7. How sync works

- Signed out: trips live in `localStorage` only.
- Signed in: the app loads the account's trips from Supabase first, then pushes
  every local change (upsert) and deletes cloud rows that no longer exist
  locally, so deletions propagate.
- If the cloud is unreachable, `localStorage` stays the source of truth and the
  next successful sync catches up.
- Trip ids are UUIDs because they double as the database primary key. Legacy
  local ids are upgraded on load.
- If the `currency` column has not been added yet, sync falls back to saving the
  core fields instead of failing.

## 8. RLS

`schema.sql` enables RLS and creates per-user policies for select, insert,
update, and delete using `auth.uid() = user_id`. Anonymous requests cannot read
or write rows (verified: 401).
