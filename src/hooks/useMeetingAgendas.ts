import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MeetingAgenda } from '../types/database'

export interface AgendaWithCount extends MeetingAgenda {
  responseCount: number
}

export function useMeetingAgendas(teamId: string | undefined) {
  const [agendas, setAgendas] = useState<AgendaWithCount[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!teamId) {
      setAgendas([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('meeting_agendas')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })

    if (error || !data) {
      setAgendas([])
      setLoading(false)
      return
    }

    const ids = data.map((a) => a.id)
    const { data: responses } = ids.length
      ? await supabase.from('meeting_responses').select('agenda_id').in('agenda_id', ids)
      : { data: [] }

    const countMap: Record<string, number> = {}
    for (const r of responses ?? []) {
      countMap[r.agenda_id] = (countMap[r.agenda_id] ?? 0) + 1
    }

    setAgendas(data.map((a) => ({ ...a, responseCount: countMap[a.id] ?? 0 })))
    setLoading(false)
  }, [teamId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const createAgenda = async (
    payload: Omit<MeetingAgenda, 'id' | 'created_at' | 'updated_at'>,
  ) => {
    const { data, error } = await supabase
      .from('meeting_agendas')
      .insert(payload)
      .select()
      .single()
    if (!error && data) setAgendas((prev) => [{ ...data, responseCount: 0 }, ...prev])
    return { data, error }
  }

  const deleteAgenda = async (id: string) => {
    const { error } = await supabase.from('meeting_agendas').delete().eq('id', id)
    if (!error) setAgendas((prev) => prev.filter((a) => a.id !== id))
    return { error }
  }

  return { agendas, loading, createAgenda, deleteAgenda, refetch: fetch }
}
