import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AgendaStance, MeetingAgenda, MeetingResponse } from '../types/database'

export function useAgendaDetail(agendaId: string | undefined) {
  const [agenda, setAgenda] = useState<MeetingAgenda | null>(null)
  const [responses, setResponses] = useState<MeetingResponse[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!agendaId) {
      setAgenda(null)
      setResponses([])
      setLoading(false)
      return
    }

    setLoading(true)
    const [agendaRes, responseRes] = await Promise.all([
      supabase.from('meeting_agendas').select('*').eq('id', agendaId).maybeSingle(),
      supabase
        .from('meeting_responses')
        .select('*')
        .eq('agenda_id', agendaId)
        .order('created_at', { ascending: true }),
    ])

    setAgenda(agendaRes.data ?? null)
    setResponses(responseRes.data ?? [])
    setLoading(false)
  }, [agendaId])

  useEffect(() => {
    fetch()
  }, [fetch])

  /** 1인 1의견. 이미 낸 의견이 있으면 덮어쓴다. */
  const submitResponse = async (
    userId: string,
    stance: AgendaStance | null,
    comment: string | null,
  ) => {
    if (!agendaId) return { data: null, error: null }

    const { data, error } = await supabase
      .from('meeting_responses')
      .upsert(
        { agenda_id: agendaId, user_id: userId, stance, comment },
        { onConflict: 'agenda_id,user_id' },
      )
      .select()
      .single()

    if (!error && data) {
      setResponses((prev) => {
        const idx = prev.findIndex((r) => r.user_id === userId)
        if (idx === -1) return [...prev, data]
        const next = [...prev]
        next[idx] = data
        return next
      })
    }
    return { data, error }
  }

  const deleteResponse = async (userId: string) => {
    if (!agendaId) return { error: null }
    const { error } = await supabase
      .from('meeting_responses')
      .delete()
      .eq('agenda_id', agendaId)
      .eq('user_id', userId)
    if (!error) setResponses((prev) => prev.filter((r) => r.user_id !== userId))
    return { error }
  }

  return { agenda, responses, loading, submitResponse, deleteResponse, refetch: fetch }
}
