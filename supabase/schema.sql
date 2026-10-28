create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  members text[] not null,
  expenses jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists trips_user_id_idx on trips (user_id);
