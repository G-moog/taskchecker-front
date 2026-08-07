import { useNavigate } from 'react-router-dom'
import { useSheetTargets } from '../hooks/useSheetTargets'
import { T } from '../theme'
import type { OwnerType } from '../types/database'

interface Props {
  ownerType: OwnerType
  ownerId: string
  /** null이면 시트로 보내지 않음 */
  targetId: string | null
  /** 빈 값이면 defaultTabName을 쓴다 */
  tabName: string
  /** 탭 이름을 비웠을 때 실제로 쓰이는 이름 (양식/체크리스트 제목) */
  defaultTabName: string
  onChange: (targetId: string | null, tabName: string) => void
}

export function SheetTargetPicker({
  ownerType, ownerId, targetId, tabName, defaultTabName, onChange,
}: Props) {
  const navigate = useNavigate()
  const { targets, loading } = useSheetTargets(ownerType, ownerId)

  return (
    <div className="rounded-xl px-4 py-3 space-y-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
      <div className="flex items-center justify-between">
        <label className="block text-xs" style={{ color: T.muted }}>구글 시트 연동 (선택)</label>
        <button onClick={() => navigate('/sheets')} className="text-xs" style={{ color: T.accent }}>
          시트 관리
        </button>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: T.muted }}>불러오는 중...</p>
      ) : targets.length === 0 ? (
        <p className="text-sm" style={{ color: T.muted }}>
          등록된 시트가 없습니다. '시트 관리'에서 먼저 추가하세요.
        </p>
      ) : (
        <>
          <select
            value={targetId ?? ''}
            onChange={(e) => onChange(e.target.value || null, tabName)}
            className="w-full text-sm outline-none rounded-lg px-3 py-2"
            style={{ background: T.surface2, color: targetId ? T.text : T.muted, border: `1px solid ${T.border}` }}
          >
            <option value="">연동 안 함</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {targetId && (
            <div>
              <label className="block text-xs mb-1" style={{ color: T.muted }}>탭 이름</label>
              <input
                value={tabName}
                onChange={(e) => onChange(targetId, e.target.value)}
                placeholder={defaultTabName || '제목과 동일'}
                className="w-full text-sm outline-none rounded-lg px-3 py-2"
                style={{ background: T.surface2, color: T.text, border: `1px solid ${T.border}` }}
              />
              <p className="text-xs mt-1" style={{ color: T.muted }}>
                비워두면 제목({defaultTabName || '제목 없음'})을 탭 이름으로 씁니다. 없는 탭이면 새로 만듭니다.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
