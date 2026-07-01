import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Sidebar } from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { T } from '../theme'
import type { Todo } from '../types/database'

export default function TodoPage() {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [todos, setTodos] = useState<Todo[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTodos(data ?? [])
        setLoading(false)
      })
  }, [user])

  const handleAdd = async () => {
    if (!input.trim() || !user) return
    const title = input.trim()
    setInput('')
    const { data } = await supabase
      .from('todos')
      .insert({ user_id: user.id, title, done: false })
      .select()
      .single()
    if (data) setTodos((prev) => [data, ...prev])
    inputRef.current?.focus()
  }

  const handleToggle = async (todo: Todo) => {
    const done = !todo.done
    setTodos((prev) => prev.map((t) => t.id === todo.id ? { ...t, done } : t))
    await supabase.from('todos').update({ done }).eq('id', todo.id)
  }

  const handleDelete = async (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id))
    await supabase.from('todos').delete().eq('id', id)
  }

  const pending = todos.filter((t) => !t.done)
  const done = todos.filter((t) => t.done)

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-4 sticky top-0 z-30" style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg" style={{ color: T.muted }}>
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-base font-semibold" style={{ color: T.text }}>할 일 목록</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* 입력창 */}
        <div className="flex gap-2 mb-6">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="할 일을 입력하세요"
            className="flex-1 px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{ background: T.surface2, color: T.text, border: `1px solid ${T.border}` }}
          />
          <button
            onClick={handleAdd}
            className="px-4 py-2.5 rounded-lg text-sm font-medium"
            style={{ background: T.accent, color: '#fff' }}
          >
            추가
          </button>
        </div>

        {loading ? (
          <div className="text-center text-sm py-10" style={{ color: T.muted }}>불러오는 중...</div>
        ) : (
          <>
            {/* 미완료 */}
            {pending.length === 0 && done.length === 0 && (
              <div className="text-center text-sm py-10" style={{ color: T.muted }}>할 일을 추가해보세요</div>
            )}
            <div className="space-y-2">
              {pending.map((todo) => (
                <TodoItem key={todo.id} todo={todo} onToggle={handleToggle} onDelete={handleDelete} />
              ))}
            </div>

            {/* 완료 */}
            {done.length > 0 && (
              <div className="mt-6">
                <div className="text-xs font-medium mb-2" style={{ color: T.muted }}>완료 ({done.length})</div>
                <div className="space-y-2">
                  {done.map((todo) => (
                    <TodoItem key={todo.id} todo={todo} onToggle={handleToggle} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function TodoItem({ todo, onToggle, onDelete }: { todo: Todo; onToggle: (t: Todo) => void; onDelete: (id: string) => void }) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
      style={{ background: T.surface, border: `1px solid ${T.border}` }}
    >
      <button onClick={() => onToggle(todo)} className="flex-shrink-0">
        <div
          className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
          style={{
            borderColor: todo.done ? T.accent : T.border,
            background: todo.done ? T.accent : 'transparent',
          }}
        >
          {todo.done && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </button>
      <span
        className="flex-1 text-sm"
        style={{ color: todo.done ? T.muted : T.text, textDecoration: todo.done ? 'line-through' : 'none' }}
      >
        {todo.title}
      </span>
      <button onClick={() => onDelete(todo.id)} className="flex-shrink-0 p-1" style={{ color: T.muted }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
