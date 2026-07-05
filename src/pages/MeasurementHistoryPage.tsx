import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { T } from '../theme'
import type { MeasurementEntry, MeasurementField, MeasurementForm, MeasurementValue } from '../types/database'

type EntryWithValues = MeasurementEntry & { values: MeasurementValue[] }

export default function MeasurementHistoryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [form, setForm] = useState<MeasurementForm | null>(null)
  const [fields, setFields] = useState<MeasurementField[]>([])
  const [entries, setEntries] = useState<EntryWithValues[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      const [{ data: f }, { data: flds }, { data: ents }] = await Promise.all([
        supabase.from('measurement_forms').select('*').eq('id', id).single(),
        supabase.from('measurement_fields').select('*').eq('form_id', id).order('sort_order'),
        supabase.from('measurement_entries').select('*').eq('form_id', id).order('submitted_at', { ascending: false }),
      ])
      setForm(f)
      setFields(flds ?? [])

      if (ents && ents.length > 0) {
        const entryIds = ents.map((e) => e.id)
        const { data: vals } = await supabase
          .from('measurement_values')
          .select('*')
          .in('entry_id', entryIds)
        const valMap: Record<string, MeasurementValue[]> = {}
        for (const v of vals ?? []) {
          if (!valMap[v.entry_id]) valMap[v.entry_id] = []
          valMap[v.entry_id].push(v)
        }
        setEntries(ents.map((e) => ({ ...e, values: valMap[e.id] ?? [] })))
      } else {
        setEntries([])
      }
      setLoading(false)
    }
    load()
  }, [id])

  const handleDelete = async (entryId: string) => {
    setDeletingId(entryId)
    await supabase.from('measurement_entries').delete().eq('id', entryId)
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
    setDeletingId(null)
  }

  const handleExport = () => {
    if (!form || fields.length === 0) return

    const headers = ['제출일시', ...fields.map((f) => f.unit ? `${f.label}(${f.unit})` : f.label)]
    const rows = entries.map((entry) => {
      const date = new Date(entry.submitted_at).toLocaleString('ko-KR')
      const vals = fields.map((f) => {
        const v = entry.values.find((v) => v.field_id === f.id)
        return v?.value ?? ''
      })
      return [date, ...vals]
    })

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    // 열 너비 자동 설정
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length * 2, 12) }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '측정기록')
    XLSX.writeFile(wb, `${form.title}_측정기록.xlsx`)
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
        <button onClick={goBack} className="text-sm" style={{ color: T.muted }}>← 뒤로</button>
        <h1 className="text-base font-semibold truncate mx-2" style={{ color: T.text }}>{form.title} 기록</h1>
        <button onClick={handleExport} disabled={entries.length === 0}
          className="text-sm font-medium px-3 py-1 rounded-lg"
          style={{
            background: entries.length === 0 ? T.surface2 : T.accentDim,
            color: entries.length === 0 ? T.muted : T.accent,
            border: `1px solid ${entries.length === 0 ? T.border : T.accentBorder}`,
          }}>
          Excel
        </button>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto">
        {entries.length === 0 ? (
          <p className="text-center text-sm py-12" style={{ color: T.muted }}>아직 기록이 없습니다</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-xl overflow-hidden"
                style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                <div className="px-4 py-2.5 flex items-center justify-between"
                  style={{ borderBottom: `1px solid ${T.border}`, background: T.surface2 }}>
                  <span className="text-xs font-medium" style={{ color: T.muted }}>
                    {new Date(entry.submitted_at).toLocaleString('ko-KR', {
                      year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={deletingId === entry.id}
                    className="text-xs"
                    style={{ color: T.muted }}
                    onMouseEnter={e => (e.currentTarget.style.color = T.danger)}
                    onMouseLeave={e => (e.currentTarget.style.color = T.muted)}
                  >
                    삭제
                  </button>
                </div>
                {fields.map((field, idx) => {
                  const val = entry.values.find((v) => v.field_id === field.id)
                  return (
                    <div key={field.id}
                      className="flex items-center justify-between px-4 py-2.5"
                      style={{ borderBottom: idx < fields.length - 1 ? `1px solid ${T.border}` : undefined }}>
                      <span className="text-sm" style={{ color: T.muted }}>
                        {field.label}{field.unit && ` (${field.unit})`}
                      </span>
                      <span className="text-sm font-medium" style={{ color: val?.value ? T.text : T.muted }}>
                        {val?.value ?? '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
