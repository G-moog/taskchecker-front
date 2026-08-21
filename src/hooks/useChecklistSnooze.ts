import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface ChecklistSnooze {
  id: string
  remind_at: string | null
  notify_sent_at: string | null
}

/**
 * 오늘분 체크리스트 알림을 미루거나 끈 기록.
 * remind_at이 있으면 그 시각에 다시 알림, null이면 오늘은 더 울리지 않는다.
 * 개인별 기록이라 팀원 알림에는 영향이 없다.
 */
export function useChecklistSnooze(
  checklistId: string | undefined,
  userId: string | undefined,
  statusDate: string,
) {
  const [snooze, setSnooze] = useState<ChecklistSnooze | null>(null)

  const fetch = useCallback(async () => {
    if (!checklistId || !userId) { setSnooze(null); return }
    const { data } = await supabase
      .from('checklist_notify_snoozes')
      .select('id, remind_at, notify_sent_at')
      .eq('checklist_id', checklistId)
      .eq('user_id', userId)
      .eq('status_date', statusDate)
      .maybeSingle()
    setSnooze(data ?? null)
  }, [checklistId, userId, statusDate])

  useEffect(() => { fetch() }, [fetch])

  const save = async (remindAt: string | null) => {
    if (!checklistId || !userId) return { error: null }
    const { data, error } = await supabase
      .from('checklist_notify_snoozes')
      .upsert(
        {
          checklist_id: checklistId,
          user_id: userId,
          status_date: statusDate,
          remind_at: remindAt,
          notify_sent_at: null,
        },
        { onConflict: 'checklist_id,user_id,status_date' },
      )
      .select('id, remind_at, notify_sent_at')
      .single()
    if (!error && data) setSnooze(data)
    return { error }
  }

  /** N분 뒤에 다시 알림 */
  const snoozeFor = (minutes: number) =>
    save(new Date(Date.now() + minutes * 60 * 1000).toISOString())

  /** 오늘은 더 울리지 않음 */
  const muteToday = () => save(null)

  /** 미루기 해제 — 정시 알림을 다시 받는다 */
  const clearSnooze = async () => {
    if (!snooze) return { error: null }
    const { error } = await supabase
      .from('checklist_notify_snoozes').delete().eq('id', snooze.id)
    if (!error) setSnooze(null)
    return { error }
  }

  return { snooze, snoozeFor, muteToday, clearSnooze, refetch: fetch }
}
