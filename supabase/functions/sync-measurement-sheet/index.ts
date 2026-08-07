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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // ── 입력 파싱 ─────────────────────────────────────────────
  let entryId: string
  try {
    const body = await req.json()
    entryId = (body.entry_id ?? '').toString().trim()
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 400)
  }
  if (!entryId) return json({ error: 'entry_id가 필요합니다.' }, 400)

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
  // (시트를 만들기 전에도 측정 저장은 정상 동작해야 하므로 에러로 취급하지 않는다)
  const webhookUrl    = Deno.env.get('SHEETS_WEBHOOK_URL')
  const webhookSecret = Deno.env.get('SHEETS_WEBHOOK_SECRET')
  if (!webhookUrl || !webhookSecret) return json({ skipped: true, reason: 'not_configured' })

  // service role 클라이언트 — RLS 우회 (조회 전용 목적)
  const admin = createClient(supabaseUrl, serviceRoleKey)

  // ── 측정 기록 조회 ────────────────────────────────────────
  const { data: entry, error: entryError } = await admin
    .from('measurement_entries')
    .select('id, form_id, submitted_at, submitted_by, measurement_forms(title)')
    .eq('id', entryId)
    .maybeSingle()

  if (entryError) return json({ error: '서버 오류가 발생했습니다.' }, 500)
  if (!entry)     return json({ error: '측정 기록을 찾을 수 없습니다.' }, 404)

  // 본인이 저장한 기록만 전송할 수 있다
  if (entry.submitted_by !== user.id) return json({ error: '권한이 없습니다.' }, 403)

  const [{ data: fields }, { data: values }] = await Promise.all([
    admin
      .from('measurement_fields')
      .select('id, label, unit, sort_order')
      .eq('form_id', entry.form_id)
      .order('sort_order'),
    admin
      .from('measurement_values')
      .select('field_id, value')
      .eq('entry_id', entry.id),
  ])

  const valueMap = new Map((values ?? []).map((v) => [v.field_id, v.value]))

  const payload = {
    secret: webhookSecret,
    // Apps Script가 이 이름으로 탭을 찾거나 만든다
    form: (entry.measurement_forms as { title: string } | null)?.title ?? '측정',
    submittedAt: entry.submitted_at,
    submittedBy: user.email ?? user.id,
    values: (fields ?? []).map((f) => ({
      label: f.label,
      unit: f.unit,
      value: valueMap.get(f.id) ?? '',
    })),
  }

  // ── Apps Script 웹앱으로 전송 ─────────────────────────────
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow', // Apps Script /exec은 302로 리다이렉트한다
    })

    const text = await res.text()
    if (!res.ok) return json({ error: `시트 전송 실패 (HTTP ${res.status})` }, 502)
    if (text.includes('unauthorized')) return json({ error: '시트 시크릿이 일치하지 않습니다.' }, 502)

    return json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: `시트 전송 실패: ${message}` }, 502)
  }
})
