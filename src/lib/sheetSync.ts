import { supabase } from './supabase'

export type SheetSyncRequest =
  | { kind: 'measurement'; entryId: string }
  | { kind: 'checklist'; checklistId: string; statusDate: string }

/**
 * 구글 시트로 전송한다.
 * 성공(또는 연동이 꺼져 있어 건너뜀)이면 null,
 * 실패하면 사용자에게 보여줄 메시지를 반환한다.
 */
export async function syncToSheet(req: SheetSyncRequest): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()

    const body = req.kind === 'measurement'
      ? { kind: 'measurement', entry_id: req.entryId }
      : { kind: 'checklist', checklist_id: req.checklistId, status_date: req.statusDate }

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-measurement-sheet`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(body),
      },
    )

    if (res.ok) return null
    // Edge Function이 아직 배포되지 않은 상태 — 시트 연동 전에는 조용히 넘어간다
    if (res.status === 404) return null

    const payload = await res.json().catch(() => ({}))
    return payload.error ?? `전송에 실패했습니다 (HTTP ${res.status})`
  } catch {
    return '네트워크 오류로 전송하지 못했습니다.'
  }
}

/** 구글 시트 URL에서 스프레드시트 ID를 뽑는다. ID를 직접 붙여넣어도 통과시킨다. */
export function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (fromUrl) return fromUrl[1]

  // URL이 아니라 ID를 그대로 넣은 경우
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed

  return null
}
