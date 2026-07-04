import { useState } from 'react'
import { useTeamCalendarData, type TeamDayChecklist } from '../hooks/useTeamCalendarData'
import { T } from '../theme'
import { useAuth } from '../hooks/useAuth'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function pad(n: number) { return String(n).padStart(2, '0') }

function rateColor(rate: number) {
  if (rate >= 80) return T.success
  if (rate >= 40) return T.warning
  return T.danger
}

function DayDetailSheet({
  dateStr,
  checklists,
  myUserId,
  onClose,
}: {
  dateStr: string
  checklists: TeamDayChecklist[]
  myUserId: string
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl"
      style={{ background: T.surface, border: `1px solid ${T.border}`, maxHeight: '65vh', overflowY: 'auto' }}
    >
      <div className="px-4 pt-4 pb-2 flex items-center justify-between sticky top-0" style={{ background: T.surface }}>
        <p className="text-sm font-semibold" style={{ color: T.accent }}>{dateStr}</p>
        <button onClick={onClose} className="text-xl leading-none" style={{ color: T.muted }}>×</button>
      </div>

      <div className="px-4 pb-8 space-y-4">
        {checklists.map((cl) => (
          <div key={cl.checklistId}>
            <p className="text-xs font-semibold mb-2" style={{ color: T.muted }}>{cl.title}</p>
            <div className="space-y-1.5">
              {cl.items.map((item) => (
                <div
                  key={item.itemId}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5"
                  style={{
                    background: item.isChecked ? T.accentDim : T.surface2,
                    border: `1px solid ${item.isChecked ? T.accentBorder : T.border}`,
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                      style={{
                        border: `2px solid ${item.isChecked ? T.accent : T.muted}`,
                        background: item.isChecked ? T.accent : 'transparent',
                      }}
                    >
                      {item.isChecked && (
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#0d0d12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm" style={{ color: item.isChecked ? T.muted : T.text, textDecoration: item.isChecked ? 'line-through' : 'none' }}>
                      {item.label}
                    </span>
                  </div>
                  {item.isChecked && item.checkedBy && (
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: T.surface, color: T.accent, border: `1px solid ${T.accentBorder}` }}>
                      {item.checkedBy === myUserId ? '나' : item.checkedBy.slice(0, 6)}
                    </span>
                  )}
                </div>
              ))}
              {cl.items.length === 0 && (
                <p className="text-xs text-center py-2" style={{ color: T.muted }}>항목 없음</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TeamStatusTab({ teamId }: { teamId: string }) {
  const { user } = useAuth()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const { data, loading } = useTeamCalendarData(teamId, year, month)

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const totalDays = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  return (
    <div className="px-4 py-4 max-w-lg mx-auto">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="text-xl px-2" style={{ color: T.muted }}>‹</button>
        <span className="text-sm font-semibold" style={{ color: T.text }}>{year}년 {month}월</span>
        <button onClick={nextMonth} className="text-xl px-2" style={{ color: T.muted }}>›</button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className="text-center py-1 text-xs font-medium"
            style={{ color: i === 0 ? T.danger : i === 6 ? '#60a5fa' : T.muted }}>
            {d}
          </div>
        ))}
      </div>

      {/* 달력 */}
      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: T.muted }}>불러오는 중...</div>
      ) : (
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />
            const dateStr = `${year}-${pad(month)}-${pad(day)}`
            const dayData = data[dateStr]
            const isToday = dateStr === todayStr
            const isSelected = selectedDate === dateStr
            const isFuture = dateStr > todayStr
            const dayOfWeek = idx % 7

            return (
              <button
                key={dateStr}
                onClick={() => !isFuture && dayData && setSelectedDate(isSelected ? null : dateStr)}
                className="flex flex-col items-center py-1.5 rounded-lg transition-colors"
                style={{ background: isSelected ? T.accentDim : 'transparent', minHeight: 52 }}
              >
                <span
                  className="w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-0.5"
                  style={{
                    background: isToday ? T.accent : 'transparent',
                    color: isToday ? '#0d0d12' : dayOfWeek === 0 ? T.danger : dayOfWeek === 6 ? '#60a5fa' : T.text,
                  }}
                >
                  {day}
                </span>
                {dayData && !isFuture && (
                  <span className="text-xs font-bold leading-none" style={{ color: rateColor(dayData.rate) }}>
                    {dayData.rate}%
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* 범례 */}
      <div className="flex gap-4 mt-3">
        {[
          { color: T.success, label: '80% 이상' },
          { color: T.warning, label: '40~79%' },
          { color: T.danger, label: '39% 이하' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-xs" style={{ color: T.muted }}>{label}</span>
          </div>
        ))}
      </div>

      {/* 날짜 상세 바텀시트 */}
      {selectedDate && data[selectedDate] && user && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setSelectedDate(null)} />
          <DayDetailSheet
            dateStr={selectedDate}
            checklists={data[selectedDate].checklists}
            myUserId={user.id}
            onClose={() => setSelectedDate(null)}
          />
        </>
      )}
    </div>
  )
}
