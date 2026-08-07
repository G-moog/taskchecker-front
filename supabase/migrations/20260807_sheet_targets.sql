-- 구글 시트 연동 대상 등록 + 양식/체크리스트별 전송 설정
-- Supabase SQL Editor에서 실행. 재실행해도 안전하도록 작성됨.


-- 1. 시트 등록 테이블
-- 하나의 Apps Script 웹앱이 여러 스프레드시트 파일에 쓸 수 있으므로,
-- 파일을 여기에 등록해 두고 양식/체크리스트가 그 중 하나를 가리킨다.

create table if not exists public.sheet_targets (
  id             uuid primary key default gen_random_uuid(),
  owner_type     text not null check (owner_type in ('personal', 'team')),
  owner_id       uuid not null,   -- personal: user_id / team: team_id
  name           text not null,   -- 앱에서 고를 때 보이는 이름
  spreadsheet_id text not null,   -- 구글 시트 URL의 /d/<여기>/edit
  created_by     uuid not null references auth.users(id),
  created_at     timestamptz not null default now()
);

create index if not exists sheet_targets_owner_idx
  on public.sheet_targets (owner_type, owner_id);


-- 2. 양식 / 체크리스트에 전송 설정 추가
-- sheet_target_id가 null이면 그 양식(체크리스트)은 시트로 보내지 않는다.
-- sheet_tab_name이 null이면 제목을 탭 이름으로 쓴다.

alter table public.measurement_forms
  add column if not exists sheet_target_id uuid references public.sheet_targets(id) on delete set null,
  add column if not exists sheet_tab_name  text;

alter table public.checklists
  add column if not exists sheet_target_id uuid references public.sheet_targets(id) on delete set null,
  add column if not exists sheet_tab_name  text;


-- 3. RLS

create or replace function public.can_access_sheet_target(p_owner_type text, p_owner_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $fn$
  select case
    when p_owner_type = 'personal' then p_owner_id = auth.uid()
    when p_owner_type = 'team' then exists (
      select 1 from team_members where team_id = p_owner_id and user_id = auth.uid()
    )
    else false
  end;
$fn$;

alter table public.sheet_targets enable row level security;

-- 개인 시트는 본인만, 팀 시트는 팀원 누구나 (등록/수정/삭제 모두)
drop policy if exists sheet_targets_select on public.sheet_targets;
create policy sheet_targets_select on public.sheet_targets
  for select using (public.can_access_sheet_target(owner_type, owner_id));

drop policy if exists sheet_targets_insert on public.sheet_targets;
create policy sheet_targets_insert on public.sheet_targets
  for insert with check (
    public.can_access_sheet_target(owner_type, owner_id) and created_by = auth.uid()
  );

drop policy if exists sheet_targets_update on public.sheet_targets;
create policy sheet_targets_update on public.sheet_targets
  for update using (public.can_access_sheet_target(owner_type, owner_id))
  with check (public.can_access_sheet_target(owner_type, owner_id));

drop policy if exists sheet_targets_delete on public.sheet_targets;
create policy sheet_targets_delete on public.sheet_targets
  for delete using (public.can_access_sheet_target(owner_type, owner_id));
