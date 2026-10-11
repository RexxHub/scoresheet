-- Run this once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
-- Roles: the FIRST account is the admin. Everyone else is a teacher.
-- The admin creates a class (Year 7 to 12), sets it up, assigns a teacher to each subject, then PUBLISHES it.
-- A teacher only sees published classes, and only the subjects assigned to them, and can only enter scores.

-- 1. Profiles with a role and a name
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'teacher',
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists role text not null default 'teacher';
alter table public.profiles add column if not exists created_at timestamptz not null default now();

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
          case when exists (select 1 from public.profiles where role = 'admin') then 'teacher' else 'admin' end)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email, role, created_at)
select u.id, u.email, 'teacher', u.created_at from auth.users u
on conflict (id) do nothing;
update public.profiles p set name = coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name')
from auth.users u where u.id = p.id and p.name is null;
update public.profiles set role = 'admin'
where id = (select id from public.profiles order by created_at asc limit 1)
  and not exists (select 1 from public.profiles where role = 'admin');

-- 2. School details (one row): name, address, session, term, assessment round
create table if not exists public.school (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 3. Classes: setup of each class (students, subjects, score columns, class teacher). Published = visible to teachers.
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  published boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 4. Which teacher handles which subject in which class
create table if not exists public.assignments (
  class_id uuid not null references public.classes(id) on delete cascade,
  subject text not null,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  primary key (class_id, subject)
);

-- 5. Scores, one row per class, student, subject and mark type
create table if not exists public.class_scores (
  class_id uuid not null references public.classes(id) on delete cascade,
  period text not null,
  student text not null,
  subject text not null,
  comp text not null,
  value numeric not null,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (class_id, period, student, subject, comp)
);

-- 6. Move the old single-class setup into a first class (only happens once, if you have no classes yet)
do $$
declare cid uuid;
begin
  if not exists (select 1 from public.classes)
     and exists (select 1 from public.school where data ? 'students') then
    insert into public.classes (name, published, data)
    select coalesce(nullif(data->'school'->>'cls', ''), 'YEAR 8'), false,
           jsonb_build_object('teacher', coalesce(data->'school'->>'teacher', ''),
                              'desig', coalesce(data->'school'->>'desig', ''),
                              'comps', data->'comps', 'subjects', data->'subjects',
                              'students', data->'students', 'rem', coalesce(data->'rem', '{}'::jsonb))
    from public.school where id = 1
    returning id into cid;
    if to_regclass('public.scores') is not null then
      insert into public.class_scores (class_id, period, student, subject, comp, value, updated_by, updated_at)
      select cid, period, student, subject, comp, value, updated_by, updated_at from public.scores
      on conflict do nothing;
    end if;
  end if;
end $$;

-- 7. Security rules
create or replace function public.can_enter(cid uuid, subj text)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.assignments a join public.classes c on c.id = a.class_id
    where a.class_id = cid and a.subject = subj and a.teacher_id = auth.uid() and c.published);
$$;

alter table public.profiles    enable row level security;
alter table public.school      enable row level security;
alter table public.classes     enable row level security;
alter table public.assignments enable row level security;
alter table public.class_scores enable row level security;

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

drop policy if exists "read classes" on public.classes;
drop policy if exists "admin adds classes" on public.classes;
drop policy if exists "admin edits classes" on public.classes;
drop policy if exists "admin deletes classes" on public.classes;
create policy "read classes" on public.classes for select to authenticated
  using (public.is_admin() or (published and exists (
    select 1 from public.assignments a where a.class_id = classes.id and a.teacher_id = auth.uid())));
create policy "admin adds classes" on public.classes for insert to authenticated with check (public.is_admin());
create policy "admin edits classes" on public.classes for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes classes" on public.classes for delete to authenticated using (public.is_admin());

drop policy if exists "read assignments" on public.assignments;
drop policy if exists "admin adds assignments" on public.assignments;
drop policy if exists "admin edits assignments" on public.assignments;
drop policy if exists "admin deletes assignments" on public.assignments;
create policy "read assignments" on public.assignments for select to authenticated
  using (public.is_admin() or teacher_id = auth.uid());
create policy "admin adds assignments" on public.assignments for insert to authenticated with check (public.is_admin());
create policy "admin edits assignments" on public.assignments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes assignments" on public.assignments for delete to authenticated using (public.is_admin());

drop policy if exists "read class scores" on public.class_scores;
drop policy if exists "enter class scores" on public.class_scores;
drop policy if exists "change class scores" on public.class_scores;
drop policy if exists "clear class scores" on public.class_scores;
create policy "read class scores" on public.class_scores for select to authenticated
  using (public.can_enter(class_id, subject));
create policy "enter class scores" on public.class_scores for insert to authenticated
  with check (public.can_enter(class_id, subject));
create policy "change class scores" on public.class_scores for update to authenticated
  using (public.can_enter(class_id, subject)) with check (public.can_enter(class_id, subject));
create policy "clear class scores" on public.class_scores for delete to authenticated
  using (public.can_enter(class_id, subject));
