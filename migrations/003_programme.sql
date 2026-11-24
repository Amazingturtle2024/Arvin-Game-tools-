create table if not exists programmes (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  revision integer not null,
  status text not null default 'draft',
  programme jsonb not null,
  created_at timestamptz not null default now(),
  unique (project_id, revision)
);

create index if not exists programmes_project_idx on programmes (project_id, revision desc);

create table if not exists programme_audit (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  programme_id uuid not null references programmes(id) on delete cascade,
  revision integer not null,
  at timestamptz not null default now(),
  actor text not null default '',
  action text not null,
  changes jsonb not null default '[]'::jsonb
);

create index if not exists programme_audit_project_idx on programme_audit (project_id, at desc);
