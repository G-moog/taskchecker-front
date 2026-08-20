import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { SheetTargetPicker } from '../components/SheetTargetPicker'
import { ExcelItemsCard, type ExcelPreview } from '../components/ExcelItemsCard'
import { diffByLabel, downloadMeasurementFields, parseMeasurementFields, type MeasurementFieldRow } from '../lib/excelItems'
import { T } from '../theme'
import type { MeasurementField } from '../types/database'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

type LocalField = MeasurementField & { isTemp?: boolean }

/** 아직 DB에 없는 항목 */
function isNewField(f: LocalField) {
  return f.isTemp === true || f.id.startsWith('temp-')
}

export default function MeasurementEditPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const isNew = !id || id === 'new'
  const ownerType = searchParams.get('ownerType') as 'personal' | 'team' | null
  const ownerId = searchParams.get('ownerId') ?? ''

  const [title, setTitle] = useState('')
  const [notifyWeekday, setNotifyWeekday] = useState<number | null>(null)
  const [notifyTime, setNotifyTime] = useState('')
  const [fields, setFields] = useState<LocalField[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [sheetTargetId, setSheetTargetId] = useState<string | null>(null)
  const [sheetTabName, setSheetTabName] = useState('')
  const [excelRows, setExcelRows] = useState<MeasurementFieldRow[] | null>(null)
  const [excelPreview, setExcelPreview] = useState<ExcelPreview | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!isNew)

  const sensors = useSensors(useSensor(PointerSensor))

  useEffect(() => {
    if (isNew || !id) return
    const load = async () => {
      const [{ data: form }, { data: flds }] = await Promise.all([
        supabase.from('measurement_forms').select('*').eq('id', id).single(),
        supabase.from('measurement_fields').select('*').eq('form_id', id).order('sort_order'),
      ])
      if (form) {
        setTitle(form.title)
        setNotifyWeekday(form.notify_weekday)
        setNotifyTime(form.notify_time ?? '')
        setSheetTargetId(form.sheet_target_id ?? null)
        setSheetTabName(form.sheet_tab_name ?? '')
      }
      setFields(flds ?? [])
      setLoading(false)
    }
    load()
  }, [id, isNew])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIdx = fields.findIndex((f) => f.id === active.id)
      const newIdx = fields.findIndex((f) => f.id === over.id)
      setFields(arrayMove(fields, oldIdx, newIdx))
    }
  }

  const handleAddField = () => {
    if (!newLabel.trim()) return
    const temp: LocalField = {
      id: `temp-${Date.now()}`,
      form_id: id ?? '',
      label: newLabel.trim(),
      unit: newUnit.trim() || null,
      sort_order: fields.length,
      isTemp: true,
    }
    setFields((prev) => [...prev, temp])
    setNewLabel('')
    setNewUnit('')
  }

  const handleDeleteField = (fieldId: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId))
  }

  const effectiveOwnerType = ownerType ?? 'personal'
  const effectiveOwnerId = ownerId

  const handleSave = async () => {
    if (!title.trim() || !user) return
    setSaving(true)

    let formId = id

    if (isNew) {
      const { data, error } = await supabase
        .from('measurement_forms')
        .insert({
          title: title.trim(),
          owner_type: effectiveOwnerType,
          owner_id: effectiveOwnerId,
          notify_weekday: notifyWeekday,
          notify_time: notifyTime || null,
          sheet_target_id: sheetTargetId,
          sheet_tab_name: sheetTabName.trim() || null,
          created_by: user.id,
        })
        .select()
        .single()
      if (error || !data) { setSaving(false); return }
      formId = data.id
      if (fields.length > 0) {
        await supabase.from('measurement_fields').insert(
          fields.map((f, idx) => ({
            form_id: formId!,
            label: f.label,
            unit: f.unit,
            sort_order: idx,
          }))
        )
      }
    } else {
      await supabase.from('measurement_forms').update({
        title: title.trim(),
        notify_weekday: notifyWeekday,
        notify_time: notifyTime || null,
        sheet_target_id: sheetTargetId,
        sheet_tab_name: sheetTabName.trim() || null,
      }).eq('id', id!)

      // 항목을 전부 지우고 다시 넣으면 measurement_values.field_id가 끊어져
      // 과거 기록을 못 읽게 된다. 남아 있는 항목은 id를 유지한 채 갱신한다.
      const keptIds = new Set(fields.filter((f) => !isNewField(f)).map((f) => f.id))
      const { data: current } = await supabase
        .from('measurement_fields')
        .select('id')
        .eq('form_id', id!)
      const removedIds = (current ?? [])
        .map((c) => c.id)
        .filter((currentId) => !keptIds.has(currentId))

      if (removedIds.length > 0) {
        await supabase.from('measurement_fields').delete().in('id', removedIds)
      }

      for (let idx = 0; idx < fields.length; idx++) {
        const field = fields[idx]
        if (isNewField(field)) {
          await supabase.from('measurement_fields').insert({
            form_id: id!, label: field.label, unit: field.unit, sort_order: idx,
          })
        } else {
          await supabase.from('measurement_fields').update({
            label: field.label, unit: field.unit, sort_order: idx,
          }).eq('id', field.id)
        }
      }
    }

    setSaving(false)
    navigate('/', {
      state: effectiveOwnerType === 'team'
        ? { tab: 'team', teamId: effectiveOwnerId, measurementTab: true }
        : { tab: 'personal', measurementTab: true },
    })
  }

  const handleExcelDownload = () => {
    downloadMeasurementFields(title.trim(), fields)
  }

  const handleExcelFile = async (file: File) => {
    const { rows, errors } = await parseMeasurementFields(file)
    const diff = diffByLabel(rows, fields, (incoming, existing) =>
      (incoming.unit ?? null) === (existing.unit ?? null),
    )
    setExcelRows(rows)
    setExcelPreview({ ...diff, errors })
  }

  // 항목명이 같으면 기존 id를 유지해 과거 기록과의 연결을 지킨다.
  // 실제 반영은 저장 버튼을 눌러야 일어난다.
  const handleExcelApply = () => {
    if (!excelRows) return
    const byLabel = new Map(fields.map((f) => [f.label, f]))
    setFields(excelRows.map((r, idx) => {
      const prev = byLabel.get(r.label)
      return prev
        ? { ...prev, unit: r.unit, sort_order: idx }
        : {
            id: `temp-${Date.now()}-${idx}`,
            form_id: id ?? '',
            label: r.label,
            unit: r.unit,
            sort_order: idx,
            isTemp: true,
          }
    }))
    setExcelPreview(null)
    setExcelRows(null)
  }

  const goBack = () =>
    navigate('/', {
      state: effectiveOwnerType === 'team'
        ? { tab: 'team', teamId: effectiveOwnerId, measurementTab: true }
        : { tab: 'personal', measurementTab: true },
    })

  if (!isNew && loading) {
    return <div className="flex items-center justify-center min-h-screen text-sm" style={{ background: T.bg, color: T.muted }}>불러오는 중...</div>
  }

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={goBack} className="text-sm" style={{ color: T.muted }}>취소</button>
        <h1 className="text-base font-semibold" style={{ color: T.text }}>{isNew ? '새 측정 양식' : '측정 양식 편집'}</h1>
        <button onClick={handleSave} disabled={saving || !title.trim()} className="text-sm font-medium"
          style={{ color: saving || !title.trim() ? T.muted : T.accent }}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">
        {/* 제목 */}
        <div className="rounded-xl px-4 py-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <label className="block text-xs mb-1" style={{ color: T.muted }}>양식 이름</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full text-sm outline-none bg-transparent" style={{ color: T.text }}
            placeholder="예: 주간 건강 측정" autoFocus={isNew} />
        </div>

        {/* 알림 설정 */}
        <div className="rounded-xl px-4 py-3 space-y-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <label className="block text-xs" style={{ color: T.muted }}>알림 요일 (선택)</label>
          <div className="flex gap-1">
            {WEEKDAYS.map((d, i) => (
              <button key={i} onClick={() => setNotifyWeekday(notifyWeekday === i ? null : i)}
                className="flex-1 py-1.5 rounded text-xs font-medium transition-colors"
                style={{
                  background: notifyWeekday === i ? T.accentDim : T.surface2,
                  color: notifyWeekday === i ? T.accent : T.muted,
                  border: `1px solid ${notifyWeekday === i ? T.accentBorder : T.border}`,
                }}>
                {d}
              </button>
            ))}
          </div>
          {notifyWeekday !== null && (
            <div>
              <label className="block text-xs mb-1" style={{ color: T.muted }}>알림 시각</label>
              <input type="time" value={notifyTime} onChange={(e) => setNotifyTime(e.target.value)}
                className="text-sm outline-none bg-transparent"
                style={{ color: notifyTime ? T.accent : T.muted, colorScheme: 'dark' }} />
            </div>
          )}
        </div>

        {/* 구글 시트 연동 */}
        {effectiveOwnerId && (
          <SheetTargetPicker
            ownerType={effectiveOwnerType}
            ownerId={effectiveOwnerId}
            targetId={sheetTargetId}
            tabName={sheetTabName}
            defaultTabName={title.trim()}
            onChange={(nextTargetId, nextTabName) => {
              setSheetTargetId(nextTargetId)
              setSheetTabName(nextTabName)
            }}
          />
        )}

        <ExcelItemsCard
          itemLabel="측정 항목"
          preview={excelPreview}
          applying={false}
          onDownload={handleExcelDownload}
          onSelectFile={handleExcelFile}
          onApply={handleExcelApply}
          onCancel={() => { setExcelPreview(null); setExcelRows(null) }}
        />

        {/* 측정 항목 */}
        <div className="rounded-xl overflow-hidden" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
            <span className="text-xs" style={{ color: T.muted }}>측정 항목</span>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              {fields.map((f) => (
                <SortableFieldItem key={f.id} field={f} onDelete={handleDeleteField} />
              ))}
            </SortableContext>
          </DndContext>
          <div className="px-4 py-3 space-y-2" style={{ borderTop: fields.length > 0 ? `1px solid ${T.border}` : undefined }}>
            <div className="flex gap-2 items-center">
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
                placeholder="항목명 (예: 체중)" className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: T.text }} />
              <input value={newUnit} onChange={(e) => setNewUnit(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
                placeholder="단위 (선택)" className="w-20 text-sm outline-none bg-transparent"
                style={{ color: T.text }} />
              <button onClick={handleAddField} className="text-sm font-medium" style={{ color: T.accent }}>추가</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SortableFieldItem({ field, onDelete }: { field: LocalField; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={{ ...style, borderBottom: `1px solid ${T.border}` }}
      className="flex items-center gap-3 px-4 py-3">
      <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing select-none" style={{ color: T.border }}>⠿</span>
      <div className="flex-1 min-w-0">
        <span className="text-sm" style={{ color: T.text }}>{field.label}</span>
        {field.unit && <span className="text-xs ml-1" style={{ color: T.muted }}>({field.unit})</span>}
      </div>
      <button onClick={() => onDelete(field.id)} style={{ color: T.border }}
        onMouseEnter={e => (e.currentTarget.style.color = T.danger)}
        onMouseLeave={e => (e.currentTarget.style.color = T.border)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>
    </div>
  )
}
