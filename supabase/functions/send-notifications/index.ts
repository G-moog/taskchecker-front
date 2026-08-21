import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID')!
const CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL')!
const PRIVATE_KEY = Deno.env.get('FIREBASE_PRIVATE_KEY')!.replace(/\\n/g, '\n')

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payload = btoa(JSON.stringify({
    iss: CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const signingInput = `${header}.${payload}`

  const keyData = PRIVATE_KEY
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')

  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(signingInput),
  )

  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  return data.access_token
}

async function sendFcm(token: string, title: string, body: string, accessToken: string) {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        message: {
          token,
          data: { title, body },
          webpush: { headers: { Urgency: 'high' } },
        },
      }),
    },
  )
  return res.ok
}

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 현재 시각 HH:MM (KST = UTC+9)
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000)
    const hhmm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
    const today = now.toISOString().split('T')[0]
    const dayOfWeek = now.getUTCDay()

    console.log(`Running at KST ${hhmm}, today: ${today}`)

    const { data: checklists } = await supabase
      .from('checklists')
      .select('id, title, owner_type, owner_id, repeat_type, repeat_days, scheduled_date')
      .eq('notify_time', hhmm)

    if (!checklists?.length) {
      return new Response(JSON.stringify({ sent: 0, time: hhmm }), { status: 200 })
    }

    const targets = checklists.filter((cl) => {
      if (cl.repeat_type === 'daily') return true
      if (cl.repeat_type === 'weekly') return (cl.repeat_days ?? []).includes(dayOfWeek)
      if (cl.repeat_type === 'once') return (cl.scheduled_date ?? today) === today
      return false
    })

    if (!targets.length) return new Response(JSON.stringify({ sent: 0, time: hhmm }), { status: 200 })

    // 체크리스트마다 수신자를 따로 구한다.
    // 예전에는 이번 실행에 모인 토큰 전체로 보내서, 같은 시각에 걸린
    // 다른 팀(또는 개인) 체크리스트의 알림까지 서로에게 갔다.
    const recipientsByChecklist = new Map<string, string[]>()

    for (const cl of targets) {
      if (cl.owner_type === 'personal') {
        recipientsByChecklist.set(cl.id, [cl.owner_id])
        continue
      }

      // 알림 대상이 지정돼 있으면 그 사람들만, 비어 있으면 팀원 전체
      const { data: notifyTargets } = await supabase
        .from('checklist_notify_targets').select('user_id').eq('checklist_id', cl.id)

      if (notifyTargets?.length) {
        recipientsByChecklist.set(cl.id, notifyTargets.map((t) => t.user_id))
        continue
      }

      const { data: members } = await supabase
        .from('team_members').select('user_id').eq('team_id', cl.owner_id)
      recipientsByChecklist.set(cl.id, (members ?? []).map((m) => m.user_id))
    }

    const userIds = new Set<string>()
    for (const ids of recipientsByChecklist.values()) {
      for (const userId of ids) userIds.add(userId)
    }

    const { data: tokenRows } = await supabase
      .from('user_push_tokens').select('user_id, fcm_token').in('user_id', [...userIds])

    if (!tokenRows?.length) return new Response(JSON.stringify({ sent: 0, noTokens: true }), { status: 200 })

    const accessToken = await getAccessToken()
    let sent = 0

    for (const cl of targets) {
      const recipientIds = recipientsByChecklist.get(cl.id) ?? []

      const tokens = tokenRows
        .filter((t) => recipientIds.includes(t.user_id))
        .map((t) => t.fcm_token)

      for (const token of tokens) {
        const ok = await sendFcm(token, 'TaskChecker', `📋 ${cl.title} 체크리스트 시간입니다`, accessToken)
        if (ok) sent++
      }
    }

    console.log(`Sent ${sent} notifications`)
    return new Response(JSON.stringify({ sent, time: hhmm }), { status: 200 })
  } catch (e) {
    console.error('Error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
