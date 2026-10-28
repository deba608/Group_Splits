# Supabase Setup Guide

## 1. Create project

- supabase.com → sign in → **New project**
- Name: `group-splits`
- Region: nearest

## 2. Get credentials

- Dashboard → **Settings** → **API**
- Copy: Project URL, anon public key

## 3. Run schema

- Dashboard → **SQL Editor**
- Paste `supabase/schema.sql`
- Run

## 4. Enable auth

- Dashboard → **Authentication** → **Sign In / Up**
- Enable **Email** provider (password)

## 5. Env vars

- Copy `.env.example` → `.env`
- Fill:

```
VITE_SUPABASE_URL=<project-url>
VITE_SUPABASE_ANON_KEY=<anon-key>
```

## 6. Restart + verify

- Stop dev server, restart
- Open localhost:5173
- Sign in via UI
- Create trip → should save to cloud

## 7. RLS

`supabase/schema.sql` includes table + index. For prod, enable RLS + per-user policies (see guide above in SQL).
