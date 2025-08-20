create table if not exists incidents (
  id text primary key,
  title text not null,
  description text not null,
  status text not null default 'open',
  created_at integer not null,
  created_by text
);

create index if not exists idx_incidents_created_at on incidents(created_at);
create index if not exists idx_incidents_status on incidents(status);

create table if not exists incident_notes (
  id text primary key,
  incident_id text not null,
  note text not null,
  created_at integer not null,
  created_by text,
  foreign key (incident_id) references incidents(id)
);

create table if not exists audit_log (
  id text primary key,
  action text not null,
  actor text,
  target text,
  created_at integer not null,
  detail text
);