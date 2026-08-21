import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useChecklistDetail } from '../hooks/useChecklistDetail'
import { useChecklistSnooze } from '../hooks/useChecklistSnooze'
import { useSettings } from '../hooks/useSettings'
import { syncToSheet } from '../lib/sheetSync'
import { todayString } from '../lib/date'
import { T } from '../theme'
import type { ChecklistItem } from '../types/database'

function minuteLabel(m: number) {
  if (m < 60) return `${m}분`
  if (m === 60) return '1시간'
  return m % 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${Math.floor(m / 60)}시간`
}

/** 측정 항목의 최종 저장 시각 — 저장할 때마다 checked_at이 덮어써진다 */
function formatSavedAt(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function CheckPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { checklist, items, statuses, loading, toggleItem, saveMeasureValue, clearMeasureValue } = useChecklistDetail(id)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { settings } = useSettings()
  const today = todayString()
  const { snooze, snoozeFor, muteToday, clearSnooze } = useChecklistSnooze(id, user?.id, today)
  const [showSnooze, setShowSnooze] = useState(false)
  const [snoozing, setSnoozing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  // 측정 항목별 입력 중인 값 (itemId → value)
  const [measureInputs, setMeasureInputs] = useState<Record<string, string>>({})
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  // 롱프레스로 입력 취소할 측정 항목
  const [cancelTarget, setCancelTarget] = useState<ChecklistItem | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 알림을 눌러 들어온 경우 미루기 화면을 띄운다.
  // 새로고침해도 다시 뜨지 않도록 파라미터는 지운다.
  useEffect(() => {
    if (searchParams.get('notify') !== '1') return
    setShowSnooze(true)
    const next = new URLSearchParams(searchParams)
    next.delete('notify')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  if (loading) return <div className="flex items-center justify-center min-h-screen text-sm" style={{ background: T.bg, color: T.muted }}>불러오는 중...</div>
  if (!checklist) return <div className="flex items-center justify-center min-h-screen text-sm" style={{ background: T.bg, color: T.muted }}>체크리스트를 찾을 수 없습니다</div>

  const getStatus = (itemId: string) => {
    if (checklist.repeat_type === 'once') return statuses.find((s) => s.item_id === itemId && s.is_checked)
    return statuses.find((s) => s.item_id === itemId && s.status_date === today && s.is_checked)
  }

  const checkedCount = items.filter((i) => !!getStatus(i.id)).length
  const allChecked = items.length > 0 && checkedCount === items.length
  const progress = items.length > 0 ? (checkedCount / items.length) * 100 : 0

  // once 체크리스트는 값이 입력된 날짜에 status_date가 고정되므로 그 날짜를 쓴다
  const syncDate = checklist.repeat_type === 'once'
    ? (statuses.find((s) => s.status_date)?.status_date ?? today)
    : today

  const goHome = () =>
    navigate('/', {
      state: checklist.owner_type === 'team'
        ? { tab: 'team', teamId: checklist.owner_id }
        : { tab: 'personal' },
    })

  const handleConfirm = async () => {
    setSyncError(null)
    setSyncing(true)
    const message = await syncToSheet({
      kind: 'checklist',
      checklistId: checklist.id,
      statusDate: syncDate,
    })
    setSyncing(false)

    if (message) { setSyncError(message); return }
    goHome()
  }

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const startLongPress = (e: React.PointerEvent, item: ChecklistItem) => {
    // 입력 필드나 버튼을 누른 것이면 롱프레스로 보지 않는다
    if ((e.target as HTMLElement).closest('input, button, textarea, select')) return
    cancelLongPress()
    longPressTimer.current = setTimeout(() => setCancelTarget(item), 500)
  }

  const handleCancelValue = async () => {
    if (!cancelTarget) return
    const itemId = cancelTarget.id
    await clearMeasureValue(itemId)
    setMeasureInputs((prev) => ({ ...prev, [itemId]: '' }))
    setNoteInputs((prev) => ({ ...prev, [itemId]: '' }))
    setCancelTarget(null)
  }

  const runSnooze = async (action: () => Promise<{ error: unknown }>, close = true) => {
    setSnoozing(true)
    await action()
    setSnoozing(false)
    if (close) setShowSnooze(false)
  }

  const handleMeasureSave = async (itemId: string) => {
    if (!user) return
    const val = measureInputs[itemId] ?? ''
    const note = noteInputs[itemId] ?? ''
    await saveMeasureValue(itemId, user.id, val, note)
    setMeasureInputs((prev) => ({ ...prev, [itemId]: '' }))
    setNoteInputs((prev) => ({ ...prev, [itemId]: '' }))
  }

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      {/* 헤더 */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => navigate(-1)} className="text-sm" style={{ color: T.muted }}>← 뒤로</button>
        <h1 className="text-base font-semibold" style={{ color: T.text }}>{checklist.title}</h1>
        <button onClick={() => navigate(`/checklist/${id}/edit?ownerType=${checklist.owner_type}&ownerId=${checklist.owner_id}`)} className="text-sm" style={{ color: T.accent }}>편집</button>
      </div>

      {/* 진행률 */}
      <div className="px-4 py-3" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <div className="flex items-center justify-between text-sm mb-2" style={{ color: T.muted }}>
          <span>{checkedCount} / {items.length}</span>
          <span style={{ color: allChecked ? T.accent : T.muted }}>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: T.border }}>
          <div className="h-full transition-all duration-300"
            style={{ width: `${progress}%`, background: allChecked ? T.accent : `linear-gradient(90deg, ${T.accent}99, ${T.accent})` }} />
        </div>
      </div>

      {/* 항목 */}
      <div className="px-4 py-4 space-y-2 max-w-lg mx-auto pb-28">
        {items.map((item) => {
          const status = getStatus(item.id)
          const isDone = !!status

          if (item.item_type === 'measure') {
            const savedValue = status?.value
            const isOnceAndDone = checklist.repeat_type === 'once' && isDone
            return (
              <div key={item.id} className="rounded-xl px-4 py-3 select-none"
                style={{
                  background: isDone ? T.accentDim : T.surface,
                  border: `1px solid ${isDone ? T.accentBorder : T.border}`,
                }}
                onPointerDown={(e) => isDone && startLongPress(e, item)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onContextMenu={(e) => isDone && e.preventDefault()}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: T.accentDim, color: T.accent }}>측정</span>
                    <span className="text-sm" style={{ color: T.text }}>{item.label}</span>
                    {item.unit && <span className="text-xs" style={{ color: T.muted }}>({item.unit})</span>}
                  </div>
                  {isDone && (
                    <span className="text-sm font-semibold" style={{ color: T.accent }}>
                      {savedValue ?? '✓'}{item.unit ? ` ${item.unit}` : ''}
                    </span>
                  )}
                </div>
                {isDone && (
                  <p className="text-xs mb-2" style={{ color: T.muted }}>
                    {status?.checked_at && `최종 저장 ${formatSavedAt(status.checked_at)} · `}꾹 눌러 입력 취소
                  </p>
                )}
                {!isOnceAndDone && (
                  item.options && item.options.length > 0 ? (
                    // 선택 보기 버튼 + 비고
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {item.options.map((opt) => {
                          const isSaved = status?.value === opt
                          return (
                            <button key={opt}
                              onClick={() => setMeasureInputs((prev) => ({ ...prev, [item.id]: opt }))}
                              className="px-3 py-1.5 rounded-lg text-sm font-medium"
                              style={{
                                background: isSaved ? T.accent : measureInputs[item.id] === opt ? T.accentDim : T.surface2,
                                color: isSaved ? '#0d0d12' : measureInputs[item.id] === opt ? T.accent : T.muted,
                                border: `1px solid ${(isSaved || measureInputs[item.id] === opt) ? T.accentBorder : T.border}`,
                              }}>
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                      {item.has_note && (
                        <div className="flex gap-2 items-center">
                          <input
                            value={noteInputs[item.id] ?? (status?.note ?? '')}
                            onChange={(e) => setNoteInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && measureInputs[item.id] && handleMeasureSave(item.id)}
                            placeholder="비고 입력..."
                            className="flex-1 text-sm outline-none rounded-lg px-3 py-1.5"
                            style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text }}
                          />
                        </div>
                      )}
                      {measureInputs[item.id] && (
                        <button
                          onClick={() => handleMeasureSave(item.id)}
                          className="w-full py-1.5 rounded-lg text-sm font-medium"
                          style={{ background: T.accent, color: '#0d0d12' }}>
                          저장
                        </button>
                      )}
                    </div>
                  ) : (
                    // 직접 입력
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <input
                          value={measureInputs[item.id] ?? ''}
                          onChange={(e) => setMeasureInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleMeasureSave(item.id)}
                          placeholder={isDone ? '값 수정...' : '값 입력...'}
                          className="flex-1 text-sm outline-none rounded-lg px-3 py-1.5"
                          style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text }}
                        />
                        <button
                          onClick={() => handleMeasureSave(item.id)}
                          disabled={!measureInputs[item.id]?.trim()}
                          className="text-sm font-medium px-3 py-1.5 rounded-lg flex-shrink-0"
                          style={{
                            background: measureInputs[item.id]?.trim() ? T.accent : T.surface2,
                            color: measureInputs[item.id]?.trim() ? '#0d0d12' : T.muted,
                          }}>
                          저장
                        </button>
                      </div>
                      {item.has_note && (
                        <input
                          value={noteInputs[item.id] ?? (status?.note ?? '')}
                          onChange={(e) => setNoteInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleMeasureSave(item.id)}
                          placeholder="비고 입력..."
                          className="w-full text-sm outline-none rounded-lg px-3 py-1.5"
                          style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text }}
                        />
                      )}
                    </div>
                  )
                )}
              </div>
            )
          }

          // check 타입
          const disabled = checklist.repeat_type === 'once' && isDone
          return (
            <button key={item.id}
              onClick={() => !disabled && user && toggleItem(item.id, user.id)}
              disabled={disabled}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
              style={{
                background: isDone ? T.accentDim : T.surface,
                border: `1px solid ${isDone ? T.accentBorder : T.border}`,
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'default' : 'pointer',
              }}>
              <span className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                style={{ border: `2px solid ${isDone ? T.accent : T.muted}`, background: isDone ? T.accent : 'transparent' }}>
                {isDone && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#0d0d12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="text-sm" style={{ color: isDone ? T.muted : T.text, textDecoration: isDone ? 'line-through' : 'none' }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* 하단 버튼 */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center items-center gap-3 px-4">
        {checklist.notify_time && (
          <button onClick={() => setShowSnooze(true)}
            className="rounded-2xl px-5 py-4 text-sm font-medium shadow-lg"
            style={{
              background: snooze ? T.accentDim : T.surface,
              color: snooze ? T.accent : T.muted,
              border: `1px solid ${snooze ? T.accentBorder : T.border}`,
            }}>
            {snooze ? '알림 미뤄둠' : '나중에 알림'}
          </button>
        )}
        <button onClick={() => setShowModal(true)}
          className="rounded-2xl px-10 py-4 text-base font-semibold shadow-lg transition-colors"
          style={{ background: T.accent, color: '#0d0d12' }}>
          OK
        </button>
      </div>

      {/* 알림 미루기 */}
      {showSnooze && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setShowSnooze(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <div className="relative rounded-t-2xl px-4 pt-4 pb-8"
            style={{ background: T.surface, maxHeight: '70vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: T.border }} />

            <p className="text-sm font-semibold mb-1" style={{ color: T.text }}>{checklist.title}</p>
            <p className="text-xs mb-4" style={{ color: T.muted }}>
              {snooze
                ? snooze.remind_at
                  ? `${formatSavedAt(snooze.remind_at)}에 다시 알립니다.`
                  : '오늘은 더 알리지 않습니다.'
                : '지금 하기 어려우면 알림을 미룰 수 있습니다. 나에게만 적용됩니다.'}
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {settings.snoozeTimes.map((m) => (
                <button key={m} disabled={snoozing}
                  onClick={() => runSnooze(() => snoozeFor(m))}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium"
                  style={{
                    background: T.accentDim, color: T.accent,
                    border: `1px solid ${T.accentBorder}`, opacity: snoozing ? 0.4 : 1,
                  }}>
                  {minuteLabel(m)} 후
                </button>
              ))}
              {settings.snoozeTimes.length === 0 && (
                <p className="text-xs" style={{ color: T.muted }}>설정에서 미루기 시간을 추가해주세요.</p>
              )}
            </div>

            <button disabled={snoozing} onClick={() => runSnooze(() => muteToday())}
              className="w-full py-2.5 rounded-lg text-sm font-medium mb-2"
              style={{ background: T.dangerDim, color: T.danger, border: `1px solid ${T.dangerBorder}`, opacity: snoozing ? 0.4 : 1 }}>
              오늘은 그만
            </button>

            {snooze && (
              <button disabled={snoozing} onClick={() => runSnooze(() => clearSnooze(), false)}
                className="w-full py-2.5 rounded-lg text-sm mb-2"
                style={{ border: `1px solid ${T.border}`, color: T.muted, opacity: snoozing ? 0.4 : 1 }}>
                미루기 취소 (정시 알림 다시 받기)
              </button>
            )}

            <button onClick={() => setShowSnooze(false)}
              className="w-full py-2.5 rounded-lg text-sm"
              style={{ border: `1px solid ${T.border}`, color: T.muted }}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 측정값 입력 취소 확인 */}
      {cancelTarget && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setCancelTarget(null)}>
          <div className="rounded-2xl p-6 w-full max-w-xs text-center"
            style={{ background: T.surface, border: `1px solid ${T.border}` }}
            onClick={(e) => e.stopPropagation()}>
            <p className="text-sm mb-1" style={{ color: T.text }}>입력을 취소하시겠습니까?</p>
            <p className="text-xs mb-6" style={{ color: T.muted }}>
              '{cancelTarget.label}'에 저장된 값{cancelTarget.has_note ? '과 비고' : ''}이 삭제되고 미입력 상태로 돌아갑니다.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setCancelTarget(null)} className="flex-1 rounded-xl py-2.5 text-sm"
                style={{ border: `1px solid ${T.border}`, color: T.muted }}>닫기</button>
              <button onClick={handleCancelValue} className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                style={{ background: T.dangerDim, color: T.danger, border: `1px solid ${T.dangerBorder}` }}>
                입력 취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 확인 모달 */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl p-6 w-full max-w-xs text-center" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            {syncError ? (
              <>
                <p className="text-sm mb-1" style={{ color: T.danger }}>구글 시트 전송에 실패했습니다.</p>
                <p className="text-xs mb-6" style={{ color: T.muted }}>{syncError}</p>
                <div className="flex gap-3">
                  <button onClick={handleConfirm} disabled={syncing}
                    className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                    style={{ background: T.accent, color: '#0d0d12', opacity: syncing ? 0.4 : 1 }}>
                    {syncing ? '전송 중...' : '다시 시도'}
                  </button>
                  <button onClick={goHome} className="flex-1 rounded-xl py-2.5 text-sm"
                    style={{ border: `1px solid ${T.border}`, color: T.muted }}>넘어가기</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm mb-6 whitespace-pre-line" style={{ color: T.text }}>
                  {allChecked ? '모든 항목을 수행하였습니다.' : '미수행 항목이 있습니다.\n넘어가시겠습니까?'}
                </p>
                <div className={`flex gap-3 ${allChecked ? 'justify-center' : ''}`}>
                  {!allChecked && (
                    <button onClick={() => setShowModal(false)} disabled={syncing}
                      className="flex-1 rounded-xl py-2.5 text-sm"
                      style={{ border: `1px solid ${T.border}`, color: T.muted }}>취소</button>
                  )}
                  <button
                    onClick={handleConfirm}
                    disabled={syncing}
                    className={`rounded-xl py-2.5 text-sm font-medium ${allChecked ? 'px-10' : 'flex-1'}`}
                    style={{ background: T.accent, color: '#0d0d12', opacity: syncing ? 0.4 : 1 }}>
                    {syncing ? '전송 중...' : '확인'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
