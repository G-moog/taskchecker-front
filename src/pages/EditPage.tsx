import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useChecklistDetail } from '../hooks/useChecklistDetail'
import { T } from '../theme'
import type { ChecklistItem, RepeatType, Todo } from '../types/database'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function EditPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const isNew = id === 'new'
  const ownerType = searchParams.get('ownerType') as 'personal' | 'team' | null
  const ownerId = searchParams.get('ownerId') ?? ''

  const { checklist, items, loading, updateSortOrder } = useChecklistDetail(isNew ? undefined : id)

  const [title, setTitle] = useState('')
  const [repeatType, setRepeatType] = useState<RepeatType>('daily')
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  const [notifyTime, setNotifyTime] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [localItems, setLocalItems] = useState<ChecklistItem[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [customHours, setCustomHours] = useState(0)
  const [customMinutes, setCustomMinutes] = useState(30)
  const [showTodoPicker, setShowTodoPicker] = useState(false)
  const [todos, setTodos] = useState<Todo[]>([])

  const isTeam = isNew ? ownerType === 'team' : checklist?.owner_type === 'team'

  useEffect(() => {
    if (checklist) {
      setTitle(checklist.title)
      setRepeatType(checklist.repeat_type)
      setRepeatDays(checklist.repeat_days ?? [])
      setNotifyTime(checklist.notify_time ?? '')
      setScheduledDate(checklist.scheduled_date ?? '')
    }
  }, [checklist])

  useEffect(() => { setLocalItems(items) }, [items])

  const sensors = useSensors(useSensor(PointerSensor))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIdx = localItems.findIndex((i) => i.id === active.id)
      const newIdx = localItems.findIndex((i) => i.id === over.id)
      const reordered = arrayMove(localItems, oldIdx, newIdx)
      setLocalItems(reordered)
      updateSortOrder(reordered.map((i) => i.id))
    }
  }

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)

    if (isNew) {
      const { data: cl, error } = await supabase
        .from('checklists')
        .insert({
          title: title.trim(),
          owner_type: ownerType ?? 'personal',
          owner_id: ownerId,
          repeat_type: repeatType,
          repeat_days: repeatType === 'weekly' ? repeatDays : null,
          notify_time: notifyTime || null,
          scheduled_date: repeatType === 'once' ? (scheduledDate || null) : null,
          created_by: user!.id,
        })
        .select()
        .single()

      if (!error && cl && localItems.length > 0) {
        await supabase.from('checklist_items').insert(
          localItems.map((item, idx) => ({
            checklist_id: cl.id,
            label: item.label,
            sort_order: idx,
            todo_id: item.todo_id ?? null,
          }))
        )
      }
    } else {
      await supabase.from('checklists').update({
        title: title.trim(),
        repeat_type: repeatType,
        repeat_days: repeatType === 'weekly' ? repeatDays : null,
        notify_time: notifyTime || null,
        scheduled_date: repeatType === 'once' ? (scheduledDate || null) : null,
      }).eq('id', id!)
    }

    setSaving(false)
    navigate('/')
  }

  const handleAddItem = async (label?: string, todoId?: string) => {
    const text = (label ?? newLabel).trim()
    if (!text) return

    if (isNew) {
      const tempItem: ChecklistItem = {
        id: `temp-${Date.now()}`,
        checklist_id: '',
        label: text,
        sort_order: localItems.length,
        todo_id: todoId ?? null,
        created_at: '',
        updated_at: '',
      }
      setLocalItems((prev) => [...prev, tempItem])
      if (!label) setNewLabel('')
    } else {
      const { data, error } = await supabase
        .from('checklist_items')
        .insert({ checklist_id: id!, label: text, sort_order: localItems.length, todo_id: todoId ?? null })
        .select().single()
      if (!error && data) { setLocalItems((prev) => [...prev, data]); if (!label) setNewLabel('') }
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (isNew || itemId.startsWith('temp-')) {
      setLocalItems((prev) => prev.filter((i) => i.id !== itemId))
    } else {
      await supabase.from('checklist_items').delete().eq('id', itemId)
      setLocalItems((prev) => prev.filter((i) => i.id !== itemId))
    }
  }

  const openTodoPicker = async () => {
    if (!user) return
    const { data } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
      .eq('done', false)
      .order('created_at', { ascending: false })
    setTodos(data ?? [])
    setShowTodoPicker(true)
  }

  const handleSelectTodo = (todo: Todo) => {
    const alreadyAdded = localItems.some((i) => i.todo_id === todo.id)
    if (!alreadyAdded) {
      handleAddItem(todo.title, todo.id)
    }
    setShowTodoPicker(false)
  }

  const toggleDay = (day: number) =>
    setRepeatDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day])

  if (!isNew && loading) return <div className="flex items-center justify-center min-h-screen text-sm" style={{ background: T.bg, color: T.muted }}>불러오는 중...</div>

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => navigate('/')} className="text-sm" style={{ color: T.muted }}>취소</button>
        <h1 className="text-base font-semibold" style={{ color: T.text }}>{isNew ? '새 체크리스트' : '편집'}</h1>
        <button onClick={handleSave} disabled={saving || !title.trim()} className="text-sm font-medium"
          style={{ color: saving || !title.trim() ? T.muted : T.accent }}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">
        {/* 제목 */}
        <div className="rounded-xl px-4 py-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <label className="block text-xs mb-1" style={{ color: T.muted }}>이름</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full text-sm outline-none bg-transparent" style={{ color: T.text }}
            placeholder="체크리스트 이름을 입력하세요"
            autoFocus={isNew} />
        </div>

        {/* 반복 유형 */}
        <div className="rounded-xl px-4 py-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <label className="block text-xs mb-2" style={{ color: T.muted }}>반복 유형</label>
          <div className="flex gap-2">
            {(['daily', 'weekly', 'once'] as RepeatType[]).map((rt) => (
              <button key={rt} onClick={() => setRepeatType(rt)}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: repeatType === rt ? T.accentDim : T.surface2,
                  color: repeatType === rt ? T.accent : T.muted,
                  border: `1px solid ${repeatType === rt ? T.accentBorder : T.border}`,
                }}>
                {rt === 'daily' ? '매일' : rt === 'weekly' ? '주간' : '단발성'}
              </button>
            ))}
          </div>

          {repeatType === 'weekly' && (
            <div className="flex gap-1 mt-3">
              {DAYS.map((d, i) => (
                <button key={i} onClick={() => toggleDay(i)}
                  className="flex-1 py-1.5 rounded text-xs font-medium transition-colors"
                  style={{
                    background: repeatDays.includes(i) ? T.accentDim : T.surface2,
                    color: repeatDays.includes(i) ? T.accent : T.muted,
                    border: `1px solid ${repeatDays.includes(i) ? T.accentBorder : T.border}`,
                  }}>
                  {d}
                </button>
              ))}
            </div>
          )}

          {repeatType === 'once' && (
            <div className="mt-3">
              <label className="block text-xs mb-1" style={{ color: T.muted }}>날짜 (선택 — 비우면 오늘)</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="text-sm outline-none bg-transparent"
                style={{ color: scheduledDate ? T.accent : T.muted, colorScheme: 'dark' }}
              />
            </div>
          )}
        </div>

        {/* 알림 시간 */}
        <div className="rounded-xl px-4 py-3 space-y-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div>
            <label className="block text-xs mb-1" style={{ color: T.muted }}>알림 시간 (선택)</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0} max={23} placeholder="시"
                value={notifyTime ? notifyTime.split(':')[0] : ''}
                onChange={(e) => {
                  const h = Math.max(0, Math.min(23, Number(e.target.value)))
                  const m = notifyTime ? notifyTime.split(':')[1] : '00'
                  setNotifyTime(`${String(h).padStart(2, '0')}:${m}`)
                }}
                className="w-16 text-center text-sm outline-none rounded-lg py-2"
                style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text }}
              />
              <span style={{ color: T.muted }}>:</span>
              <input
                type="number" min={0} max={59} placeholder="분"
                value={notifyTime ? notifyTime.split(':')[1] : ''}
                onChange={(e) => {
                  const m = Math.max(0, Math.min(59, Number(e.target.value)))
                  const h = notifyTime ? notifyTime.split(':')[0] : '00'
                  setNotifyTime(`${h}:${String(m).padStart(2, '0')}`)
                }}
                className="w-16 text-center text-sm outline-none rounded-lg py-2"
                style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text }}
              />
              {notifyTime && (
                <button onClick={() => setNotifyTime('')} className="text-xs ml-1" style={{ color: T.muted }}>지우기</button>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs mb-2" style={{ color: T.muted }}>빠른 설정</p>
            <div className="flex gap-2 flex-wrap">
              {[15, 30, 60].map((min) => (
                <button key={min} onClick={() => {
                  const d = new Date(Date.now() + min * 60 * 1000)
                  setNotifyTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
                  setCustomOpen(false)
                }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: T.surface2, color: T.muted, border: `1px solid ${T.border}` }}>
                  {min < 60 ? `${min}분 뒤` : '1시간 뒤'}
                </button>
              ))}
              <button onClick={() => setCustomOpen((v) => !v)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{
                  background: customOpen ? T.accentDim : T.surface2,
                  color: customOpen ? T.accent : T.muted,
                  border: `1px solid ${customOpen ? T.accentBorder : T.border}`,
                }}>
                직접 설정
              </button>
            </div>
          </div>

          {customOpen && (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-center gap-1">
                <input type="number" min={0} max={23} value={customHours}
                  onChange={(e) => setCustomHours(Math.max(0, Math.min(23, Number(e.target.value))))}
                  className="w-12 text-center text-sm outline-none rounded-lg py-1.5 bg-transparent"
                  style={{ border: `1px solid ${T.border}`, color: T.text }} />
                <span className="text-xs" style={{ color: T.muted }}>시간</span>
              </div>
              <div className="flex items-center gap-1">
                <input type="number" min={0} max={59} value={customMinutes}
                  onChange={(e) => setCustomMinutes(Math.max(0, Math.min(59, Number(e.target.value))))}
                  className="w-12 text-center text-sm outline-none rounded-lg py-1.5 bg-transparent"
                  style={{ border: `1px solid ${T.border}`, color: T.text }} />
                <span className="text-xs" style={{ color: T.muted }}>분 뒤</span>
              </div>
              <button onClick={() => {
                const totalMin = customHours * 60 + customMinutes
                if (totalMin <= 0) return
                const d = new Date(Date.now() + totalMin * 60 * 1000)
                setNotifyTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
                setCustomOpen(false)
              }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: T.accent, color: '#0d0d12' }}>
                적용
              </button>
            </div>
          )}
        </div>

        {isTeam && (
          <div className="rounded-xl px-4 py-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <label className="block text-xs mb-1" style={{ color: T.muted }}>알림 대상</label>
            <p className="text-sm" style={{ color: T.muted }}>전체 팀원 (기본값)</p>
          </div>
        )}

        {/* 항목 목록 */}
        <div className="rounded-xl overflow-hidden" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
            <span className="text-xs" style={{ color: T.muted }}>항목</span>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={localItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {localItems.map((item) => <SortableItem key={item.id} item={item} onDelete={handleDeleteItem} />)}
            </SortableContext>
          </DndContext>
          <div className="px-4 py-3 flex gap-2 items-center">
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              placeholder="항목 추가..." className="flex-1 text-sm outline-none bg-transparent"
              style={{ color: T.text }} />
            <button onClick={() => handleAddItem()} className="text-sm font-medium" style={{ color: T.accent }}>추가</button>
            <button onClick={openTodoPicker} className="text-sm font-medium ml-1 px-2 py-1 rounded-lg"
              style={{ color: T.accent, background: T.accentDim, border: `1px solid ${T.accentBorder}` }}>
              할 일에서
            </button>
          </div>
        </div>
      </div>

      {/* 할 일 선택 모달 */}
      {showTodoPicker && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowTodoPicker(false)}>
          <div className="w-full rounded-t-2xl overflow-hidden" style={{ background: T.surface, maxHeight: '60vh' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
              <span className="text-sm font-semibold" style={{ color: T.text }}>할 일 목록에서 추가</span>
              <button onClick={() => setShowTodoPicker(false)} style={{ color: T.muted }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 52px)' }}>
              {todos.length === 0 ? (
                <div className="text-center text-sm py-10" style={{ color: T.muted }}>미완료 할 일이 없습니다</div>
              ) : (
                todos.map((todo) => {
                  const alreadyAdded = localItems.some((i) => i.todo_id === todo.id)
                  return (
                    <button key={todo.id} onClick={() => handleSelectTodo(todo)}
                      disabled={alreadyAdded}
                      className="w-full text-left px-4 py-3 flex items-center gap-3"
                      style={{ borderBottom: `1px solid ${T.border}`, opacity: alreadyAdded ? 0.4 : 1 }}>
                      <span className="flex-1 text-sm" style={{ color: T.text }}>{todo.title}</span>
                      {alreadyAdded
                        ? <span className="text-xs" style={{ color: T.muted }}>추가됨</span>
                        : <span className="text-xs" style={{ color: T.accent }}>+ 추가</span>
                      }
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SortableItem({ item, onDelete }: { item: ChecklistItem; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={{ ...style, borderBottom: `1px solid ${T.border}` }} className="flex items-center gap-3 px-4 py-3 last:border-0">
      <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing select-none" style={{ color: T.border }}>⠿</span>
      <div className="flex-1 min-w-0">
        <span className="text-sm block" style={{ color: T.text }}>{item.label}</span>
        {item.todo_id && (
          <span className="text-xs" style={{ color: T.accent }}>할 일 목록에서 추가됨</span>
        )}
      </div>
      <button onClick={() => onDelete(item.id)} className="transition-colors flex-shrink-0" style={{ color: T.border }}
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
