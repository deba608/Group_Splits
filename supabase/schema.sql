create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  members text[] not null,
  expenses jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists trips_user_id_idx on trips (user_id);

alter table trips enable row level security;

create policy "Users can view own trips"
  on trips for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own trips"
  on trips for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own trips"
  on trips for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own trips"
  on trips for delete
  to authenticated
  using (auth.uid() = user_id);
