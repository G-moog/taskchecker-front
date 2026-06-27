import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { T } from '../theme'

const ERROR_MESSAGES: Record<number, string> = {
  400: '', 401: '인증 문제가 발생했습니다. 다시 로그인해 주세요.',
  404: '유효하지 않은 코드입니다.', 409: '이미 가입된 팀입니다.',
  500: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
}

interface PreviewResult { team_id: string; team_name: string }

export default function JoinTeamPage() {
  const [code, setCode] = useState('')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const callEdgeFunction = async (payload: object) => {
    const { data: { session } } = await supabase.auth.getSession()
    return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/join-team-by-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(payload),
    })
  }

  const handlePreview = async () => {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length !== 6) { setError({ status: 0, message: '6자리 코드를 입력해주세요.' }); return }
    setLoading(true); setError(null)
    try {
      const res = await callEdgeFunction({ code: trimmed, preview: true })
      if (res.ok) { setPreview(await res.json()) }
      else {
        const body = await res.json().catch(() => ({}))
        const msg = res.status === 400 ? (body.error ?? body.message ?? '폐기되었거나 만료된 코드입니다.') : (ERROR_MESSAGES[res.status] ?? '오류가 발생했습니다.')
        setError({ status: res.status, message: msg })
      }
    } catch { setError({ status: 500, message: '네트워크 오류가 발생했습니다.' }) }
    setLoading(false)
  }

  const handleConfirm = async () => {
    if (!preview) return
    setLoading(true); setError(null)
    try {
      const res = await callEdgeFunction({ code: code.trim().toUpperCase() })
      if (res.ok) { navigate('/', { replace: true }) }
      else {
        const body = await res.json().catch(() => ({}))
        const msg = res.status === 400 ? (body.error ?? body.message ?? '오류가 발생했습니다.') : (ERROR_MESSAGES[res.status] ?? '오류가 발생했습니다.')
        setError({ status: res.status, message: msg }); setPreview(null)
      }
    } catch { setError({ status: 500, message: '네트워크 오류가 발생했습니다.' }) }
    setLoading(false)
  }

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <div className="px-4 py-3 flex items-center" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => navigate(-1)} className="text-sm mr-4" style={{ color: T.muted }}>← 뒤로</button>
        <h1 className="text-base font-semibold" style={{ color: T.text }}>팀 합류</h1>
      </div>

      <div className="px-4 py-8 max-w-sm mx-auto space-y-4">
        <div className="rounded-xl p-4" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <label className="block text-xs mb-2" style={{ color: T.muted }}>초대 코드 (6자리)</label>
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setPreview(null); setError(null) }}
            maxLength={6} placeholder="ABCDEF"
            className="w-full text-2xl font-mono text-center tracking-widest outline-none bg-transparent py-2"
            style={{ color: T.accent }}
          />
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: T.dangerDim, border: `1px solid ${T.dangerBorder}`, color: T.danger }}>
            {error.message}
            {error.status === 500 && <button onClick={handlePreview} className="ml-2 underline">재시도</button>}
          </div>
        )}

        <button onClick={handlePreview} disabled={loading || code.length !== 6}
          className="w-full rounded-xl py-3 text-sm font-medium transition-colors disabled:opacity-40"
          style={{ background: T.accent, color: '#0d0d12' }}>
          {loading ? '확인 중...' : '코드 확인'}
        </button>
      </div>

      {preview && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl p-6 w-full max-w-xs text-center" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <h2 className="text-lg font-bold mb-1" style={{ color: T.accent }}>{preview.team_name}</h2>
            <p className="text-sm mb-6" style={{ color: T.muted }}>이 팀에 합류하시겠습니까?</p>
            <div className="flex gap-3">
              <button onClick={() => setPreview(null)} className="flex-1 rounded-xl py-2.5 text-sm" style={{ border: `1px solid ${T.border}`, color: T.muted }}>취소</button>
              <button onClick={handleConfirm} disabled={loading}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium disabled:opacity-40"
                style={{ background: T.accent, color: '#0d0d12' }}>
                {loading ? '처리 중...' : '합류'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
