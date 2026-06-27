import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Checklist } from '../types/database'

export function useChecklists(ownerId: string | undefined, ownerType: 'personal' | 'team') {
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ownerId) {
      setChecklists([])
      setLoading(false)
      return
    }

    const fetch = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .eq('owner_type', ownerType)
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })

      if (!error && data) setChecklists(data)
      setLoading(false)
    }

    fetch()
  }, [ownerId, ownerType])

  const createChecklist = async (payload: Omit<Checklist, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('checklists')
      .insert(payload)
      .select()
      .single()
    if (!error && data) setChecklists((prev) => [data, ...prev])
    return { data, error }
  }

  const deleteChecklist = async (id: string) => {
    const { error } = await supabase.from('checklists').delete().eq('id', id)
    if (!error) setChecklists((prev) => prev.filter((c) => c.id !== id))
    return { error }
  }

  return { checklists, loading, createChecklist, deleteChecklist }
}
