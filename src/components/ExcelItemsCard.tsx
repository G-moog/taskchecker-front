import { useRef } from 'react'
import { T } from '../theme'
import type { SyncPreview } from '../lib/excelItems'

export interface ExcelPreview extends SyncPreview {
  errors: string[]
}

interface Props {
  /** '체크리스트 항목' 같은 안내용 이름 */
  itemLabel: string
  preview: ExcelPreview | null
  applying: boolean
  onDownload: () => void
  onSelectFile: (file: File) => void
  onApply: () => void
  onCancel: () => void
}

export function ExcelItemsCard({
  itemLabel, preview, applying, onDownload, onSelectFile, onApply, onCancel,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onSelectFile(file)
    // 같은 파일을 다시 골라도 change가 걸리도록 비운다
    e.target.value = ''
  }

  const hasBlockingError = !!preview && preview.errors.length > 0
    && preview.added.length === 0 && preview.updated.length === 0 && preview.unchanged.length === 0

  return (
    <>
      <div className="rounded-xl px-4 py-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
        <label className="block text-xs mb-2" style={{ color: T.muted }}>엑셀로 항목 관리</label>
        <div className="flex gap-2">
          <button onClick={onDownload}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{ background: T.surface2, color: T.muted, border: `1px solid ${T.border}` }}>
            다운로드
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{ background: T.accentDim, color: T.accent, border: `1px solid ${T.accentBorder}` }}>
            업로드
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleChange} className="hidden" />
      </div>

      {preview && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onCancel}>
          <div className="rounded-2xl w-full max-w-sm overflow-hidden"
            style={{ background: T.surface, border: `1px solid ${T.border}`, maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
              <p className="text-sm font-semibold" style={{ color: T.text }}>엑셀 적용 미리보기</p>
            </div>

            <div className="px-5 py-4 space-y-3 overflow-y-auto" style={{ maxHeight: '50vh' }}>
              {preview.errors.length > 0 && (
                <Section title="확인 필요" color={T.danger} labels={preview.errors} />
              )}
              {preview.added.length > 0 && (
                <Section title={`추가 ${preview.added.length}`} color={T.success} labels={preview.added} />
              )}
              {preview.updated.length > 0 && (
                <Section title={`수정 ${preview.updated.length}`} color={T.warning} labels={preview.updated} />
              )}
              {preview.removed.length > 0 && (
                <Section title={`삭제 ${preview.removed.length}`} color={T.danger} labels={preview.removed}
                  note={`엑셀에 없는 항목입니다. 삭제하면 이 ${itemLabel}에 쌓인 기록도 함께 사라집니다.`} />
              )}
              {preview.unchanged.length > 0 && (
                <Section title={`변경 없음 ${preview.unchanged.length}`} color={T.muted} labels={preview.unchanged} />
              )}
              {!hasBlockingError && preview.added.length === 0 && preview.updated.length === 0 && preview.removed.length === 0 && (
                <p className="text-sm" style={{ color: T.muted }}>바뀌는 내용이 없습니다.</p>
              )}
            </div>

            <div className="px-5 py-4 flex gap-3" style={{ borderTop: `1px solid ${T.border}` }}>
              <button onClick={onCancel} className="flex-1 rounded-xl py-2.5 text-sm"
                style={{ border: `1px solid ${T.border}`, color: T.muted }}>취소</button>
              <button onClick={onApply} disabled={applying || hasBlockingError}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                style={{
                  background: T.accent, color: '#0d0d12',
                  opacity: applying || hasBlockingError ? 0.4 : 1,
                }}>
                {applying ? '적용 중...' : '적용'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Section({ title, color, labels, note }: { title: string; color: string; labels: string[]; note?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold mb-1" style={{ color }}>{title}</p>
      {note && <p className="text-xs mb-1.5" style={{ color: T.muted }}>{note}</p>}
      <div className="flex flex-wrap gap-1">
        {labels.map((label, idx) => (
          <span key={`${label}-${idx}`} className="text-xs px-2 py-0.5 rounded"
            style={{ background: T.surface2, color: T.text }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
