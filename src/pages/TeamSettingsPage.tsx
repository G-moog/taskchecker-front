import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTeams } from '../hooks/useTeams'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { profileLabel } from '../lib/profile'
import { T } from '../theme'
import type { TeamInviteCode } from '../types/database'

export default function TeamSettingsPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const { user } = useAuth()
  const { teams } = useTeams(user?.id)
  const navigate = useNavigate()

  const { members } = useTeamMembers(teamId)
  const [activeCode, setActiveCode] = useState<TeamInviteCode | null>(null)
  const [loading, setLoading] = useState(true)
  const [codeLoading, setCodeLoading] = useState(false)

  const myRole = teams.find((t) => t.id === teamId)?.role
  const isAdmin = myRole === 'admin'
  const teamName = teams.find((t) => t.id === teamId)?.name ?? '팀 설정'

  useEffect(() => {
    if (!teamId) return
    const run = async () => {
      setLoading(true)
      const codesRes = await supabase
        .from('team_invite_codes').select('*').eq('team_id', teamId)
        .is('revoked_at', null).order('created_at', { ascending: false }).limit(1)
      if (codesRes.data?.[0]) {
        const code = codesRes.data[0]
        if (!code.expires_at || new Date(code.expires_at) > new Date()) setActiveCode(code)
      }
      setLoading(false)
    }
    run()
  }, [teamId])

  const handleGenerateCode = async () => {
    if (!teamId || !user) return
    setCodeLoading(true)
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase.from('team_invite_codes').insert({ team_id: teamId, code, created_by: user.id, expires_at: expiresAt }).select().single()
    if (!error && data) setActiveCode(data)
    setCodeLoading(false)
  }

  const handleDeleteTeam = async () => {
    if (!teamId || !isAdmin) return
    if (!window.confirm(`"${teamName}" 팀을 삭제하시겠습니까?\n팀원 및 초대 코드가 모두 삭제됩니다.`)) return
    await supabase.from('teams').delete().eq('id', teamId)
    navigate('/', { state: { tab: 'team' } })
  }

  const handleRevokeCode = async () => {
    if (!activeCode) return
    setCodeLoading(true)
    await supabase.from('team_invite_codes').update({ revoked_at: new Date().toISOString() }).eq('id', activeCode.id)
    setActiveCode(null)
    setCodeLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-sm" style={{ background: T.bg, color: T.muted }}>불러오는 중...</div>

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <div className="px-4 py-3 flex items-center" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => navigate(-1)} className="text-sm mr-4" style={{ color: T.muted }}>← 뒤로</button>
        <h1 className="text-base font-semibold" style={{ color: T.text }}>{teamName}</h1>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* 초대 코드 */}
        <div className="rounded-xl p-4" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <h2 className="text-xs mb-3" style={{ color: T.muted }}>초대 코드</h2>
          {activeCode ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: T.surface2, border: `1px solid ${T.border}` }}>
                <span className="text-2xl font-mono font-bold tracking-widest" style={{ color: T.accent }}>{activeCode.code}</span>
                <button onClick={() => navigator.clipboard.writeText(activeCode.code)} className="text-sm" style={{ color: T.muted }}>복사</button>
              </div>
              {activeCode.expires_at && (
                <p className="text-xs" style={{ color: T.muted }}>만료: {new Date(activeCode.expires_at).toLocaleDateString('ko-KR')}</p>
              )}
              {isAdmin && (
                <button onClick={handleRevokeCode} disabled={codeLoading} className="text-sm disabled:opacity-40" style={{ color: T.danger }}>
                  코드 폐기
                </button>
              )}
            </div>
          ) : (
            <button onClick={handleGenerateCode} disabled={codeLoading}
              className="w-full rounded-xl py-3 text-sm disabled:opacity-40 transition-colors"
              style={{ border: `1px dashed ${T.accentBorder}`, color: T.accent }}>
              {codeLoading ? '생성 중...' : '새 초대 코드 생성'}
            </button>
          )}
        </div>

        {/* 팀 삭제 */}
        {isAdmin && (
          <div className="rounded-xl p-4" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <h2 className="text-xs mb-3" style={{ color: T.muted }}>위험 구역</h2>
            <button
              onClick={handleDeleteTeam}
              className="w-full py-2.5 rounded-lg text-sm font-medium"
              style={{ background: 'transparent', color: T.danger, border: `1px solid ${T.danger}` }}
            >
              팀 삭제
            </button>
          </div>
        )}

        {/* 멤버 */}
        <div className="rounded-xl overflow-hidden" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
            <span className="text-xs" style={{ color: T.muted }}>멤버 ({members.length}명)</span>
          </div>
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
              <span className="text-sm" style={{ color: T.text }}>{profileLabel(m.profile, m.user_id, user?.id)}</span>
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: m.role === 'admin' ? T.accentDim : T.surface2,
                  color: m.role === 'admin' ? T.accent : T.muted,
                  border: `1px solid ${m.role === 'admin' ? T.accentBorder : T.border}`,
                }}>
                {m.role === 'admin' ? '관리자' : '멤버'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
