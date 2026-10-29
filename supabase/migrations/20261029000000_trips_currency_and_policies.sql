-- Adds per-trip currency, a cascading user foreign key, a lookup index, and
-- idempotent RLS policies. Run once on existing projects (or re-run schema.sql).

alter table public.trips
  add column if not exists currency text not null default 'INR';

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

create index if not exists trips_user_created_idx
  on public.trips (user_id, created_at desc);

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
