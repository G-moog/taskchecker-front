import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { profileLabel } from '../lib/profile'
import { T } from '../theme'

interface Props {
  teamId: string
  /** 비어 있으면 전체 팀원 */
  selectedUserIds: string[]
  onChange: (userIds: string[]) => void
}

export function NotifyTargetPicker({ teamId, selectedUserIds, onChange }: Props) {
  const { user } = useAuth()
  const { members, loading } = useTeamMembers(teamId)
  // 저장된 값이 비어 있으면 '전체'로 시작한다
  const [manual, setManual] = useState(selectedUserIds.length > 0)

  const chooseAll = () => { setManual(false); onChange([]) }
  const chooseManual = () => {
    setManual(true)
    if (selectedUserIds.length === 0) onChange(members.map((m) => m.user_id))
  }

  const toggle = (userId: string) => {
    onChange(
      selectedUserIds.includes(userId)
        ? selectedUserIds.filter((u) => u !== userId)
        : [...selectedUserIds, userId],
    )
  }

  return (
    <div className="rounded-xl px-4 py-3 space-y-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
      <label className="block text-xs" style={{ color: T.muted }}>알림 대상</label>

      <div className="flex gap-2">
        {([[false, '전체 팀원'], [true, '직접 선택']] as [boolean, string][]).map(([value, label]) => (
          <button key={label} onClick={() => (value ? chooseManual() : chooseAll())}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{
              background: manual === value ? T.accentDim : T.surface2,
              color: manual === value ? T.accent : T.muted,
              border: `1px solid ${manual === value ? T.accentBorder : T.border}`,
            }}>
            {label}
          </button>
        ))}
      </div>

      {!manual ? (
        <p className="text-xs" style={{ color: T.muted }}>팀원 모두에게 알림이 갑니다.</p>
      ) : loading ? (
        <p className="text-xs" style={{ color: T.muted }}>팀원을 불러오는 중...</p>
      ) : (
        <>
          <div className="space-y-1.5">
            {members.map((m) => {
              const checked = selectedUserIds.includes(m.user_id)
              return (
                <button key={m.id} onClick={() => toggle(m.user_id)}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left"
                  style={{
                    background: checked ? T.accentDim : T.surface2,
                    border: `1px solid ${checked ? T.accentBorder : T.border}`,
                  }}>
                  <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                    style={{
                      border: `2px solid ${checked ? T.accent : T.muted}`,
                      background: checked ? T.accent : 'transparent',
                    }}>
                    {checked && (
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#0d0d12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="text-sm" style={{ color: checked ? T.text : T.muted }}>
                    {profileLabel(m.profile, m.user_id, user?.id)}
                  </span>
                  {m.role === 'admin' && (
                    <span className="text-xs ml-auto" style={{ color: T.muted }}>관리자</span>
                  )}
                </button>
              )
            })}
          </div>
          {selectedUserIds.length === 0 && (
            <p className="text-xs" style={{ color: T.warning }}>
              한 명도 선택하지 않으면 전체 팀원에게 알림이 갑니다.
            </p>
          )}
        </>
      )}
    </div>
  )
}
