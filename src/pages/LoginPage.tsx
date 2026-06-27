import { useAuth } from '../hooks/useAuth'
import { T } from '../theme'

export default function LoginPage() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: T.bg }}>
      <div className="rounded-2xl p-10 w-full max-w-sm text-center" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
        <div className="mb-2">
          <span className="text-3xl font-bold" style={{ color: T.accent }}>Task</span>
          <span className="text-3xl font-bold" style={{ color: T.text }}>Checker</span>
        </div>
        <p className="text-sm mb-8" style={{ color: T.muted }}>개인 및 팀 체크리스트 앱</p>
        <button
          onClick={() => signInWithGoogle()}
          className="w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors"
          style={{ border: `1px solid ${T.border}`, background: T.surface2, color: T.text }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = T.accentBorder)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />
          Google로 계속하기
        </button>
      </div>
    </div>
  )
}
