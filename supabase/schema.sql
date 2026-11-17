-- Gavel database. Paste all of this into Supabase → SQL Editor → New query → Run.

-- Profiles: one row per person, filled in during onboarding
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        text,
  experience  text,
  conference  text,
  onboarded   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "Read own profile"   on public.profiles;
drop policy if exists "Insert own profile" on public.profiles;
drop policy if exists "Update own profile" on public.profiles;
create policy "Read own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Sessions: each committee session as one JSON document, private to its owner
create table if not exists public.sessions (
  user_id     uuid not null references auth.users (id) on delete cascade,
  id          text not null,
  data        jsonb not null default '{}'::jsonb,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.sessions enable row level security;
drop policy if exists "Read own sessions"   on public.sessions;
drop policy if exists "Insert own sessions" on public.sessions;
drop policy if exists "Update own sessions" on public.sessions;
drop policy if exists "Delete own sessions" on public.sessions;
create policy "Read own sessions"   on public.sessions for select using (auth.uid() = user_id);
create policy "Insert own sessions" on public.sessions for insert with check (auth.uid() = user_id);
create policy "Update own sessions" on public.sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own sessions" on public.sessions for delete using (auth.uid() = user_id);

-- Live updates between your devices
do $$ begin
  alter publication supabase_realtime add table public.sessions;
exception when duplicate_object then null; end $$;
