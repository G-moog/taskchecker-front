import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

interface SheetValue {
  label: string
  unit: string | null
  value: string
}

interface SheetPayload {
  spreadsheetId: string
  tab: string
  mode: 'append' | 'upsert'
  rowKey?: string
  submittedAt: string
  submittedBy: string
  /** 체크리스트 전용 — 그날 항목들 중 가장 늦게 저장된 시각 */
  lastSavedAt?: string
  values: SheetValue[]
}

/** 빌더 결과 — 셋 중 하나 */
type BuildResult =
  | { kind: 'payload'; payload: SheetPayload }
  | { kind: 'skipped'; reason: string }
  | { kind: 'error'; message: string; status: number }

// deno-lint-ignore no-explicit-any
type Admin = any

/** 등록된 시트 파일의 spreadsheet_id를 찾는다 */
async function resolveSpreadsheetId(admin: Admin, targetId: string): Promise<string | null> {
  const { data } = await admin
    .from('sheet_targets')
    .select('spreadsheet_id')
    .eq('id', targetId)
    .maybeSingle()
  return data?.spreadsheet_id ?? null
}

/** 측정 양식 제출 한 건 → 새 줄로 추가 */
async function buildMeasurementPayload(
  admin: Admin,
  userId: string,
  userLabel: string,
  entryId: string,
): Promise<BuildResult> {
  const { data: entry, error } = await admin
    .from('measurement_entries')
    .select('id, form_id, submitted_at, submitted_by, measurement_forms(title, sheet_target_id, sheet_tab_name)')
    .eq('id', entryId)
    .maybeSingle()

  if (error) return { kind: 'error', message: '서버 오류가 발생했습니다.', status: 500 }
  if (!entry) return { kind: 'error', message: '측정 기록을 찾을 수 없습니다.', status: 404 }
  // 본인이 저장한 기록만 전송할 수 있다
  if (entry.submitted_by !== userId) return { kind: 'error', message: '권한이 없습니다.', status: 403 }

  const form = entry.measurement_forms as
    { title: string; sheet_target_id: string | null; sheet_tab_name: string | null } | null

  if (!form?.sheet_target_id) return { kind: 'skipped', reason: 'no_sheet_target' }

  const spreadsheetId = await resolveSpreadsheetId(admin, form.sheet_target_id)
  if (!spreadsheetId) return { kind: 'skipped', reason: 'sheet_target_missing' }

  const [{ data: fields }, { data: values }] = await Promise.all([
    admin.from('measurement_fields')
      .select('id, label, unit, sort_order')
      .eq('form_id', entry.form_id)
      .order('sort_order'),
    admin.from('measurement_values')
      .select('field_id, value')
      .eq('entry_id', entry.id),
  ])

  const valueMap = new Map(
    (values ?? []).map((v: { field_id: string; value: string }) => [v.field_id, v.value]),
  )

  return {
    kind: 'payload',
    payload: {
      spreadsheetId,
      tab: form.sheet_tab_name || form.title,
      mode: 'append',
      submittedAt: entry.submitted_at,
      submittedBy: userLabel,
      values: (fields ?? []).map((f: { id: string; label: string; unit: string | null }) => ({
        label: f.label,
        unit: f.unit,
        value: (valueMap.get(f.id) as string) ?? '',
      })),
    },
  }
}

