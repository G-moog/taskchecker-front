import { useState } from 'react'
import { Sidebar } from '../components/Sidebar'
import { useSettings } from '../hooks/useSettings'
import { T } from '../theme'

function MinutePresetEditor({ values, onChange }: {
  values: number[]
  onChange: (next: number[]) => void
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const n = parseInt(input.trim())
    if (!n || n <= 0 || n > 1440) return
    if (values.includes(n)) { setInput(''); return }
    onChange([...values, n].sort((a, b) => a - b))
    setInput('')
  }

  const remove = (v: number) => onChange(values.filter((x) => x !== v))

  const label = (m: number) => m < 60 ? `${m}분` : m === 60 ? '1시간' : `${Math.floor(m / 60)}시간 ${m % 60 ? `${m % 60}분` : ''}`

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {values.map((v) => (
          <div key={v} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm"
            style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text }}>
            <span>{label(v)}</span>
            <button onClick={() => remove(v)} className="ml-1 text-xs" style={{ color: T.muted }}>✕</button>
          </div>
        ))}
        {values.length === 0 && <span className="text-xs" style={{ color: T.muted }}>버튼 없음</span>}
      </div>
      <div className="flex gap-2">
        <input
          type="number" min={1} max={1440}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="분 입력 (예: 15)"
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text }}
        />
        <button onClick={add} className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: T.accent, color: '#fff' }}>
          추가
        </button>
      </div>
    </div>
  )
}

function TimePresetEditor({ values, onChange }: {
  values: string[]
  onChange: (next: string[]) => void
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const v = input.trim()
    if (!/^\d{2}:\d{2}$/.test(v)) return
    if (values.includes(v)) { setInput(''); return }
    onChange([...values, v].sort())
    setInput('')
  }

  const remove = (v: string) => onChange(values.filter((x) => x !== v))

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {values.map((v) => (
          <div key={v} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm"
            style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text }}>
            <span>{v}</span>
            <button onClick={() => remove(v)} className="ml-1 text-xs" style={{ color: T.muted }}>✕</button>
          </div>
        ))}
        {values.length === 0 && <span className="text-xs" style={{ color: T.muted }}>버튼 없음</span>}
      </div>
      <div className="flex gap-2">
        <input
          type="time"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text }}
        />
        <button onClick={add} className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: T.accent, color: '#fff' }}>
          추가
        </button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { settings, update } = useSettings()

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex items-center gap-3 px-4 py-4 sticky top-0 z-30"
        style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg" style={{ color: T.muted }}>
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-base font-semibold" style={{ color: T.text }}>설정</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* 할 일 알림 빠른 설정 */}
        <div className="rounded-xl p-4" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-2 mb-1">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: T.accent }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9m6 0a3 3 0 01-6 0m6 0H3.5m17 0H15M12 3v1m0 0a7 7 0 017 7v3l1.5 1.5H3.5L5 14v-3a7 7 0 017-7z" />
            </svg>
            <span className="text-sm font-semibold" style={{ color: T.text }}>할 일 알림 — 빠른 시간 버튼</span>
          </div>
          <p className="text-xs mb-4" style={{ color: T.muted }}>할 일 목록에서 알림 설정 시 표시될 "N분 후" 버튼을 설정합니다.</p>
          <MinutePresetEditor
            values={settings.todoQuickTimes}
            onChange={(next) => update({ todoQuickTimes: next })}
          />
        </div>

        {/* 체크리스트 알림 빠른 설정 */}
        <div className="rounded-xl p-4" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-2 mb-1">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: T.accent }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-sm font-semibold" style={{ color: T.text }}>체크리스트 알림 — 빠른 시각 버튼</span>
          </div>
          <p className="text-xs mb-4" style={{ color: T.muted }}>체크리스트 편집에서 알림 시각 설정 시 표시될 시각 버튼을 설정합니다.</p>
          <TimePresetEditor
            values={settings.checklistQuickTimes}
            onChange={(next) => update({ checklistQuickTimes: next })}
          />
        </div>

        {/* 알림 미루기 */}
        <div className="rounded-xl p-4" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-2 mb-1">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: T.accent }}>
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
            </svg>
            <span className="text-sm font-semibold" style={{ color: T.text }}>알림 미루기 — 시간 버튼</span>
          </div>
          <p className="text-xs mb-4" style={{ color: T.muted }}>체크리스트 알림을 미룰 때 표시될 "N분 후" 버튼을 설정합니다.</p>
          <MinutePresetEditor
            values={settings.snoozeTimes}
            onChange={(next) => update({ snoozeTimes: next })}
          />
        </div>

      </div>
    </div>
  )
}
