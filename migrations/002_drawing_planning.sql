create table if not exists production_rates (
  id uuid primary key,
  owner_id text not null,
  activity_key text not null,
  label text not null,
  unit text not null,
  rate_per_day double precision,
  workers integer not null default 1,
  teams integer not null default 1,
  plant text not null default '',
  hours_per_day double precision not null default 8,
  days_per_week double precision not null default 5,
  site_conditions text not null default '',
  accessibility text not null default '',
  weather_allowance_pct double precision not null default 0,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique (owner_id, activity_key)
);

create index if not exists production_rates_owner_idx on production_rates (owner_id);

create table if not exists drawing_runs (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  report jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists drawing_runs_project_idx on drawing_runs (project_id, created_at desc);
