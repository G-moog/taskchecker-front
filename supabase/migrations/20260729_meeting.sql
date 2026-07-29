-- 회의 기능: 안건 제안 + 의견 제시
-- Supabase SQL Editor에서 실행. 재실행해도 안전하도록 작성됨.

-- ─────────────────────────────────────────────
-- 1. 테이블
-- ─────────────────────────────────────────────

create table if not exists public.meeting_agendas (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  title         text not null,
  body          text,
  -- 'vote'       : 찬성/반대/기권 + 이유(선택)
  -- 'discussion' : 찬반 없이 서술형 의견만
  response_type text not null check (response_type in ('vote', 'discussion')),
  -- 'app'     : 앱에서 의견을 종합해 마무리
  -- 'offline' : 대면회의에서 최종 결정
  decision_mode text not null check (decision_mode in ('app', 'offline')),
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists meeting_agendas_team_idx
  on public.meeting_agendas (team_id, created_at desc);

create table if not exists public.meeting_responses (
  id         uuid primary key default gen_random_uuid(),
  agenda_id  uuid not null references public.meeting_agendas(id) on delete cascade,
  user_id    uuid not null references auth.users(id),
  -- discussion 안건이거나 이유만 남길 때는 null
  stance     text check (stance in ('for', 'against', 'abstain')),
  -- vote 안건에서 이유를 안 적으면 null
  comment    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agenda_id, user_id)   -- 1인 1의견, 수정은 가능
);

create index if not exists meeting_responses_agenda_idx
  on public.meeting_responses (agenda_id);

-- ─────────────────────────────────────────────
-- 2. updated_at 자동 갱신
-- ─────────────────────────────────────────────

-- 기존 프로젝트에 set_updated_at()이 이미 있으면 건드리지 않는다.
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    create function public.set_updated_at() returns trigger
    language plpgsql as $f$
    begin
      new.updated_at = now();
      return new;
    end;
    $f$;
  end if;
end $$;

drop trigger if exists meeting_agendas_set_updated_at on public.meeting_agendas;
create trigger meeting_agendas_set_updated_at
  before update on public.meeting_agendas
  for each row execute function public.set_updated_at();

drop trigger if exists meeting_responses_set_updated_at on public.meeting_responses;
create trigger meeting_responses_set_updated_at
  before update on public.meeting_responses
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- 3. RLS 헬퍼
-- ─────────────────────────────────────────────
-- team_members를 정책 안에서 직접 조회하면 재귀가 걸리므로 SECURITY DEFINER로 우회한다.
-- (기존 is_team_member / can_access_checklist와 같은 방식. 시그니처 충돌을 피하려고 이름을 달리 둠)

create or replace function public.is_member_of_team(p_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from team_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;

create or replace function public.can_access_agenda(p_agenda_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from meeting_agendas a
    join team_members m on m.team_id = a.team_id
    where a.id = p_agenda_id and m.user_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────
-- 4. RLS 정책
-- ─────────────────────────────────────────────

alter table public.meeting_agendas   enable row level security;
alter table public.meeting_responses enable row level security;

-- 안건: 팀원이면 누구나 읽고 올릴 수 있고, 수정/삭제는 작성자만
drop policy if exists meeting_agendas_select on public.meeting_agendas;
create policy meeting_agendas_select on public.meeting_agendas
  for select using (public.is_member_of_team(team_id));

drop policy if exists meeting_agendas_insert on public.meeting_agendas;
create policy meeting_agendas_insert on public.meeting_agendas
  for insert with check (public.is_member_of_team(team_id) and created_by = auth.uid());

drop policy if exists meeting_agendas_update on public.meeting_agendas;
create policy meeting_agendas_update on public.meeting_agendas
  for update using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists meeting_agendas_delete on public.meeting_agendas;
create policy meeting_agendas_delete on public.meeting_agendas
  for delete using (created_by = auth.uid());

-- 의견: 같은 팀 안건의 의견은 모두 읽을 수 있고, 쓰기는 본인 것만
drop policy if exists meeting_responses_select on public.meeting_responses;
create policy meeting_responses_select on public.meeting_responses
  for select using (public.can_access_agenda(agenda_id));

drop policy if exists meeting_responses_insert on public.meeting_responses;
create policy meeting_responses_insert on public.meeting_responses
  for insert with check (public.can_access_agenda(agenda_id) and user_id = auth.uid());

drop policy if exists meeting_responses_update on public.meeting_responses;
create policy meeting_responses_update on public.meeting_responses
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists meeting_responses_delete on public.meeting_responses;
create policy meeting_responses_delete on public.meeting_responses
  for delete using (user_id = auth.uid());
