import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { T } from '../theme'
import { useMeasurementForms } from '../hooks/useMeasurementForms'
import type { MeasurementForm } from '../types/database'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

interface Props {
  ownerType: 'personal' | 'team'
  ownerId: string
}

export function MeasurementList({ ownerType, ownerId }: Props) {
  const navigate = useNavigate()
  const { forms, loading, deleteForm } = useMeasurementForms(ownerType, ownerId)

  const handleNew = () =>
    navigate(`/measurement/new/edit?ownerType=${ownerType}&ownerId=${ownerId}`)

  if (loading) return <p className="text-center text-sm py-8" style={{ color: T.muted }}>불러오는 중...</p>

  return (
    <div className="px-4 py-4 space-y-2 max-w-lg mx-auto pb-24">
      {forms.length === 0 ? (
        <p className="text-center text-sm py-8" style={{ color: T.muted }}>측정 양식이 없습니다</p>
      ) : (
        forms.map((form) => (
          <MeasurementCard
            key={form.id}
            form={form}
            onInput={() => navigate(`/measurement/${form.id}/input`)}
            onHistory={() => navigate(`/measurement/${form.id}/history`)}
            onEdit={() => navigate(`/measurement/${form.id}/edit?ownerType=${ownerType}&ownerId=${ownerId}`)}
            onDelete={() => deleteForm(form.id)}
          />
        ))
      )}

      <div className="fixed bottom-6 right-6">
        <button
          onClick={handleNew}
          className="rounded-full w-14 h-14 text-2xl shadow-lg flex items-center justify-center"
          style={{ background: T.accent, color: '#0d0d12' }}
        >
          +
        </button>
      </div>
    </div>
  )
}

function MeasurementCard({
  form, onInput, onHistory, onEdit, onDelete,
}: {
  form: MeasurementForm
  onInput: () => void
  onHistory: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <>
      <div className="rounded-xl px-4 py-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="font-medium text-sm flex-1 truncate" style={{ color: T.text }}>{form.title}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {form.notify_weekday !== null && (
              <span className="text-xs" style={{ color: T.muted }}>
                매주 {WEEKDAYS[form.notify_weekday]}{form.notify_time ? ` ${form.notify_time.slice(0, 5)}` : ''}
              </span>
            )}
            <button onClick={onEdit} className="text-xs px-2 py-0.5 rounded"
              style={{ color: T.muted, border: `1px solid ${T.border}` }}>편집</button>
            <button onClick={() => setShowConfirm(true)} style={{ color: T.muted }}
              onMouseEnter={e => (e.currentTarget.style.color = T.danger)}
              onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onInput}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{ background: T.accentDim, color: T.accent, border: `1px solid ${T.accentBorder}` }}>
            값 입력
          </button>
          <button onClick={onHistory}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{ background: T.surface2, color: T.muted, border: `1px solid ${T.border}` }}>
            기록 보기
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowConfirm(false)}>
          <div className="rounded-2xl p-6 w-full max-w-xs text-center"
            style={{ background: T.surface, border: `1px solid ${T.border}` }}
            onClick={e => e.stopPropagation()}>
            <p className="text-sm mb-1" style={{ color: T.text }}>측정 양식을 삭제하시겠습니까?</p>
            <p className="text-xs mb-6" style={{ color: T.muted }}>모든 기록이 함께 삭제됩니다.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 rounded-xl py-2.5 text-sm"
                style={{ border: `1px solid ${T.border}`, color: T.muted }}>취소</button>
              <button onClick={() => { onDelete(); setShowConfirm(false) }}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                style={{ background: T.dangerDim, color: T.danger, border: `1px solid ${T.dangerBorder}` }}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
