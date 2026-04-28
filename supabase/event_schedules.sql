-- ── Event Schedules ─────────────────────────────────────────
-- Synced from the lead's device so all scouters get the TBA schedule.

create table if not exists public.event_schedules (
  event_key text primary key,
  fetched_at timestamptz not null default now(),
  match_count integer not null default 0,
  matches jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Updated-at trigger
drop trigger if exists event_schedules_set_updated_at on public.event_schedules;
create trigger event_schedules_set_updated_at
  before update on public.event_schedules
  for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────
alter table public.event_schedules enable row level security;

drop policy if exists "authenticated users can read schedules" on public.event_schedules;
create policy "authenticated users can read schedules"
  on public.event_schedules for select
  to authenticated
  using (true);

drop policy if exists "leads can insert schedules" on public.event_schedules;
create policy "leads can insert schedules"
  on public.event_schedules for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('lead', 'admin')
    )
  );

drop policy if exists "leads can update schedules" on public.event_schedules;
create policy "leads can update schedules"
  on public.event_schedules for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('lead', 'admin')
    )
  );
