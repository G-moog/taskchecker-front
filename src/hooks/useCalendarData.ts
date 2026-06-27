import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Checklist } from '../types/database'

export type CompletionStatus = 'all' | 'partial' | 'none' | 'future'

export interface DayEntry {
  checklistId: string
  title: string
  status: CompletionStatus
  repeatType: Checklist['repeat_type']
}

export type CalendarData = Record<string, DayEntry[]> // key: YYYY-MM-DD

function isAssigned(checklist: Checklist, dateStr: string, dayOfWeek: number): boolean {
  const created = checklist.created_at.split('T')[0]
  if (dateStr < created) return false
  if (checklist.repeat_type === 'daily') return true
  if (checklist.repeat_type === 'weekly') return (checklist.repeat_days ?? []).includes(dayOfWeek)
  if (checklist.repeat_type === 'once') {
    const target = checklist.scheduled_date ?? created
    return dateStr === target
  }
  return false
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function useCalendarData(userId: string | undefined, year: number, month: number) {
  const [data, setData] = useState<CalendarData>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }

    const run = async () => {
      setLoading(true)

      // 팀 ID 조회
      const { data: memberRows } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId)
      const teamIds = memberRows?.map((r) => r.team_id) ?? []

      // 체크리스트 조회
      let clQuery = supabase
        .from('checklists')
        .select('*')
        .or(`and(owner_type.eq.personal,owner_id.eq.${userId})${teamIds.length ? `,and(owner_type.eq.team,owner_id.in.(${teamIds.join(',')}))` : ''}`)

      const { data: checklists } = await clQuery

      if (!checklists?.length) { setData({}); setLoading(false); return }

      const clIds = checklists.map((c) => c.id)

      // 항목 수 조회
      const { data: itemRows } = await supabase
        .from('checklist_items')
        .select('id, checklist_id')
        .in('checklist_id', clIds)

      const itemsByChecklist: Record<string, string[]> = {}
      itemRows?.forEach((item) => {
        if (!itemsByChecklist[item.checklist_id]) itemsByChecklist[item.checklist_id] = []
        itemsByChecklist[item.checklist_id].push(item.id)
      })

      // 해당 월 상태 조회
      const startDate = `${year}-${pad(month)}-01`
      const endDate = `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`

      const { data: statuses } = await supabase
        .from('checklist_item_status')
        .select('item_id, checklist_id, status_date, is_checked')
        .in('checklist_id', clIds)
        .gte('status_date', startDate)
        .lte('status_date', endDate)

      // 날짜별 데이터 구성
      const today = new Date().toISOString().split('T')[0]
      const total = daysInMonth(year, month)
      const result: CalendarData = {}

      for (let day = 1; day <= total; day++) {
        const dateStr = `${year}-${pad(month)}-${pad(day)}`
        const dayOfWeek = new Date(dateStr).getDay()
        const entries: DayEntry[] = []

        for (const cl of checklists) {
          if (!isAssigned(cl, dateStr, dayOfWeek)) continue

          const allItemIds = itemsByChecklist[cl.id] ?? []
          const dayStatuses = (statuses ?? []).filter(
            (s) => s.checklist_id === cl.id && s.status_date === dateStr,
          )
          const checkedCount = dayStatuses.filter((s) => s.is_checked).length

          let status: CompletionStatus
          if (dateStr > today) {
            status = 'future'
          } else if (checkedCount === 0) {
            status = 'none'
          } else if (checkedCount >= allItemIds.length) {
            status = 'all'
          } else {
            status = 'partial'
          }

          entries.push({ checklistId: cl.id, title: cl.title, status, repeatType: cl.repeat_type })
        }

        if (entries.length > 0) result[dateStr] = entries
      }

      setData(result)
      setLoading(false)
    }

    run()
  }, [userId, year, month])

  return { data, loading }
}
