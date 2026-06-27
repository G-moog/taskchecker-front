import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTeams } from '../hooks/useTeams'
import { useChecklists } from '../hooks/useChecklists'
import { Sidebar } from '../components/Sidebar'
import { T } from '../theme'
import type { Checklist } from '../types/database'

type Tab = 'personal' | 'team'

export default function HomePage() {
  const { user, signOut } = useAuth()
  const { teams, createTeam } = useTeams(user?.id)
  const [tab, setTab] = useState<Tab>('personal')
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [showTeamDropdown, setShowTeamDropdown] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  const ownerId = tab === 'personal' ? user?.id : selectedTeamId
  const { checklists, loading, deleteChecklist } = useChecklists(ownerId, tab)
  const selectedTeam = teams.find((t) => t.id === selectedTeamId)

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return
    const { data } = await createTeam(newTeamName.trim())
    if (data) { setSelectedTeamId(data.id); setTab('team') }
    setNewTeamName('')
    setShowTeamDropdown(false)
  }

  const handleNewChecklist = async () => {
    if (!user) return
    navigate(`/checklist/new/edit?ownerType=${tab}&ownerId=${ownerId}`)
  }

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* 헤더 */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-lg" style={{ color: T.muted }}>☰</button>
          <div>
            <span className="text-lg font-bold" style={{ color: T.accent }}>Task</span>
            <span className="text-lg font-bold" style={{ color: T.text }}>Checker</span>
          </div>
        </div>
        <button onClick={() => signOut()} className="text-sm" style={{ color: T.muted }}>로그아웃</button>
      </div>

      {/* 팀 드롭다운 */}
      {tab === 'team' && (
        <div className="px-4 py-2 relative" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
          <button
            onClick={() => setShowTeamDropdown(!showTeamDropdown)}
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: T.text }}
          >
            <span>{selectedTeam?.name ?? '팀을 선택하세요'}</span>
            <span style={{ color: T.muted }}>▾</span>
          </button>
          {showTeamDropdown && (
            <div className="absolute top-full left-0 right-0 z-10 shadow-2xl" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => { setSelectedTeamId(team.id); setShowTeamDropdown(false) }}
                  className="w-full text-left px-4 py-3 text-sm transition-colors"
                  style={{ color: T.text }}
                  onMouseEnter={e => (e.currentTarget.style.background = T.surface2)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {team.name}
                </button>
              ))}
              <div style={{ borderTop: `1px solid ${T.border}` }}>
                <button
                  onClick={() => { navigate('/join-team'); setShowTeamDropdown(false) }}
                  className="w-full text-left px-4 py-3 text-sm"
                  style={{ color: T.accent }}
                >
                  + 코드로 합류
                </button>
                <div className="px-4 py-2 flex gap-2">
                  <input
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="새 팀 이름"
                    className="flex-1 rounded px-2 py-1 text-sm outline-none"
                    style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text }}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
                  />
                  <button onClick={handleCreateTeam} className="text-sm font-medium" style={{ color: T.accent }}>만들기</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 탭 */}
      <div className="flex" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        {(['personal', 'team'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-3 text-sm font-medium transition-colors"
            style={{
              color: tab === t ? T.accent : T.muted,
              borderBottom: tab === t ? `2px solid ${T.accent}` : '2px solid transparent',
            }}
          >
            {t === 'personal' ? '개인' : '팀'}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="px-4 py-4 space-y-2 max-w-lg mx-auto">
        {loading ? (
          <p className="text-center text-sm py-8" style={{ color: T.muted }}>불러오는 중...</p>
        ) : tab === 'team' && !selectedTeamId ? (
          <p className="text-center text-sm py-8" style={{ color: T.muted }}>팀을 선택해주세요</p>
        ) : checklists.length === 0 ? (
          <p className="text-center text-sm py-8" style={{ color: T.muted }}>체크리스트가 없습니다</p>
        ) : (
          checklists.map((cl) => (
            <ChecklistCard
              key={cl.id}
              checklist={cl}
              onPress={() => navigate(`/checklist/${cl.id}`)}
              onDelete={() => deleteChecklist(cl.id)}
            />
          ))
        )}
      </div>

      {/* + 버튼 */}
      {(tab === 'personal' || selectedTeamId) && (
        <div className="fixed bottom-6 right-6">
          <button
            onClick={handleNewChecklist}
            className="rounded-full w-14 h-14 text-2xl shadow-lg flex items-center justify-center transition-colors"
            style={{ background: T.accent, color: '#0d0d12' }}
          >
            +
          </button>
        </div>
      )}
    </div>
  )
}

function ChecklistCard({ checklist, onPress, onDelete }: { checklist: Checklist; onPress: () => void; onDelete: () => void }) {
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); setShowConfirm(true) }
  const confirmDelete = (e: React.MouseEvent) => { e.stopPropagation(); onDelete(); setShowConfirm(false) }
  const cancelDelete = (e: React.MouseEvent) => { e.stopPropagation(); setShowConfirm(false) }

  return (
    <>
      <div
        onClick={onPress}
        className="rounded-xl px-4 py-3 cursor-pointer transition-colors"
        style={{ background: T.surface, border: `1px solid ${T.border}` }}
        onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.borderColor = T.accentBorder)}
        onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.borderColor = T.border)}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm flex-1 truncate" style={{ color: T.text }}>{checklist.title}</span>
          <span className="text-xs flex-shrink-0" style={{ color: T.muted }}>
            {checklist.repeat_type === 'daily' ? '매일' : checklist.repeat_type === 'weekly' ? '주간' : '단발성'}
          </span>
          <button
            onClick={handleDelete}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors"
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
        </div>
        {checklist.notify_time && (
          <p className="text-xs mt-1" style={{ color: T.muted }}>알림 {checklist.notify_time.slice(0, 5)}</p>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={cancelDelete}>
          <div className="rounded-2xl p-6 w-full max-w-xs text-center" style={{ background: T.surface, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
            <p className="text-sm mb-1" style={{ color: T.text }}>체크리스트를 삭제하시겠습니까?</p>
            <p className="text-xs mb-6" style={{ color: T.muted }}>모든 항목과 기록이 함께 삭제됩니다.</p>
            <div className="flex gap-3">
              <button onClick={cancelDelete} className="flex-1 rounded-xl py-2.5 text-sm" style={{ border: `1px solid ${T.border}`, color: T.muted }}>취소</button>
              <button onClick={confirmDelete} className="flex-1 rounded-xl py-2.5 text-sm font-medium" style={{ background: T.dangerDim, color: T.danger, border: `1px solid ${T.dangerBorder}` }}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
