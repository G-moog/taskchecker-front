import { useEffect, useRef, useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useSettings } from '../hooks/useSettings'
import { T } from '../theme'
import type { Todo, Checklist } from '../types/database'

interface TodoWithChecklists extends Todo {
  checklists: string[]
}

export function TeamTodoList({ teamId }: { teamId: string }) {
  const { user } = useAuth()
  const { settings } = useSettings()

  const [todos, setTodos] = useState<TodoWithChecklists[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  const [sheetTodo, setSheetTodo] = useState<TodoWithChecklists | null>(null)
  const [teamChecklists, setTeamChecklists] = useState<Checklist[]>([])
  const [adding, setAdding] = useState<string | null>(null)
  const [notifyInput, setNotifyInput] = useState('')
  const [savingNotify, setSavingNotify] = useState(false)
  const [showCustomTime, setShowCustomTime] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 300, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } }),
  )

  useEffect(() => {
    loadTodos()
  }, [teamId])

  const loadTodos = async () => {
    setLoading(true)
    const { data: todoData } = await supabase
      .from('todos')
      .select('*')
      .eq('team_id', teamId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (!todoData) { setLoading(false); return }

    const todoIds = todoData.map((t) => t.id)
    const { data: linkData } = todoIds.length
      ? await supabase
          .from('checklist_items')
          .select('todo_id, checklists(title)')
          .in('todo_id', todoIds)
      : { data: [] }

    const linkMap: Record<string, string[]> = {}
    for (const link of linkData ?? []) {
      if (!link.todo_id) continue
      const title = (link.checklists as { title: string } | null)?.title
      if (!title) continue
      if (!linkMap[link.todo_id]) linkMap[link.todo_id] = []
      if (!linkMap[link.todo_id].includes(title)) linkMap[link.todo_id].push(title)
    }

    setTodos(todoData.map((t) => ({ ...t, checklists: linkMap[t.id] ?? [] })))
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!input.trim() || !user) return
    const title = input.trim()
    setInput('')
    const { data } = await supabase
      .from('todos')
      .insert({ user_id: user.id, team_id: teamId, title, done: false })
      .select()
      .single()
    if (data) {
      const minOrder = todos.reduce((min, t) => Math.min(min, t.sort_order ?? 0), 0)
      const newOrder = minOrder - 1
      await supabase.from('todos').update({ sort_order: newOrder }).eq('id', data.id)
      setTodos((prev) => [{ ...data, sort_order: newOrder, checklists: [] }, ...prev])
    }
    inputRef.current?.focus()
  }

  const handleToggle = async (todo: TodoWithChecklists) => {
    const done = !todo.done
    setTodos((prev) => prev.map((t) => t.id === todo.id ? { ...t, done } : t))
    await supabase.from('todos').update({ done }).eq('id', todo.id)
  }

  const handleDelete = async (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id))
    await supabase.from('todos').delete().eq('id', id)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setTodos((prev) => {
      const oldIdx = prev.findIndex((t) => t.id === active.id)
      const newIdx = prev.findIndex((t) => t.id === over.id)
      const next = arrayMove(prev, oldIdx, newIdx)
      const pending = next.filter((t) => !t.done)
      pending.forEach((todo, idx) => {
        supabase.from('todos').update({ sort_order: idx }).eq('id', todo.id)
      })
      return next
    })
  }

  const handleLongPress = async (todo: TodoWithChecklists) => {
    const { data } = await supabase
      .from('checklists')
      .select('*')
      .eq('owner_type', 'team')
      .eq('owner_id', teamId)
      .order('created_at', { ascending: false })
    setTeamChecklists(data ?? [])
    if (todo.notify_at) {
      const d = new Date(todo.notify_at)
      setNotifyInput(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16))
    } else {
      setNotifyInput('')
    }
    setShowCustomTime(false)
    setEditTitle(todo.title)
    setSheetTodo(todo)
  }

  const handleSaveTitle = async () => {
    if (!sheetTodo || !editTitle.trim()) return
    setSavingTitle(true)
    const title = editTitle.trim()
    await supabase.from('todos').update({ title }).eq('id', sheetTodo.id)
    setTodos((prev) => prev.map((t) => t.id === sheetTodo.id ? { ...t, title } : t))
    setSheetTodo((prev) => prev ? { ...prev, title } : prev)
    setSavingTitle(false)
  }

  const handleQuickNotify = async (minutes: number) => {
    if (!sheetTodo) return
    setSavingNotify(true)
    const notify_at = new Date(Date.now() + minutes * 60 * 1000).toISOString()
    await supabase.from('todos').update({ notify_at }).eq('id', sheetTodo.id)
    setTodos((prev) => prev.map((t) => t.id === sheetTodo.id ? { ...t, notify_at } : t))
    setSavingNotify(false)
    setSheetTodo(null)
  }

  const handleSaveNotify = async () => {
    if (!sheetTodo) return
    setSavingNotify(true)
    const notify_at = notifyInput ? new Date(notifyInput).toISOString() : null
    await supabase.from('todos').update({ notify_at }).eq('id', sheetTodo.id)
    setTodos((prev) => prev.map((t) => t.id === sheetTodo.id ? { ...t, notify_at } : t))
    setSavingNotify(false)
  }

  const handleClearNotify = async () => {
    if (!sheetTodo) return
    await supabase.from('todos').update({ notify_at: null }).eq('id', sheetTodo.id)
    setTodos((prev) => prev.map((t) => t.id === sheetTodo.id ? { ...t, notify_at: null } : t))
    setNotifyInput('')
  }

  const handleSelectChecklist = async (checklist: Checklist) => {
    if (!sheetTodo) return
    setAdding(checklist.id)

    const { data: existing } = await supabase
      .from('checklist_items')
      .select('id')
      .eq('checklist_id', checklist.id)
      .eq('todo_id', sheetTodo.id)
      .maybeSingle()

    if (!existing) {
      const { data: items } = await supabase
        .from('checklist_items')
        .select('sort_order')
        .eq('checklist_id', checklist.id)
        .order('sort_order', { ascending: false })
        .limit(1)

      const nextOrder = (items?.[0]?.sort_order ?? -1) + 1
      await supabase.from('checklist_items').insert({
        checklist_id: checklist.id,
        label: sheetTodo.title,
        sort_order: nextOrder,
        todo_id: sheetTodo.id,
      })

      setTodos((prev) =>
        prev.map((t) =>
          t.id === sheetTodo.id && !t.checklists.includes(checklist.title)
            ? { ...t, checklists: [...t.checklists, checklist.title] }
            : t,
        ),
      )
    }

    setAdding(null)
    setSheetTodo(null)
  }

  const pending = todos.filter((t) => !t.done)
  const done = todos.filter((t) => t.done)

  return (
    <div className="px-4 py-4 max-w-lg mx-auto">
      {/* 입력 */}
      <div className="flex gap-2 mb-4">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="팀 할 일을 입력하세요"
          className="flex-1 px-3 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: T.surface2, color: T.text, border: `1px solid ${T.border}` }}
        />
        <button onClick={handleAdd} className="px-4 py-2.5 rounded-lg text-sm font-medium"
          style={{ background: T.accent, color: '#fff' }}>
          추가
        </button>
      </div>

      {loading ? (
        <div className="text-center text-sm py-8" style={{ color: T.muted }}>불러오는 중...</div>
      ) : (
        <>
          {pending.length === 0 && done.length === 0 && (
            <div className="text-center text-sm py-8" style={{ color: T.muted }}>팀 할 일을 추가해보세요</div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={pending.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {pending.map((todo) => (
                  <SortableTodoItem key={todo.id} todo={todo} onToggle={handleToggle} onDelete={handleDelete} onLongPress={handleLongPress} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {done.length > 0 && (
            <div className="mt-6">
              <div className="text-xs font-medium mb-2" style={{ color: T.muted }}>완료 ({done.length})</div>
              <div className="space-y-2">
                {done.map((todo) => (
                  <TodoItem key={todo.id} todo={todo} onToggle={handleToggle} onDelete={handleDelete} onLongPress={handleLongPress} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 바텀시트 */}
      {sheetTodo && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setSheetTodo(null)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} />
          <div
            className="relative rounded-t-2xl px-4 pt-4 pb-8"
            style={{ background: T.surface, maxHeight: '70vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: T.border }} />
            {/* 제목 편집 */}
            <div className="flex gap-2 mb-4">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: T.surface2, color: T.text, border: `1px solid ${T.border}` }}
              />
              <button
                onClick={handleSaveTitle}
                disabled={savingTitle || !editTitle.trim() || editTitle.trim() === sheetTodo.title}
                className="px-3 py-2 rounded-lg text-sm font-medium flex-shrink-0"
                style={{ background: T.accent, color: '#fff', opacity: (savingTitle || !editTitle.trim() || editTitle.trim() === sheetTodo.title) ? 0.4 : 1 }}
              >
                수정
              </button>
            </div>

            {/* 알림 설정 */}
            <div className="rounded-xl p-3 mb-5" style={{ background: T.surface2, border: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-2 mb-3">
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: T.accent }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9m6 0a3 3 0 01-6 0m6 0H3.5m17 0H15M12 3v1m0 0a7 7 0 017 7v3l1.5 1.5H3.5L5 14v-3a7 7 0 017-7z" />
                </svg>
                <span className="text-xs font-semibold" style={{ color: T.text }}>알림 설정</span>
                {sheetTodo.notify_at && (
                  <button onClick={handleClearNotify} className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: T.border, color: T.muted }}>
                    알림 삭제
                  </button>
                )}
              </div>

              {settings.todoQuickTimes.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {settings.todoQuickTimes.map((min) => {
                    const label = min < 60 ? `${min}분` : min === 60 ? '1시간' : `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ''}`
                    return (
                      <button key={min} onClick={() => handleQuickNotify(min)} disabled={savingNotify}
                        className="px-3 py-2 rounded-lg text-xs font-medium"
                        style={{ background: T.surface, color: T.accent, border: `1px solid ${T.accent}` }}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}

              <button onClick={() => setShowCustomTime((v) => !v)}
                className="w-full py-2 rounded-lg text-xs font-medium mb-2 flex items-center justify-center gap-1"
                style={{ background: T.surface, color: T.muted, border: `1px solid ${T.border}` }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
                </svg>
                직접 설정
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                  style={{ transform: showCustomTime ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showCustomTime && (
                <>
                  <input type="datetime-local" value={notifyInput} onChange={(e) => setNotifyInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-2"
                    style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}` }} />
                  <button onClick={handleSaveNotify} disabled={savingNotify}
                    className="w-full py-2 rounded-lg text-sm font-medium"
                    style={{ background: T.accent, color: '#fff', opacity: savingNotify ? 0.6 : 1 }}>
                    {savingNotify ? '저장 중...' : '알림 저장'}
                  </button>
                </>
              )}
            </div>

            {/* 팀 체크리스트 등록 */}
            <p className="text-xs mb-2" style={{ color: T.muted }}>팀 체크리스트에 추가</p>
            {teamChecklists.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: T.muted }}>팀 체크리스트가 없습니다</p>
            ) : (
              <div className="space-y-2">
                {teamChecklists.map((cl) => {
                  const alreadyAdded = sheetTodo.checklists.includes(cl.title)
                  return (
                    <button key={cl.id} disabled={alreadyAdded || adding === cl.id}
                      onClick={() => handleSelectChecklist(cl)}
                      className="w-full text-left px-4 py-3 rounded-xl text-sm flex items-center justify-between"
                      style={{ background: T.surface2, color: alreadyAdded ? T.muted : T.text, opacity: alreadyAdded ? 0.6 : 1, border: `1px solid ${T.border}` }}>
                      <span>{cl.title}</span>
                      {alreadyAdded && <span className="text-xs" style={{ color: T.muted }}>추가됨</span>}
                      {adding === cl.id && <span className="text-xs" style={{ color: T.muted }}>추가 중...</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SortableTodoItem({ todo, onToggle, onDelete, onLongPress }: {
  todo: TodoWithChecklists
  onToggle: (t: TodoWithChecklists) => void
  onDelete: (id: string) => void
  onLongPress: (t: TodoWithChecklists) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : undefined }
  return (
    <div ref={setNodeRef} style={style}>
      <TodoItem todo={todo} onToggle={onToggle} onDelete={onDelete} onLongPress={onLongPress} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}

function TodoItem({ todo, onToggle, onDelete, onLongPress, dragHandleProps }: {
  todo: TodoWithChecklists
  onToggle: (t: TodoWithChecklists) => void
  onDelete: (id: string) => void
  onLongPress: (t: TodoWithChecklists) => void
  dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const startLongPress = () => {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => { didLongPress.current = true; onLongPress(todo) }, 500)
  }
  const cancelLongPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }

  return (
    <div className="px-3 py-2.5 rounded-lg" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
      <div className="flex items-center gap-3">
        {dragHandleProps && (
          <span {...dragHandleProps} className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none" style={{ color: T.border }}>⠿</span>
        )}
        <button onClick={() => onToggle(todo)} className="flex-shrink-0">
          <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
            style={{ borderColor: todo.done ? T.accent : T.border, background: todo.done ? T.accent : 'transparent' }}>
            {todo.done && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </button>
        <span className="flex-1 text-sm select-none"
          style={{ color: todo.done ? T.muted : T.text, textDecoration: todo.done ? 'line-through' : 'none' }}
          onPointerDown={startLongPress} onPointerUp={cancelLongPress} onPointerLeave={cancelLongPress}>
          {todo.title}
        </span>
        <button onClick={() => onDelete(todo.id)} className="flex-shrink-0 p-1" style={{ color: T.muted }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {(todo.checklists.length > 0 || todo.notify_at) && (
        <div className="mt-1.5 ml-8 flex flex-wrap gap-1 items-center">
          {todo.notify_at && (
            <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: T.surface2, color: T.accent }}>
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9m6 0a3 3 0 01-6 0m6 0H3.5m17 0H15M12 3v1m0 0a7 7 0 017 7v3l1.5 1.5H3.5L5 14v-3a7 7 0 017-7z" />
              </svg>
              {new Date(todo.notify_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {todo.checklists.map((name) => (
            <span key={name} className="text-xs px-2 py-0.5 rounded-full" style={{ background: T.surface2, color: T.muted }}>{name}</span>
          ))}
        </div>
      )}
    </div>
  )
}
