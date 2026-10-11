-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- Safe to run again: it will not fail if the table or policies already exist.

create table if not exists public.ca_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.ca_state enable row level security;

drop policy if exists "teacher reads own data" on public.ca_state;
drop policy if exists "teacher inserts own data" on public.ca_state;
drop policy if exists "teacher updates own data" on public.ca_state;

create policy "teacher reads own data" on public.ca_state
  for select using (auth.uid() = user_id);
create policy "teacher inserts own data" on public.ca_state
  for insert with check (auth.uid() = user_id);
create policy "teacher updates own data" on public.ca_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
