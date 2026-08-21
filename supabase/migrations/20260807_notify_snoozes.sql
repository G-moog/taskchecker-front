-- 체크리스트 알림 미루기 / 오늘 끄기
-- Supabase SQL Editor에서 실행. 재실행해도 안전하도록 작성됨.

-- 미루기는 개인별이다. 팀 체크리스트에서 한 사람이 미뤄도
-- 다른 팀원의 알림은 그대로 나간다.

create table if not exists public.checklist_notify_snoozes (
  id             uuid primary key default gen_random_uuid(),
  checklist_id   uuid not null references public.checklists(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  status_date    date not null,          -- 어느 날짜분의 알림인지
  remind_at      timestamptz,            -- null이면 그날은 더 울리지 않음(끄기)
  notify_sent_at timestamptz,            -- 미뤄둔 알림을 보낸 시각
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (checklist_id, user_id, status_date)
);

-- 발송 대기 중인 미룬 알림 조회용
create index if not exists checklist_notify_snoozes_due_idx
  on public.checklist_notify_snoozes (remind_at)
  where remind_at is not null and notify_sent_at is null;

-- 정시 알림에서 제외할 사람 조회용
create index if not exists checklist_notify_snoozes_lookup_idx
  on public.checklist_notify_snoozes (checklist_id, status_date);

drop trigger if exists checklist_notify_snoozes_set_updated_at on public.checklist_notify_snoozes;
create trigger checklist_notify_snoozes_set_updated_at
  before update on public.checklist_notify_snoozes
  for each row execute function public.set_updated_at();


-- RLS — 본인 것만
alter table public.checklist_notify_snoozes enable row level security;

drop policy if exists checklist_notify_snoozes_select on public.checklist_notify_snoozes;
create policy checklist_notify_snoozes_select on public.checklist_notify_snoozes
  for select using (user_id = auth.uid());

drop policy if exists checklist_notify_snoozes_insert on public.checklist_notify_snoozes;
create policy checklist_notify_snoozes_insert on public.checklist_notify_snoozes
  for insert with check (user_id = auth.uid() and public.can_access_checklist(checklist_id));

drop policy if exists checklist_notify_snoozes_update on public.checklist_notify_snoozes;
create policy checklist_notify_snoozes_update on public.checklist_notify_snoozes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists checklist_notify_snoozes_delete on public.checklist_notify_snoozes;
create policy checklist_notify_snoozes_delete on public.checklist_notify_snoozes
  for delete using (user_id = auth.uid());
