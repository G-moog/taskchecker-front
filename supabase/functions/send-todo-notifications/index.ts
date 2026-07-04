import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FIREBASE_SERVICE_ACCOUNT = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!)

async function getFcmAccessToken(): Promise<string> {
  const sa = FIREBASE_SERVICE_ACCOUNT
  const now = Math.floor(Date.now() / 1000)

  const headerB64 = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payloadB64 = btoa(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const signingInput = `${headerB64}.${payloadB64}`

  const pemKey = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')

  const keyData = Uint8Array.from(atob(pemKey), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(signingInput),
  )

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${signingInput}.${sigB64}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  return data.access_token
}

async function sendFcm(accessToken: string, fcmToken: string, title: string, body: string) {
  const projectId = FIREBASE_SERVICE_ACCOUNT.project_id
  await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        notification: { title, body },
      },
    }),
  })
}

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 알림 시간이 된 미완료 할 일 조회 (최근 10분 이내, 아직 발송 안 된 것)
  const { data: todos } = await supabase
    .from('todos')
    .select('id, title, user_id')
    .lte('notify_at', new Date().toISOString())
    .gte('notify_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .is('notify_sent_at', null)
    .eq('done', false)

  if (!todos || todos.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  const accessToken = await getFcmAccessToken()
  let sent = 0

  for (const todo of todos) {
    const { data: tokenRows } = await supabase
      .from('user_push_tokens')
      .select('fcm_token')
      .eq('user_id', todo.user_id)

    if (!tokenRows || tokenRows.length === 0) continue

    for (const row of tokenRows) {
      await sendFcm(accessToken, row.fcm_token, '할 일 알림', todo.title)
    }

    const now = new Date().toISOString()
    await supabase
      .from('todos')
      .update({ notify_sent_at: now })
      .eq('id', todo.id)

    await supabase.from('todo_notify_log').insert({
      user_id: todo.user_id,
      todo_id: todo.id,
      title: todo.title,
      notified_at: now,
    })

    sent++
  }

  return new Response(JSON.stringify({ sent }), { status: 200 })
})
