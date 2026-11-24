create table if not exists projects (
  id uuid primary key,
  owner_id text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'draft'
);

create index if not exists projects_owner_idx on projects (owner_id, updated_at desc);

create table if not exists documents (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  filename text not null,
  mime text not null,
  byte_size integer not null,
  bytes bytea not null,
  parsed jsonb,
  created_at timestamptz not null default now()
);

create index if not exists documents_project_idx on documents (project_id);

create table if not exists analysis_runs (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  report jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists analysis_runs_project_idx on analysis_runs (project_id, created_at desc);
