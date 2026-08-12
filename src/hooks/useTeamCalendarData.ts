import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { todayString } from '../lib/date'
import type { Checklist } from '../types/database'

function isAssigned(cl: Checklist, dateStr: string, dayOfWeek: number): boolean {
  const created = cl.created_at.split('T')[0]
  if (dateStr < created) return false
  if (cl.repeat_type === 'daily') return true
  if (cl.repeat_type === 'weekly') return (cl.repeat_days ?? []).includes(dayOfWeek)
  if (cl.repeat_type === 'once') return dateStr === (cl.scheduled_date ?? created)
  return false
}

function pad(n: number) { return String(n).padStart(2, '0') }

export interface TeamDayItem {
  itemId: string
  label: string
  isChecked: boolean
  checkedBy: string | null  // user_id
}

export interface TeamDayChecklist {
  checklistId: string
  title: string
  items: TeamDayItem[]
}

export interface TeamDayData {
  rate: number          // 0~100 완료율
  checklists: TeamDayChecklist[]
}

export type TeamCalendarData = Record<string, TeamDayData>  // key: YYYY-MM-DD

export function useTeamCalendarData(
  teamId: string | undefined,
  year: number,
  month: number,
) {
  const [data, setData] = useState<TeamCalendarData>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) { setLoading(false); return }

    const run = async () => {
      setLoading(true)

      const startDate = `${year}-${pad(month)}-01`
      const totalDays = new Date(year, month, 0).getDate()
      const endDate = `${year}-${pad(month)}-${pad(totalDays)}`

      // 팀 체크리스트
      const { data: checklists } = await supabase
        .from('checklists')
        .select('*')
        .eq('owner_type', 'team')
        .eq('owner_id', teamId)

      if (!checklists?.length) { setData({}); setLoading(false); return }

      const clIds = checklists.map((c) => c.id)

      // 체크리스트 항목
      const { data: itemRows } = await supabase
        .from('checklist_items')
        .select('id, checklist_id, label, sort_order')
        .in('checklist_id', clIds)
        .order('sort_order')

      // 해당 월 체크 상태
      const { data: statuses } = await supabase
        .from('checklist_item_status')
        .select('item_id, checklist_id, status_date, is_checked, checked_by')
        .in('checklist_id', clIds)
        .gte('status_date', startDate)
        .lte('status_date', endDate)

      const today = todayString()
      const result: TeamCalendarData = {}

      for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${year}-${pad(month)}-${pad(day)}`
        if (dateStr > today) continue

        const dayOfWeek = new Date(dateStr).getDay()
        const assigned = (checklists ?? []).filter((cl) => isAssigned(cl, dateStr, dayOfWeek))
        if (!assigned.length) continue

        const dayStatuses = (statuses ?? []).filter((s) => s.status_date === dateStr)
        let totalItems = 0
        let checkedItems = 0
        const clData: TeamDayChecklist[] = []

        for (const cl of assigned) {
          const items = (itemRows ?? []).filter((i) => i.checklist_id === cl.id)
          const dayItems: TeamDayItem[] = items.map((item) => {
            const st = dayStatuses.find((s) => s.item_id === item.id && s.checklist_id === cl.id)
            return {
              itemId: item.id,
              label: item.label,
              isChecked: st?.is_checked ?? false,
              checkedBy: st?.checked_by ?? null,
            }
          })
          totalItems += items.length
          checkedItems += dayItems.filter((i) => i.isChecked).length
          clData.push({ checklistId: cl.id, title: cl.title, items: dayItems })
        }

        const rate = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0
        result[dateStr] = { rate, checklists: clData }
      }

      setData(result)
      setLoading(false)
    }

    run()
  }, [teamId, year, month])

  return { data, loading }
}
