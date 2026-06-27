import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Checklist, ChecklistItem, ChecklistItemStatus } from '../types/database'

function todayString() {
  return new Date().toISOString().split('T')[0]
}

export function useChecklistDetail(checklistId: string | undefined) {
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [statuses, setStatuses] = useState<ChecklistItemStatus[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!checklistId) { setLoading(false); return }
    setLoading(true)

    const [clRes, itemsRes] = await Promise.all([
      supabase.from('checklists').select('*').eq('id', checklistId).single(),
      supabase.from('checklist_items').select('*').eq('checklist_id', checklistId).order('sort_order'),
    ])

    if (clRes.data) setChecklist(clRes.data)
    if (itemsRes.data) setItems(itemsRes.data)

    const cl = clRes.data
    if (cl) {
      const today = todayString()
      const dateFilter = cl.repeat_type === 'once'
        ? supabase.from('checklist_item_status').select('*').eq('checklist_id', checklistId).eq('is_checked', true)
        : supabase.from('checklist_item_status').select('*').eq('checklist_id', checklistId).eq('status_date', today)

      const statusRes = await dateFilter
      if (statusRes.data) setStatuses(statusRes.data)
    }

    setLoading(false)
  }, [checklistId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Realtime 구독 (팀 체크리스트)
  useEffect(() => {
    if (!checklistId || !checklist || checklist.owner_type !== 'team') return

    const channel = supabase
      .channel(`checklist_status:${checklistId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checklist_item_status', filter: `checklist_id=eq.${checklistId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setStatuses((prev) => [...prev.filter((s) => s.id !== (payload.new as ChecklistItemStatus).id), payload.new as ChecklistItemStatus])
          } else if (payload.eventType === 'UPDATE') {
            setStatuses((prev) => prev.map((s) => s.id === (payload.new as ChecklistItemStatus).id ? payload.new as ChecklistItemStatus : s))
          } else if (payload.eventType === 'DELETE') {
            setStatuses((prev) => prev.filter((s) => s.id !== (payload.old as ChecklistItemStatus).id))
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [checklistId, checklist])

  const toggleItem = async (itemId: string, userId: string) => {
    if (!checklistId || !checklist) return

    const today = todayString()
    const existing = statuses.find((s) => s.item_id === itemId && (checklist.repeat_type === 'once' || s.status_date === today))

    if (checklist.repeat_type === 'once' && existing?.is_checked) return // once: 완료 후 해제 불가

    if (existing) {
      const newChecked = !existing.is_checked
      const { error } = await supabase
        .from('checklist_item_status')
        .update({ is_checked: newChecked, checked_by: userId, checked_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (!error) setStatuses((prev) => prev.map((s) => s.id === existing.id ? { ...s, is_checked: newChecked } : s))
    } else {
      const { data, error } = await supabase
        .from('checklist_item_status')
        .insert({ item_id: itemId, checklist_id: checklistId, status_date: today, is_checked: true, checked_by: userId, checked_at: new Date().toISOString() })
        .select()
        .single()
      if (!error && data) setStatuses((prev) => [...prev, data])
    }
  }

  const updateSortOrder = async (orderedIds: string[]) => {
    const updates = orderedIds.map((id, idx) => supabase.from('checklist_items').update({ sort_order: idx }).eq('id', id))
    await Promise.all(updates)
    setItems((prev) => {
      const map = Object.fromEntries(prev.map((i) => [i.id, i]))
      return orderedIds.map((id, idx) => ({ ...map[id], sort_order: idx }))
    })
  }

  return { checklist, items, statuses, loading, toggleItem, updateSortOrder, refetch: fetchAll }
}
