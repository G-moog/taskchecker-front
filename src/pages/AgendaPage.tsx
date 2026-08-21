import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAgendaDetail } from '../hooks/useAgendaDetail'
import { DECISION_MODE_LABEL, RESPONSE_TYPE_LABEL, STANCE_LABEL } from '../lib/meeting'
import { useProfiles } from '../hooks/useProfiles'
import { profileLabel } from '../lib/profile'
import { T } from '../theme'
import type { AgendaStance, MeetingResponse, Profile } from '../types/database'

const STANCE_COLOR: Record<AgendaStance, string> = {
  for: T.success,
  against: T.danger,
  abstain: T.muted,
}


export default function AgendaPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { agenda, responses, loading, submitResponse, deleteResponse } = useAgendaDetail(id)

  const profiles = useProfiles([agenda?.created_by, ...responses.map((r) => r.user_id)])
  const myResponse = responses.find((r) => r.user_id === user?.id) ?? null

  const [stance, setStance] = useState<AgendaStance | null>(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  // 서버에서 내 의견을 불러온 뒤 폼에 반영
  useEffect(() => {
    setStance(myResponse?.stance ?? null)
    setComment(myResponse?.comment ?? '')
  }, [myResponse?.id, myResponse?.stance, myResponse?.comment])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm"
        style={{ background: T.bg, color: T.muted }}>불러오는 중...</div>
    )
  }

  if (!agenda) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm"
        style={{ background: T.bg, color: T.muted }}>안건을 찾을 수 없습니다</div>
    )
  }

  const isVote = agenda.response_type === 'vote'
  const canSubmit = isVote ? stance !== null : comment.trim().length > 0

  const handleSubmit = async () => {
    if (!user || !canSubmit || saving) return
    setSaving(true)
    await submitResponse(user.id, isVote ? stance : null, comment.trim() || null)
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!user || saving) return
    setSaving(true)
    await deleteResponse(user.id)
    setStance(null)
    setComment('')
    setSaving(false)
  }

  const tally: Record<AgendaStance, number> = { for: 0, against: 0, abstain: 0 }
  for (const r of responses) {
    if (r.stance) tally[r.stance] += 1
  }
  const totalVotes = tally.for + tally.against + tally.abstain

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      {/* 헤더 */}
      <div className="px-4 py-3 flex items-center" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => navigate(-1)} className="text-sm mr-4" style={{ color: T.muted }}>← 뒤로</button>
        <h1 className="text-base font-semibold" style={{ color: T.text }}>안건</h1>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto pb-12">
        {/* 안건 내용 */}
        <div className="rounded-xl px-4 py-4" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <p className="text-base font-semibold mb-2" style={{ color: T.text }}>{agenda.title}</p>
          {agenda.body && (
            <p className="text-sm whitespace-pre-line mb-3" style={{ color: T.muted }}>{agenda.body}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: T.accentDim, color: T.accent, border: `1px solid ${T.accentBorder}` }}>
              {RESPONSE_TYPE_LABEL[agenda.response_type]}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: T.surface2, color: T.muted, border: `1px solid ${T.border}` }}>
              {DECISION_MODE_LABEL[agenda.decision_mode]}
            </span>
          </div>
          <p className="text-xs mt-3" style={{ color: T.muted }}>
            {profileLabel(profiles[agenda.created_by], agenda.created_by, user?.id)} · {new Date(agenda.created_at).toLocaleDateString('ko-KR')}
          </p>
        </div>

        {/* 찬반 집계 */}
        {isVote && (
          <div className="rounded-xl px-4 py-4" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <p className="text-xs mb-3" style={{ color: T.muted }}>집계 ({totalVotes}명 응답)</p>
            {totalVotes === 0 ? (
              <p className="text-sm text-center py-2" style={{ color: T.muted }}>아직 응답이 없습니다</p>
            ) : (
              <>
                <div className="flex h-2 rounded-full overflow-hidden mb-3" style={{ background: T.surface2 }}>
                  {(['for', 'against', 'abstain'] as AgendaStance[]).map((s) => (
                    tally[s] > 0 && (
                      <div key={s} style={{ width: `${(tally[s] / totalVotes) * 100}%`, background: STANCE_COLOR[s] }} />
                    )
                  ))}
                </div>
                <div className="flex gap-4">
                  {(['for', 'against', 'abstain'] as AgendaStance[]).map((s) => (
                    <div key={s} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STANCE_COLOR[s] }} />
                      <span className="text-xs" style={{ color: T.muted }}>{STANCE_LABEL[s]} {tally[s]}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* 내 의견 */}
        <div className="rounded-xl px-4 py-4" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs" style={{ color: T.muted }}>{myResponse ? '내 의견 (수정 가능)' : '의견 제시'}</p>
            {myResponse && (
              <button onClick={handleDelete} disabled={saving} className="text-xs disabled:opacity-40" style={{ color: T.danger }}>
                의견 삭제
              </button>
            )}
          </div>

          {isVote && (
            <div className="flex gap-2 mb-3">
              {(['for', 'against', 'abstain'] as AgendaStance[]).map((s) => {
                const selected = stance === s
                return (
                  <button
                    key={s}
                    onClick={() => setStance(s)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium"
                    style={{
                      background: selected ? STANCE_COLOR[s] : T.surface2,
                      color: selected ? '#0d0d12' : T.muted,
                      border: `1px solid ${selected ? STANCE_COLOR[s] : T.border}`,
                    }}
                  >
                    {STANCE_LABEL[s]}
                  </button>
                )
              })}
            </div>
          )}

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={isVote ? '이유 (선택)' : '의견을 입력하세요'}
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none mb-3"
            style={{ background: T.surface2, color: T.text, border: `1px solid ${T.border}` }}
          />

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="w-full py-3 rounded-xl text-sm font-medium"
            style={{ background: T.accent, color: '#0d0d12', opacity: !canSubmit || saving ? 0.4 : 1 }}
          >
            {saving ? '저장 중...' : myResponse ? '의견 수정' : '의견 등록'}
          </button>
        </div>

        {/* 의견 목록 */}
        <div>
          <p className="text-xs mb-2" style={{ color: T.muted }}>제시된 의견 ({responses.length})</p>
          {responses.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: T.muted }}>아직 제시된 의견이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {responses.map((r) => (
                <ResponseCard key={r.id} response={r} myUserId={user?.id} profiles={profiles} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ResponseCard({ response, myUserId, profiles }: {
  response: MeetingResponse
  myUserId: string | undefined
  profiles: Record<string, Profile>
}) {
  const isMine = response.user_id === myUserId

  return (
    <div className="rounded-xl px-4 py-3"
      style={{
        background: isMine ? T.accentDim : T.surface,
        border: `1px solid ${isMine ? T.accentBorder : T.border}`,
      }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium" style={{ color: isMine ? T.accent : T.text }}>
          {profileLabel(profiles[response.user_id], response.user_id, myUserId)}
        </span>
        {response.stance && (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ color: STANCE_COLOR[response.stance], border: `1px solid ${STANCE_COLOR[response.stance]}` }}>
            {STANCE_LABEL[response.stance]}
          </span>
        )}
        <span className="text-xs ml-auto" style={{ color: T.muted }}>
          {new Date(response.created_at).toLocaleDateString('ko-KR')}
        </span>
      </div>
      {response.comment ? (
        <p className="text-sm whitespace-pre-line" style={{ color: T.text }}>{response.comment}</p>
      ) : (
        <p className="text-sm" style={{ color: T.muted }}>이유 없음</p>
      )}
    </div>
  )
}
