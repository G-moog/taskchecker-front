import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCalendarData, type DayEntry, type CompletionStatus } from '../hooks/useCalendarData'
import { supabase } from '../lib/supabase'
import { Sidebar } from '../components/Sidebar'
import { T } from '../theme'
import type { ChecklistItem, ChecklistItemStatus } from '../types/database'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function statusSymbol(s: CompletionStatus) {
  if (s === 'all') return { symbol: 'O', color: T.success }
  if (s === 'partial') return { symbol: '△', color: T.warning }
  if (s === 'none') return { symbol: 'X', color: T.danger }
  return null
}

function ChecklistReadonlyModal({ checklistId, dateStr, title, onClose }: {
  checklistId: string; dateStr: string; title: string; onClose: () => void
}) {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [statuses, setStatuses] = useState<ChecklistItemStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const [itemsRes, statusRes] = await Promise.all([
        supabase.from('checklist_items').select('*').eq('checklist_id', checklistId).order('sort_order'),
        supabase.from('checklist_item_status').select('*').eq('checklist_id', checklistId).eq('status_date', dateStr),
      ])
      setItems(itemsRes.data ?? [])
      setStatuses(statusRes.data ?? [])
      setLoading(false)
    }
    run()
  }, [checklistId, dateStr])

  const isChecked = (itemId: string) => statuses.some((s) => s.item_id === itemId && s.is_checked)

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: T.bg }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={onClose} className="text-sm" style={{ color: T.muted }}>← 뒤로</button>
        <div className="text-center">
          <p className="text-base font-semibold" style={{ color: T.text }}>{title}</p>
          <p className="text-xs" style={{ color: T.muted }}>{dateStr}</p>
        </div>
        <div className="w-10" />
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: T.muted }}>불러오는 중...</div>
      ) : (
        <div className="px-4 py-4 space-y-2 max-w-lg mx-auto w-full">
          {items.map((item) => {
            const checked = isChecked(item.id)
            return (
              <div key={item.id} className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ background: checked ? T.accentDim : T.surface, border: `1px solid ${checked ? T.accentBorder : T.border}` }}>
                <span className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                  style={{ border: `2px solid ${checked ? T.accent : T.muted}`, background: checked ? T.accent : 'transparent' }}>
                  {checked && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#0d0d12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-sm" style={{ color: checked ? T.muted : T.text, textDecoration: checked ? 'line-through' : 'none' }}>
                  {item.label}
                </span>
              </div>
            )
          })}
          {items.length === 0 && <p className="text-center text-sm py-8" style={{ color: T.muted }}>항목이 없습니다</p>}
        </div>
      )}
    </div>
  )
}

function DateDetailSheet({ dateStr, entries, onSelectChecklist, onClose }: {
  dateStr: string; entries: DayEntry[]; onSelectChecklist: (id: string, title: string) => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl" style={{ background: T.surface, border: `1px solid ${T.border}`, maxHeight: '60vh', overflowY: 'auto' }}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: T.accent }}>{dateStr}</p>
        <button onClick={onClose} className="text-lg leading-none" style={{ color: T.muted }}>×</button>
      </div>
      <div className="px-4 pb-6 space-y-2">
        {entries.map((entry) => {
          const sym = statusSymbol(entry.status)
          return (
            <button key={entry.checklistId} onClick={() => onSelectChecklist(entry.checklistId, entry.title)}
              className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors"
              style={{ background: T.surface2, border: `1px solid ${T.border}` }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.borderColor = T.accentBorder)}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.borderColor = T.border)}>
              <span className="text-sm" style={{ color: T.text }}>{entry.title}</span>
              {sym
                ? <span className="text-sm font-bold" style={{ color: sym.color }}>{sym.symbol}</span>
                : <span className="text-xs" style={{ color: T.muted }}>예정</span>
              }
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function MyPage() {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const { data, loading } = useCalendarData(user?.id, year, month)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedChecklist, setSelectedChecklist] = useState<{ id: string; title: string } | null>(null)

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const totalDays = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="px-4 py-3 flex items-center gap-3" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => setSidebarOpen(true)} className="text-lg" style={{ color: T.muted }}>☰</button>
        <h1 className="text-lg font-bold" style={{ color: T.text }}>마이페이지</h1>
      </div>

      {/* 월 네비게이션 */}
      <div className="px-4 py-4 flex items-center justify-between max-w-lg mx-auto">
        <button onClick={prevMonth} className="text-xl px-2" style={{ color: T.muted }}>‹</button>
        <span className="text-base font-semibold" style={{ color: T.text }}>{year}년 {month}월</span>
        <button onClick={nextMonth} className="text-xl px-2" style={{ color: T.muted }}>›</button>
      </div>

      {/* 캘린더 */}
      <div className="px-4 max-w-lg mx-auto">
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className="text-center py-1 text-xs font-medium"
              style={{ color: i === 0 ? T.danger : i === 6 ? '#60a5fa' : T.muted }}>
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm" style={{ color: T.muted }}>불러오는 중...</div>
        ) : (
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const entries = data[dateStr] ?? []
              const isToday = dateStr === todayStr
              const isSelected = selectedDate === dateStr
              const dayOfWeek = idx % 7

              const statusPriority: Record<string, number> = { all: 1, partial: 2, none: 3, future: 0 }
              const worstEntry = entries
                .filter(e => e.status !== 'future')
                .sort((a, b) => statusPriority[b.status] - statusPriority[a.status])[0]

              return (
                <button key={dateStr} onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className="flex flex-col items-center py-1.5 rounded-lg transition-colors"
                  style={{ background: isSelected ? T.accentDim : 'transparent', minHeight: 52 }}>
                  <span className="w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-0.5"
                    style={{
                      background: isToday ? T.accent : 'transparent',
                      color: isToday ? '#0d0d12' : dayOfWeek === 0 ? T.danger : dayOfWeek === 6 ? '#60a5fa' : T.text,
                    }}>
                    {day}
                  </span>
                  {worstEntry && (
                    <span className="text-xs font-bold leading-none" style={{ color: statusSymbol(worstEntry.status)?.color }}>
                      {statusSymbol(worstEntry.status)?.symbol}
                    </span>
                  )}
                  {!worstEntry && entries.length > 0 && (
                    <span className="w-1 h-1 rounded-full mt-0.5" style={{ background: T.accent }} />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 범례 */}
      <div className="px-4 py-3 max-w-lg mx-auto flex gap-4">
        {[
          { symbol: 'O', color: T.success, label: '모두 수행' },
          { symbol: '△', color: T.warning, label: '일부 수행' },
          { symbol: 'X', color: T.danger, label: '미수행' },
        ].map(({ symbol, color, label }) => (
          <div key={symbol} className="flex items-center gap-1.5">
            <span className="text-xs font-bold" style={{ color }}>{symbol}</span>
            <span className="text-xs" style={{ color: T.muted }}>{label}</span>
          </div>
        ))}
      </div>

      {selectedDate && data[selectedDate] && !selectedChecklist && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setSelectedDate(null)} />
          <DateDetailSheet dateStr={selectedDate} entries={data[selectedDate]}
            onSelectChecklist={(id, title) => setSelectedChecklist({ id, title })}
            onClose={() => setSelectedDate(null)} />
        </>
      )}

      {selectedChecklist && selectedDate && (
        <ChecklistReadonlyModal checklistId={selectedChecklist.id} dateStr={selectedDate}
          title={selectedChecklist.title} onClose={() => setSelectedChecklist(null)} />
      )}
    </div>
  )
}
