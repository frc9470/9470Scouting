-- ── Profiles ────────────────────────────────────────────────
-- Auto-populated from auth.users on Google sign-in.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text,
  avatar_url text,
  role text not null default 'scouter' check (role in ('scouter', 'lead', 'admin')),
  scouting_status text not null default 'active' check (scouting_status in ('active', 'spectator')),
  availability jsonb not null default '[]'::jsonb check (jsonb_typeof(availability) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

alter table public.profiles
  add column if not exists availability jsonb not null default '[]'::jsonb;

alter table public.profiles
  add column if not exists scouting_status text not null default 'active'
  check (scouting_status in ('active', 'spectator'));

create index if not exists profiles_scouting_status_idx on public.profiles (scouting_status);

-- Auto-create a profile row whenever a new user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Updated-at trigger (reuse the one from schema.sql)
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- RLS-safe helper for lead/admin checks. Policies on profiles cannot query
-- profiles directly without risking recursive policy evaluation.
create or replace function public.current_user_is_lead_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('lead', 'admin')
  );
$$;

revoke all on function public.current_user_is_lead_or_admin() from public;
grant execute on function public.current_user_is_lead_or_admin() to authenticated;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role
    and not public.current_user_is_lead_or_admin()
  then
    raise exception 'Only leads can change profile roles.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_privilege_escalation on public.profiles;
create trigger profiles_prevent_privilege_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

-- ── RLS for profiles ────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "users can read all profiles" on public.profiles;
create policy "users can read all profiles"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ── Tighten match_submissions to require auth ───────────────
-- Drop the old anon policies
drop policy if exists "event clients can read match submissions" on public.match_submissions;
drop policy if exists "event clients can insert match submissions" on public.match_submissions;
drop policy if exists "event clients can update match submissions" on public.match_submissions;

create policy "authenticated users can read match submissions"
  on public.match_submissions for select
  to authenticated
  using (true);

create policy "authenticated users can insert match submissions"
  on public.match_submissions for insert
  to authenticated
  with check (true);

create policy "authenticated users can update match submissions"
  on public.match_submissions for update
  to authenticated
  using (true)
  with check (true);
