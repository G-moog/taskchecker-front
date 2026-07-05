import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { MeasurementForm } from '../types/database'

export function useMeasurementForms(ownerType: 'personal' | 'team', ownerId: string | undefined) {
  const [forms, setForms] = useState<MeasurementForm[]>([])
  const [loading, setLoading] = useState(true)

  const fetchForms = useCallback(async () => {
    if (!ownerId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('measurement_forms')
      .select('*')
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
    setForms(data ?? [])
    setLoading(false)
  }, [ownerType, ownerId])

  useEffect(() => { fetchForms() }, [fetchForms])

  const deleteForm = async (id: string) => {
    await supabase.from('measurement_forms').delete().eq('id', id)
    setForms((prev) => prev.filter((f) => f.id !== id))
  }

  return { forms, loading, refetch: fetchForms, deleteForm }
}
