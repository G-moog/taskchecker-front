import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMeetingAgendas, type AgendaWithCount } from '../hooks/useMeetingAgendas'
import { DECISION_MODE_LABEL, RESPONSE_TYPE_LABEL } from '../lib/meeting'
import { T } from '../theme'
import type { AgendaDecisionMode, AgendaResponseType } from '../types/database'

export function MeetingTab({ teamId }: { teamId: string }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { agendas, loading, createAgenda, deleteAgenda } = useMeetingAgendas(teamId)
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="px-4 py-4 space-y-2 max-w-lg mx-auto pb-24">
      {loading ? (
        <p className="text-center text-sm py-8" style={{ color: T.muted }}>불러오는 중...</p>
      ) : agendas.length === 0 ? (
        <p className="text-center text-sm py-8" style={{ color: T.muted }}>제안된 안건이 없습니다</p>
      ) : (
        agendas.map((agenda) => (
          <AgendaCard
            key={agenda.id}
            agenda={agenda}
            isMine={agenda.created_by === user?.id}
            onPress={() => navigate(`/agenda/${agenda.id}`)}
            onDelete={() => deleteAgenda(agenda.id)}
          />
        ))
      )}

      <div className="fixed bottom-6 right-6">
        <button
          onClick={() => setShowForm(true)}
          className="rounded-full w-14 h-14 text-2xl shadow-lg flex items-center justify-center"
          style={{ background: T.accent, color: '#0d0d12' }}
        >
          +
        </button>
      </div>

      {showForm && user && (
        <NewAgendaSheet
          onClose={() => setShowForm(false)}
          onSubmit={async (title, body, responseType, decisionMode) => {
            const { error } = await createAgenda({
              team_id: teamId,
              title,
              body,
              response_type: responseType,
              decision_mode: decisionMode,
              created_by: user.id,
            })
            if (!error) setShowForm(false)
            return error
          }}
        />
      )}
    </div>
  )
}

function AgendaCard({
  agenda, isMine, onPress, onDelete,
}: {
  agenda: AgendaWithCount
  isMine: boolean
  onPress: () => void
  onDelete: () => void
}) {
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <>
      <div
        onClick={onPress}
        className="rounded-xl px-4 py-3 cursor-pointer transition-colors"
        style={{ background: T.surface, border: `1px solid ${T.border}` }}
        onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.borderColor = T.accentBorder)}
        onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.borderColor = T.border)}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium text-sm flex-1" style={{ color: T.text }}>{agenda.title}</span>
          {isMine && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowConfirm(true) }}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded"
              style={{ color: T.muted }}
              onMouseEnter={e => (e.currentTarget.style.color = T.danger)}
              onMouseLeave={e => (e.currentTarget.style.color = T.muted)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: T.accentDim, color: T.accent, border: `1px solid ${T.accentBorder}` }}>
            {RESPONSE_TYPE_LABEL[agenda.response_type]}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: T.surface2, color: T.muted, border: `1px solid ${T.border}` }}>
            {DECISION_MODE_LABEL[agenda.decision_mode]}
          </span>
          <span className="text-xs ml-auto" style={{ color: T.muted }}>의견 {agenda.responseCount}</span>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowConfirm(false)}>
          <div className="rounded-2xl p-6 w-full max-w-xs text-center"
            style={{ background: T.surface, border: `1px solid ${T.border}` }}
            onClick={e => e.stopPropagation()}>
            <p className="text-sm mb-1" style={{ color: T.text }}>안건을 삭제하시겠습니까?</p>
            <p className="text-xs mb-6" style={{ color: T.muted }}>제시된 의견이 함께 삭제됩니다.</p>
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

function NewAgendaSheet({
  onClose, onSubmit,
}: {
  onClose: () => void
  onSubmit: (
    title: string,
    body: string | null,
    responseType: AgendaResponseType,
    decisionMode: AgendaDecisionMode,
  ) => Promise<unknown>
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [responseType, setResponseType] = useState<AgendaResponseType>('vote')
  const [decisionMode, setDecisionMode] = useState<AgendaDecisionMode>('app')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    await onSubmit(title.trim(), body.trim() || null, responseType, decisionMode)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} />
      <div
        className="relative rounded-t-2xl px-4 pt-4 pb-8"
        style={{ background: T.surface, maxHeight: '85vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: T.border }} />
        <p className="text-sm font-semibold mb-4" style={{ color: T.text }}>안건 제안</p>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="안건 제목"
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none mb-2"
          style={{ background: T.surface2, color: T.text, border: `1px solid ${T.border}` }}
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="배경 설명 (선택)"
          rows={3}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none mb-4"
          style={{ background: T.surface2, color: T.text, border: `1px solid ${T.border}` }}
        />

        <p className="text-xs mb-2" style={{ color: T.muted }}>어떤 의견을 받을까요?</p>
        <div className="flex gap-2 mb-4">
          {([
            ['vote', '찬반 투표', '찬성 / 반대 / 기권 + 이유'],
            ['discussion', '서술형 의견', '찬반 없이 의견만'],
          ] as [AgendaResponseType, string, string][]).map(([key, label, desc]) => (
            <button
              key={key}
              onClick={() => setResponseType(key)}
              className="flex-1 px-3 py-2.5 rounded-lg text-left"
              style={{
                background: responseType === key ? T.accentDim : T.surface2,
                border: `1px solid ${responseType === key ? T.accentBorder : T.border}`,
              }}
            >
              <span className="block text-sm font-medium"
                style={{ color: responseType === key ? T.accent : T.text }}>{label}</span>
              <span className="block text-xs mt-0.5" style={{ color: T.muted }}>{desc}</span>
            </button>
          ))}
        </div>

        <p className="text-xs mb-2" style={{ color: T.muted }}>어떻게 마무리할까요?</p>
        <div className="flex gap-2 mb-5">
          {([
            ['app', '앱에서 종합', '모인 의견으로 마무리'],
            ['offline', '대면회의', '만나서 최종 결정'],
          ] as [AgendaDecisionMode, string, string][]).map(([key, label, desc]) => (
            <button
              key={key}
              onClick={() => setDecisionMode(key)}
              className="flex-1 px-3 py-2.5 rounded-lg text-left"
              style={{
                background: decisionMode === key ? T.accentDim : T.surface2,
                border: `1px solid ${decisionMode === key ? T.accentBorder : T.border}`,
              }}
            >
              <span className="block text-sm font-medium"
                style={{ color: decisionMode === key ? T.accent : T.text }}>{label}</span>
              <span className="block text-xs mt-0.5" style={{ color: T.muted }}>{desc}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!title.trim() || saving}
          className="w-full py-3 rounded-xl text-sm font-medium"
          style={{
            background: T.accent,
            color: '#0d0d12',
            opacity: !title.trim() || saving ? 0.4 : 1,
          }}
        >
          {saving ? '등록 중...' : '안건 등록'}
        </button>
      </div>
    </div>
  )
}
