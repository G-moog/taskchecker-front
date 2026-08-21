-- 팀원 이름 표시(profiles) + 체크리스트 알림 대상 지정
-- Supabase SQL Editor에서 실행. 재실행해도 안전하도록 작성됨.


-- 1. profiles
-- 지금까지 화면에 user_id(UUID)를 잘라서 보여주고 있었다.
-- Google 로그인이라 auth.users.raw_user_meta_data에 이름/사진이 이미 들어온다.

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email        text,
  avatar_url   text,
  updated_at   timestamptz not null default now()
);


-- 2. 가입/정보변경 시 자동 반영

create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (id, display_name, email, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    email        = excluded.email,
    avatar_url   = excluded.avatar_url,
    updated_at   = now();
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_synced on auth.users;
create trigger on_auth_user_synced
  after insert or update on auth.users
  for each row execute function public.sync_profile_from_auth();

-- 이미 가입해 있는 사람들 채워넣기
insert into public.profiles (id, display_name, email, avatar_url)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data->>'full_name', ''),
    nullif(u.raw_user_meta_data->>'name', ''),
    split_part(coalesce(u.email, ''), '@', 1)
  ),
  u.email,
  u.raw_user_meta_data->>'avatar_url'
from auth.users u
on conflict (id) do update set
  display_name = excluded.display_name,
  email        = excluded.email,
  avatar_url   = excluded.avatar_url,
  updated_at   = now();


-- 3. profiles RLS
-- 본인과 "같은 팀에 속한 사람"만 볼 수 있다.
-- 전체 공개로 두면 가입만 하면 모든 사용자의 이름/이메일을 읽을 수 있다.

create or replace function public.shares_team_with(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $fn$
  select exists (
    select 1
    from team_members me
    join team_members other on other.team_id = me.team_id
    where me.user_id = auth.uid() and other.user_id = p_user_id
  );
$fn$;

alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.shares_team_with(id));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());


-- 4. checklist_notify_targets
-- 테이블은 이미 있으나 정책이 확실치 않아 다시 정의한다.
-- 비어 있으면 "전체 팀원"으로 해석한다.

create index if not exists checklist_notify_targets_checklist_idx
  on public.checklist_notify_targets (checklist_id);

alter table public.checklist_notify_targets enable row level security;

drop policy if exists checklist_notify_targets_select on public.checklist_notify_targets;
create policy checklist_notify_targets_select on public.checklist_notify_targets
  for select using (public.can_access_checklist(checklist_id));

drop policy if exists checklist_notify_targets_insert on public.checklist_notify_targets;
create policy checklist_notify_targets_insert on public.checklist_notify_targets
  for insert with check (public.can_access_checklist(checklist_id) and added_by = auth.uid());

drop policy if exists checklist_notify_targets_delete on public.checklist_notify_targets;
create policy checklist_notify_targets_delete on public.checklist_notify_targets
  for delete using (public.can_access_checklist(checklist_id));
