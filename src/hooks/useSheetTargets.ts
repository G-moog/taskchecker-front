import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { OwnerType, SheetTarget } from '../types/database'

export function useSheetTargets(ownerType: OwnerType, ownerId: string | undefined) {
  const [targets, setTargets] = useState<SheetTarget[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!ownerId) {
      setTargets([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('sheet_targets')
      .select('*')
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: true })

    setTargets(!error && data ? data : [])
    setLoading(false)
  }, [ownerType, ownerId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const createTarget = async (name: string, spreadsheetId: string, userId: string) => {
    const { data, error } = await supabase
      .from('sheet_targets')
      .insert({
        owner_type: ownerType,
        owner_id: ownerId!,
        name,
        spreadsheet_id: spreadsheetId,
        created_by: userId,
      })
      .select()
      .single()
    if (!error && data) setTargets((prev) => [...prev, data])
    return { data, error }
  }

  const deleteTarget = async (id: string) => {
    const { error } = await supabase.from('sheet_targets').delete().eq('id', id)
    if (!error) setTargets((prev) => prev.filter((t) => t.id !== id))
    return { error }
  }

  return { targets, loading, createTarget, deleteTarget, refetch: fetch }
}
