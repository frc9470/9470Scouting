-- ── Scout Shifts ────────────────────────────────────────────
-- Lead-managed shift blocks with station rosters and sub overrides.

create table if not exists public.scout_shifts (
  id text primary key,
  event_key text not null,
  name text not null,
  start_match integer not null,
  end_match integer not null,
  roster jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists scout_shifts_event_idx
  on public.scout_shifts (event_key);

drop trigger if exists scout_shifts_set_updated_at on public.scout_shifts;
create trigger scout_shifts_set_updated_at
  before update on public.scout_shifts
  for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────
alter table public.scout_shifts enable row level security;

drop policy if exists "authenticated users can read shifts" on public.scout_shifts;
create policy "authenticated users can read shifts"
  on public.scout_shifts for select
  to authenticated
  using (true);

drop policy if exists "leads can insert shifts" on public.scout_shifts;
create policy "leads can insert shifts"
  on public.scout_shifts for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('lead', 'admin')
    )
  );

drop policy if exists "leads can update shifts" on public.scout_shifts;
create policy "leads can update shifts"
  on public.scout_shifts for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('lead', 'admin')
    )
  );

drop policy if exists "leads can delete shifts" on public.scout_shifts;
create policy "leads can delete shifts"
  on public.scout_shifts for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('lead', 'admin')
    )
  );

-- ── Profile group column ────────────────────────────────────
alter table public.profiles
  add column if not exists "group" text check ("group" in ('student', 'parent'));

-- Allow users to update their own group
drop policy if exists "users can set own group" on public.profiles;
create policy "users can set own group"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Allow leads/admins to update any profile (group, role)
drop policy if exists "leads can update profiles" on public.profiles;
create policy "leads can update profiles"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('lead', 'admin')
    )
  );
