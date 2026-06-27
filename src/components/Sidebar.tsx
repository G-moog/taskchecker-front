import { useLocation, useNavigate } from 'react-router-dom'
import { T } from '../theme'

const MENU = [
  { label: '홈', path: '/' },
  { label: '마이페이지', path: '/mypage' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: Props) {
  const navigate = useNavigate()
  const location = useLocation()

  const go = (path: string) => { navigate(path); onClose() }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose} />
      )}
      <div
        className="fixed top-0 left-0 h-full z-50"
        style={{
          width: 220,
          background: T.surface,
          borderRight: `1px solid ${T.border}`,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease',
        }}
      >
        <div className="px-4 pt-8 pb-6">
          <div className="mb-8 px-3">
            <span className="text-lg font-bold" style={{ color: T.accent }}>Task</span>
            <span className="text-lg font-bold" style={{ color: T.text }}>Checker</span>
          </div>
          <nav className="space-y-0.5">
            {MENU.map(({ label, path }) => {
              const active = location.pathname === path
              return (
                <button
                  key={path}
                  onClick={() => go(path)}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    color: active ? T.accent : T.muted,
                    background: active ? T.accentDim : 'transparent',
                    border: active ? `1px solid ${T.accentBorder}` : '1px solid transparent',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>
    </>
  )
}
