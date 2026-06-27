import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useChecklistDetail } from '../hooks/useChecklistDetail'
import { T } from '../theme'

export default function CheckPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { checklist, items, statuses, loading, toggleItem } = useChecklistDetail(id)
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)

  if (loading) return <div className="flex items-center justify-center min-h-screen text-sm" style={{ background: T.bg, color: T.muted }}>불러오는 중...</div>
  if (!checklist) return <div className="flex items-center justify-center min-h-screen text-sm" style={{ background: T.bg, color: T.muted }}>체크리스트를 찾을 수 없습니다</div>

  const today = new Date().toISOString().split('T')[0]

  const isChecked = (itemId: string) => {
    if (checklist.repeat_type === 'once') return statuses.some((s) => s.item_id === itemId && s.is_checked)
    return statuses.some((s) => s.item_id === itemId && s.status_date === today && s.is_checked)
  }

  const checkedCount = items.filter((i) => isChecked(i.id)).length
  const allChecked = items.length > 0 && checkedCount === items.length
  const progress = items.length > 0 ? (checkedCount / items.length) * 100 : 0

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      {/* 헤더 */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => navigate(-1)} className="text-sm" style={{ color: T.muted }}>← 뒤로</button>
        <h1 className="text-base font-semibold" style={{ color: T.text }}>{checklist.title}</h1>
        <button onClick={() => navigate(`/checklist/${id}/edit`)} className="text-sm" style={{ color: T.accent }}>편집</button>
      </div>

      {/* 진행률 */}
      <div className="px-4 py-3" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <div className="flex items-center justify-between text-sm mb-2" style={{ color: T.muted }}>
          <span>{checkedCount} / {items.length}</span>
          <span style={{ color: allChecked ? T.accent : T.muted }}>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: T.border }}>
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progress}%`, background: allChecked ? T.accent : `linear-gradient(90deg, ${T.accent}99, ${T.accent})` }}
          />
        </div>
      </div>

      {/* 항목 */}
      <div className="px-4 py-4 space-y-2 max-w-lg mx-auto pb-28">
        {items.map((item) => {
          const checked = isChecked(item.id)
          const disabled = checklist.repeat_type === 'once' && checked
          return (
            <button
              key={item.id}
              onClick={() => !disabled && user && toggleItem(item.id, user.id)}
              disabled={disabled}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
              style={{
                background: checked ? T.accentDim : T.surface,
                border: `1px solid ${checked ? T.accentBorder : T.border}`,
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'default' : 'pointer',
              }}
            >
              <span
                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  border: `2px solid ${checked ? T.accent : T.muted}`,
                  background: checked ? T.accent : 'transparent',
                }}
              >
                {checked && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#0d0d12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="text-sm" style={{ color: checked ? T.muted : T.text, textDecoration: checked ? 'line-through' : 'none' }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* OK 버튼 */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4">
        <button
          onClick={() => setShowModal(true)}
          className="rounded-2xl px-10 py-4 text-base font-semibold shadow-lg transition-colors"
          style={{ background: T.accent, color: '#0d0d12' }}
        >
          OK
        </button>
      </div>

      {/* 확인 모달 */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl p-6 w-full max-w-xs text-center" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <p className="text-sm mb-6 whitespace-pre-line" style={{ color: T.text }}>
              {allChecked ? '모든 항목을 수행하였습니다.' : '미수행 항목이 있습니다.\n넘어가시겠습니까?'}
            </p>
            <div className={`flex gap-3 ${allChecked ? 'justify-center' : ''}`}>
              {!allChecked && (
                <button onClick={() => setShowModal(false)} className="flex-1 rounded-xl py-2.5 text-sm" style={{ border: `1px solid ${T.border}`, color: T.muted }}>
                  취소
                </button>
              )}
              <button
                onClick={() => navigate('/')}
                className={`rounded-xl py-2.5 text-sm font-medium ${allChecked ? 'px-10' : 'flex-1'}`}
                style={{ background: T.accent, color: '#0d0d12' }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
