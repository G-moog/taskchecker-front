import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useChecklistDetail } from '../hooks/useChecklistDetail'
import { syncToSheet } from '../lib/sheetSync'
import { T } from '../theme'

/** 측정 항목의 최종 저장 시각 — 저장할 때마다 checked_at이 덮어써진다 */
function formatSavedAt(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function CheckPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { checklist, items, statuses, loading, toggleItem, saveMeasureValue } = useChecklistDetail(id)
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  // 측정 항목별 입력 중인 값 (itemId → value)
  const [measureInputs, setMeasureInputs] = useState<Record<string, string>>({})
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  if (loading) return <div className="flex items-center justify-center min-h-screen text-sm" style={{ background: T.bg, color: T.muted }}>불러오는 중...</div>
  if (!checklist) return <div className="flex items-center justify-center min-h-screen text-sm" style={{ background: T.bg, color: T.muted }}>체크리스트를 찾을 수 없습니다</div>

  const today = new Date().toISOString().split('T')[0]

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
              <div key={item.id} className="rounded-xl px-4 py-3"
                style={{
                  background: isDone ? T.accentDim : T.surface,
                  border: `1px solid ${isDone ? T.accentBorder : T.border}`,
                }}>
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
                {isDone && status?.checked_at && (
                  <p className="text-xs mb-2" style={{ color: T.muted }}>
                    최종 저장 {formatSavedAt(status.checked_at)}
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

      {/* OK 버튼 */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4">
        <button onClick={() => setShowModal(true)}
          className="rounded-2xl px-10 py-4 text-base font-semibold shadow-lg transition-colors"
          style={{ background: T.accent, color: '#0d0d12' }}>
          OK
        </button>
      </div>

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
