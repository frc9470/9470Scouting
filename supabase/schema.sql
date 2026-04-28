create table if not exists public.match_submissions (
  id text primary key,
  original_submission_id text,
  version_id text not null,
  version_number integer not null,
  device_id text not null,
  event_key text,
  match_number integer,
  team_number text not null,
  scouter_name text not null,
  alliance text not null check (alliance in ('red', 'blue', 'unknown')),
  station text,
  submitted_at timestamptz not null,
  deleted boolean not null default false,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists match_submissions_event_match_idx
  on public.match_submissions (event_key, match_number);

create index if not exists match_submissions_team_idx
  on public.match_submissions (team_number);

create index if not exists match_submissions_submitted_at_idx
  on public.match_submissions (submitted_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists match_submissions_set_updated_at on public.match_submissions;

create trigger match_submissions_set_updated_at
before update on public.match_submissions
for each row
execute function public.set_updated_at();

alter table public.match_submissions enable row level security;

drop policy if exists "event clients can read match submissions" on public.match_submissions;
drop policy if exists "event clients can insert match submissions" on public.match_submissions;
drop policy if exists "event clients can update match submissions" on public.match_submissions;

-- Event-window MVP policy:
-- The anon key is public in browser apps, so these policies intentionally allow
-- any app client with the project anon key to read/write scouting submissions.
-- Replace these with authenticated or event-code-gated policies before using
-- this database for anything beyond short-lived event scouting data.
create policy "event clients can read match submissions"
on public.match_submissions
for select
to anon
using (true);

create policy "event clients can insert match submissions"
on public.match_submissions
for insert
to anon
with check (true);

create policy "event clients can update match submissions"
on public.match_submissions
for update
to anon
using (true)
with check (true);
