-- Run this once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
-- Roles: the FIRST person to create an account is the admin (sets up the class, prints reports).
-- Everyone who signs up after that is a teacher, who can only enter scores.

-- 1. Profiles with a role
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'teacher',
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text not null default 'teacher';
alter table public.profiles add column if not exists created_at timestamptz not null default now();

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email,
          case when exists (select 1 from public.profiles where role = 'admin') then 'teacher' else 'admin' end)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- accounts that already exist: add profiles, and make the oldest one the admin if there is none
insert into public.profiles (id, email, role, created_at)
select u.id, u.email, 'teacher', u.created_at from auth.users u
on conflict (id) do nothing;
update public.profiles set role = 'admin'
where id = (select id from public.profiles order by created_at asc limit 1)
  and not exists (select 1 from public.profiles where role = 'admin');

-- 2. School setup (one row): school details, subjects, students, remarks. Only the admin can change it.
create table if not exists public.school (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 3. Scores: one row per student, subject and mark type. Teachers and the admin can enter these.
create table if not exists public.scores (
  period text not null,          -- session | term | CA, taken from the school setup
  student text not null,
  subject text not null,
  comp text not null,
  value numeric not null,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (period, student, subject, comp)
);

-- 4. Security rules
alter table public.profiles enable row level security;
alter table public.school   enable row level security;
alter table public.scores   enable row level security;

drop policy if exists "own profile" on public.profiles;
drop policy if exists "read profiles" on public.profiles;
drop policy if exists "admin edits profiles" on public.profiles;
create policy "read profiles" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "admin edits profiles" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "all read school" on public.school;
drop policy if exists "admin writes school" on public.school;
drop policy if exists "admin updates school" on public.school;
create policy "all read school" on public.school for select to authenticated using (true);
create policy "admin writes school" on public.school for insert to authenticated with check (public.is_admin());
create policy "admin updates school" on public.school for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read scores" on public.scores;
drop policy if exists "enter scores" on public.scores;
drop policy if exists "change scores" on public.scores;
drop policy if exists "clear scores" on public.scores;
create policy "read scores" on public.scores for select to authenticated using (true);
create policy "enter scores" on public.scores for insert to authenticated with check (true);
create policy "change scores" on public.scores for update to authenticated using (true) with check (true);
create policy "clear scores" on public.scores for delete to authenticated using (true);
