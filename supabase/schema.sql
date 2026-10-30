-- GroupSplits schema.
-- Safe to run repeatedly: every change is guarded.

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  members text[] not null,
  expenses jsonb not null default '[]'::jsonb,
  currency text not null default 'INR',
  lock_data jsonb,
  created_at timestamptz not null default now()
);

-- Older installs created the table without these.
alter table public.trips
  add column if not exists currency text not null default 'INR';

alter table public.trips
  add column if not exists lock_data jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trips_user_id_fkey'
  ) then
    alter table public.trips
      add constraint trips_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete cascade;
  end if;
end
$$;

create index if not exists trips_user_id_idx on public.trips (user_id);
create index if not exists trips_user_created_idx
  on public.trips (user_id, created_at desc);

alter table public.trips enable row level security;

drop policy if exists "Users can view own trips" on public.trips;
create policy "Users can view own trips"
  on public.trips for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own trips" on public.trips;
create policy "Users can insert own trips"
  on public.trips for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own trips" on public.trips;
create policy "Users can update own trips"
  on public.trips for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own trips" on public.trips;
create policy "Users can delete own trips"
  on public.trips for delete
  to authenticated
  using ((select auth.uid()) = user_id);
