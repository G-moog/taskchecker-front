import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTeams } from '../hooks/useTeams'
import { useSheetTargets } from '../hooks/useSheetTargets'
import { extractSpreadsheetId } from '../lib/sheetSync'
import { T } from '../theme'
import type { OwnerType } from '../types/database'

export default function SheetTargetsPage() {
  const { user } = useAuth()
  const { teams } = useTeams(user?.id)
  const navigate = useNavigate()

  const [ownerType, setOwnerType] = useState<OwnerType>('personal')
  const [selectedTeamId, setSelectedTeamId] = useState('')

  const ownerId = ownerType === 'personal' ? user?.id : selectedTeamId
  const { targets, loading, createTarget, deleteTarget } = useSheetTargets(ownerType, ownerId)

  const [name, setName] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!user || !ownerId) return
    setError('')

    if (!name.trim()) { setError('시트 이름을 입력해주세요.'); return }

    const spreadsheetId = extractSpreadsheetId(urlInput)
    if (!spreadsheetId) {
      setError('구글 시트 주소를 확인해주세요. (https://docs.google.com/spreadsheets/d/... 형태)')
      return
    }

    setSaving(true)
    const { error: insertError } = await createTarget(name.trim(), spreadsheetId, user.id)
    setSaving(false)

    if (insertError) { setError('등록에 실패했습니다.'); return }
    setName('')
    setUrlInput('')
  }

  const needsTeam = ownerType === 'team' && !selectedTeamId

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <div className="px-4 py-3 flex items-center" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => navigate(-1)} className="text-sm mr-4" style={{ color: T.muted }}>← 뒤로</button>
        <h1 className="text-base font-semibold" style={{ color: T.text }}>구글 시트</h1>
      </div>

      {/* 개인 / 팀 */}
      <div className="flex" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        {(['personal', 'team'] as OwnerType[]).map((t) => (
          <button key={t} onClick={() => setOwnerType(t)}
            className="flex-1 py-3 text-sm font-medium transition-colors"
            style={{
              color: ownerType === t ? T.accent : T.muted,
              borderBottom: ownerType === t ? `2px solid ${T.accent}` : '2px solid transparent',
            }}>
            {t === 'personal' ? '개인' : '팀'}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">
        {ownerType === 'team' && (
          <div className="flex flex-wrap gap-2">
            {teams.length === 0 ? (
              <p className="text-sm" style={{ color: T.muted }}>소속된 팀이 없습니다</p>
            ) : teams.map((team) => (
              <button key={team.id} onClick={() => setSelectedTeamId(team.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: selectedTeamId === team.id ? T.accentDim : T.surface2,
                  color: selectedTeamId === team.id ? T.accent : T.muted,
                  border: `1px solid ${selectedTeamId === team.id ? T.accentBorder : T.border}`,
                }}>
                {team.name}
              </button>
            ))}
          </div>
        )}

        {needsTeam ? (
          <p className="text-center text-sm py-8" style={{ color: T.muted }}>팀을 선택해주세요</p>
        ) : (
          <>
            {/* 등록된 시트 */}
            <div className="rounded-xl overflow-hidden" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
              <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
                <span className="text-xs" style={{ color: T.muted }}>등록된 시트</span>
              </div>
              {loading ? (
                <p className="text-center text-sm py-6" style={{ color: T.muted }}>불러오는 중...</p>
              ) : targets.length === 0 ? (
                <p className="text-center text-sm py-6" style={{ color: T.muted }}>등록된 시트가 없습니다</p>
              ) : (
                targets.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3"
                    style={{ borderTop: `1px solid ${T.border}` }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: T.text }}>{t.name}</p>
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${t.spreadsheet_id}/edit`}
                        target="_blank" rel="noreferrer"
                        className="text-xs" style={{ color: T.muted }}>
                        시트 열기 ↗
                      </a>
                    </div>
                    <button onClick={() => deleteTarget(t.id)} style={{ color: T.muted }}
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
                ))
              )}
            </div>

            {/* 새 시트 등록 */}
            <div className="rounded-xl px-4 py-3 space-y-2" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
              <label className="block text-xs" style={{ color: T.muted }}>새 시트 등록</label>
              <input value={name} onChange={(e) => { setName(e.target.value); setError('') }}
                placeholder="시트 이름 (예: 2026 생육기록)"
                className="w-full text-sm outline-none rounded-lg px-3 py-2"
                style={{ background: T.surface2, color: T.text, border: `1px solid ${T.border}` }} />
              <input value={urlInput} onChange={(e) => { setUrlInput(e.target.value); setError('') }}
                placeholder="구글 시트 주소 붙여넣기"
                className="w-full text-sm outline-none rounded-lg px-3 py-2"
                style={{ background: T.surface2, color: T.text, border: `1px solid ${error ? T.danger : T.border}` }} />
              {error && <p className="text-xs" style={{ color: T.danger }}>{error}</p>}
              <button onClick={handleAdd} disabled={saving}
                className="w-full py-2.5 rounded-lg text-sm font-medium"
                style={{ background: T.accent, color: '#0d0d12', opacity: saving ? 0.4 : 1 }}>
                {saving ? '등록 중...' : '등록'}
              </button>
            </div>

            <p className="text-xs px-1 leading-relaxed" style={{ color: T.muted }}>
              등록한 시트는 Apps Script를 배포한 구글 계정이 편집할 수 있어야 합니다.
              다른 사람이 만든 시트라면 그 계정을 편집자로 공유해 두세요.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