/** 체크리스트 하루치 → 날짜별 한 줄, 다시 보내면 그 줄을 갱신 */
async function buildChecklistPayload(
  admin: Admin,
  userId: string,
  userLabel: string,
  checklistId: string,
  statusDate: string,
): Promise<BuildResult> {
  const { data: cl, error } = await admin
    .from('checklists')
    .select('id, title, owner_type, owner_id, sheet_target_id, sheet_tab_name')
    .eq('id', checklistId)
    .maybeSingle()

  if (error) return { kind: 'error', message: '서버 오류가 발생했습니다.', status: 500 }
  if (!cl) return { kind: 'error', message: '체크리스트를 찾을 수 없습니다.', status: 404 }

  // 접근 권한 — 개인은 본인, 팀은 팀원
  let allowed = false
  if (cl.owner_type === 'personal') {
    allowed = cl.owner_id === userId
  } else {
    const { data: member } = await admin
      .from('team_members')
      .select('id')
      .eq('team_id', cl.owner_id)
      .eq('user_id', userId)
      .maybeSingle()
    allowed = !!member
  }
  if (!allowed) return { kind: 'error', message: '권한이 없습니다.', status: 403 }

  if (!cl.sheet_target_id) return { kind: 'skipped', reason: 'no_sheet_target' }

  const spreadsheetId = await resolveSpreadsheetId(admin, cl.sheet_target_id)
  if (!spreadsheetId) return { kind: 'skipped', reason: 'sheet_target_missing' }

  const [{ data: items }, { data: statuses }] = await Promise.all([
    admin.from('checklist_items')
      .select('id, label, unit, has_note, sort_order')
      .eq('checklist_id', cl.id)
      .eq('item_type', 'measure')
      .order('sort_order'),
    admin.from('checklist_item_status')
      .select('item_id, value, note, checked_at')
      .eq('checklist_id', cl.id)
      .eq('status_date', statusDate),
  ])

  if (!items || items.length === 0) return { kind: 'skipped', reason: 'no_measure_items' }

  type StatusRow = { item_id: string; value: string | null; note: string | null; checked_at: string | null }
  const statusRows = (statuses ?? []) as StatusRow[]
  const statusMap = new Map(statusRows.map((s) => [s.item_id, s]))

  // ISO 문자열은 사전순 정렬이 곧 시간순이다
  const savedTimes = statusRows.map((s) => s.checked_at).filter((t): t is string => !!t).sort()
  const lastSavedAt = savedTimes.length > 0 ? savedTimes[savedTimes.length - 1] : undefined

  const values: SheetValue[] = []
  for (const item of items as { id: string; label: string; unit: string | null; has_note: boolean }[]) {
    const st = statusMap.get(item.id)
    values.push({ label: item.label, unit: item.unit, value: st?.value ?? '' })
    if (item.has_note) {
      values.push({ label: `${item.label} 비고`, unit: null, value: st?.note ?? '' })
    }
  }

  return {
    kind: 'payload',
    payload: {
      spreadsheetId,
      tab: cl.sheet_tab_name || cl.title,
      mode: 'upsert',
      rowKey: `${cl.id}|${statusDate}`,
      submittedAt: statusDate,
      submittedBy: userLabel,
      lastSavedAt,
      values,
    },
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // ── 입력 파싱 ─────────────────────────────────────────────
  let kind: string, entryId: string, checklistId: string, statusDate: string
  try {
    const body = await req.json()
    kind        = (body.kind ?? 'measurement').toString()
    entryId     = (body.entry_id ?? '').toString().trim()
    checklistId = (body.checklist_id ?? '').toString().trim()
    statusDate  = (body.status_date ?? '').toString().trim()
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 400)
  }

  if (kind !== 'measurement' && kind !== 'checklist') {
    return json({ error: 'kind는 measurement 또는 checklist여야 합니다.' }, 400)
  }
  if (kind === 'measurement' && !entryId) {
    return json({ error: 'entry_id가 필요합니다.' }, 400)
  }
  if (kind === 'checklist') {
    if (!checklistId) return json({ error: 'checklist_id가 필요합니다.' }, 400)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(statusDate)) {
      return json({ error: 'status_date는 YYYY-MM-DD 형식이어야 합니다.' }, 400)
    }
  }

  // ── 호출자 인증 ───────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: '인증이 필요합니다.' }, 401)

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
  const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return json({ error: '유효하지 않은 인증 토큰입니다.' }, 401)

  // ── 시트 연동이 아직 설정되지 않았으면 조용히 건너뛴다 ────
  const webhookUrl    = Deno.env.get('SHEETS_WEBHOOK_URL')
  const webhookSecret = Deno.env.get('SHEETS_WEBHOOK_SECRET')
  if (!webhookUrl || !webhookSecret) return json({ skipped: true, reason: 'not_configured' })

  // service role 클라이언트 — RLS 우회 (조회 전용 목적)
  const admin = createClient(supabaseUrl, serviceRoleKey)
  const userLabel = user.email ?? user.id

  const built = kind === 'measurement'
    ? await buildMeasurementPayload(admin, user.id, userLabel, entryId)
    : await buildChecklistPayload(admin, user.id, userLabel, checklistId, statusDate)

  if (built.kind === 'error')   return json({ error: built.message }, built.status)
  if (built.kind === 'skipped') return json({ skipped: true, reason: built.reason })

  // ── Apps Script 웹앱으로 전송 ─────────────────────────────
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: webhookSecret, ...built.payload }),
      redirect: 'follow', // Apps Script /exec은 302로 리다이렉트한다
    })

    const text = await res.text()
    if (!res.ok) return json({ error: `시트 전송 실패 (HTTP ${res.status})` }, 502)

    // Apps Script는 실패해도 200으로 응답하므로 본문을 확인한다
    let parsed: { error?: string } = {}
    try { parsed = JSON.parse(text) } catch { /* 본문이 JSON이 아니면 아래에서 처리 */ }

    if (parsed.error === 'unauthorized') {
      return json({ error: '시트 시크릿이 일치하지 않습니다.' }, 502)
    }
    if (parsed.error) return json({ error: parsed.error }, 502)

    return json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: `시트 전송 실패: ${message}` }, 502)
  }
})
