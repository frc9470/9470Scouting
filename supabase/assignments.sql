-- ── Scout Assignments ───────────────────────────────────────
-- Synced from the lead's device to all scouters.

create table if not exists public.scout_assignments (
  id text primary key,
  event_key text not null,
  match_id text not null,
  match_number integer not null,
  label text not null,
  team_number text not null,
  alliance text not null check (alliance in ('red', 'blue')),
  station text not null,
  scouter_id text not null,
  scouter_name text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists scout_assignments_event_idx
  on public.scout_assignments (event_key);

create index if not exists scout_assignments_scouter_idx
  on public.scout_assignments (scouter_name);

create index if not exists scout_assignments_match_idx
  on public.scout_assignments (event_key, match_number);

-- ── RLS ─────────────────────────────────────────────────────
alter table public.scout_assignments enable row level security;

-- All authenticated users can read assignments
drop policy if exists "authenticated users can read assignments" on public.scout_assignments;
create policy "authenticated users can read assignments"
  on public.scout_assignments for select
  to authenticated
  using (true);

-- Only leads/admins can write assignments
drop policy if exists "leads can insert assignments" on public.scout_assignments;
create policy "leads can insert assignments"
  on public.scout_assignments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('lead', 'admin')
    )
  );

drop policy if exists "leads can update assignments" on public.scout_assignments;
create policy "leads can update assignments"
  on public.scout_assignments for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('lead', 'admin')
    )
  );

drop policy if exists "leads can delete assignments" on public.scout_assignments;
create policy "leads can delete assignments"
  on public.scout_assignments for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('lead', 'admin')
    )
  );

-- ── Migration: link assignments to auth users ───────────────
alter table public.scout_assignments
  add column if not exists user_id uuid references auth.users(id);

create index if not exists scout_assignments_user_idx
  on public.scout_assignments (user_id);
