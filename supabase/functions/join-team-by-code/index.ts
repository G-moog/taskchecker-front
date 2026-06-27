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
  let code: string, preview: boolean
  try {
    const body = await req.json()
    code    = (body.code ?? '').toString().trim().toUpperCase()
    preview = body.preview === true
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 400)
  }

  if (!code) return json({ error: '초대 코드를 입력해주세요.' }, 400)

  // ── 호출자 인증 ───────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: '인증이 필요합니다.' }, 401)

  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
  const anonKey         = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return json({ error: '유효하지 않은 인증 토큰입니다.' }, 401)

  // service role 클라이언트 — RLS 우회 (INSERT 전용 목적)
  const admin = createClient(supabaseUrl, serviceRoleKey)

  // ── 코드 조회 ─────────────────────────────────────────────
  const { data: invite, error: inviteError } = await admin
    .from('team_invite_codes')
    .select('team_id, expires_at, revoked_at, teams(name)')
    .eq('code', code)
    .maybeSingle()

  if (inviteError) return json({ error: '서버 오류가 발생했습니다.' }, 500)
  if (!invite)    return json({ error: '존재하지 않는 초대 코드입니다.' }, 404)

  // ── 유효성 검사 ───────────────────────────────────────────
  if (invite.revoked_at)                          return json({ error: '폐기된 초대 코드입니다.' }, 400)
  if (new Date(invite.expires_at) < new Date())   return json({ error: '만료된 초대 코드입니다.' }, 400)

  const teamId   = invite.team_id
  const teamName = (invite.teams as { name: string } | null)?.name ?? ''

  // ── preview 모드 — 팀 정보만 반환, 가입하지 않음 ──────────
  if (preview) {
    return json({ team_id: teamId, team_name: teamName, preview: true })
  }

  // ── 중복 가입 방지 ────────────────────────────────────────
  const { data: existing } = await admin
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return json({ error: '이미 가입된 팀입니다.' }, 409)

  // ── 팀 합류 ───────────────────────────────────────────────
  const { error: insertError } = await admin
    .from('team_members')
    .insert({ team_id: teamId, user_id: user.id, role: 'member' })

  if (insertError) return json({ error: '팀 합류에 실패했습니다.' }, 500)

  return json({ team_id: teamId, team_name: teamName })
})
