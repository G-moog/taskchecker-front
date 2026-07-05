import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { T } from '../theme'
import type { MeasurementField, MeasurementForm } from '../types/database'

export default function MeasurementInputPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState<MeasurementForm | null>(null)
  const [fields, setFields] = useState<MeasurementField[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      const [{ data: f }, { data: flds }] = await Promise.all([
        supabase.from('measurement_forms').select('*').eq('id', id).single(),
        supabase.from('measurement_fields').select('*').eq('form_id', id).order('sort_order'),
      ])
      setForm(f)
      setFields(flds ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  const handleSave = async () => {
    if (!user || !form) return
    setSaving(true)

    const { data: entry, error } = await supabase
      .from('measurement_entries')
      .insert({ form_id: form.id, submitted_by: user.id })
      .select()
      .single()

    if (error || !entry) { setSaving(false); return }

    const inserts = fields
      .filter((f) => values[f.id] !== undefined && values[f.id] !== '')
      .map((f) => ({ entry_id: entry.id, field_id: f.id, value: values[f.id] }))

    if (inserts.length > 0) {
      await supabase.from('measurement_values').insert(inserts)
    }

    setSaving(false)
    navigate('/', {
      state: form.owner_type === 'team'
        ? { tab: 'team', teamId: form.owner_id, measurementTab: true }
        : { tab: 'personal', measurementTab: true },
    })
  }

  const goBack = () => {
    if (!form) { navigate('/'); return }
    navigate('/', {
      state: form.owner_type === 'team'
        ? { tab: 'team', teamId: form.owner_id, measurementTab: true }
        : { tab: 'personal', measurementTab: true },
    })
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-sm" style={{ background: T.bg, color: T.muted }}>불러오는 중...</div>
  if (!form) return <div className="flex items-center justify-center min-h-screen text-sm" style={{ background: T.bg, color: T.muted }}>양식을 찾을 수 없습니다</div>

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={goBack} className="text-sm" style={{ color: T.muted }}>취소</button>
        <h1 className="text-base font-semibold" style={{ color: T.text }}>{form.title}</h1>
        <button onClick={handleSave} disabled={saving} className="text-sm font-medium"
          style={{ color: saving ? T.muted : T.accent }}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div className="px-4 py-4 space-y-2 max-w-lg mx-auto">
        <p className="text-xs text-center pb-1" style={{ color: T.muted }}>
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <div className="rounded-xl overflow-hidden" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          {fields.map((field, idx) => (
            <div key={field.id}
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: idx < fields.length - 1 ? `1px solid ${T.border}` : undefined }}>
              <div className="flex-1 min-w-0">
                <span className="text-sm" style={{ color: T.text }}>{field.label}</span>
                {field.unit && <span className="text-xs ml-1" style={{ color: T.muted }}>({field.unit})</span>}
              </div>
              <input
                value={values[field.id] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                placeholder="값 입력"
                className="text-sm text-right outline-none bg-transparent w-28"
                style={{ color: T.accent }}
              />
            </div>
          ))}
        </div>

        {fields.length === 0 && (
          <p className="text-center text-sm py-8" style={{ color: T.muted }}>측정 항목이 없습니다</p>
        )}
      </div>
    </div>
  )
}
