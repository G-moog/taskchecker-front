import * as XLSX from 'xlsx'

/**
 * 체크리스트 항목 / 측정 양식 항목을 엑셀로 주고받는다.
 *
 * 업로드는 항목명을 키로 맞춘다. 이름이 같으면 기존 행을 그대로 두고 속성만
 * 고치기 때문에, 그 항목에 쌓인 기록(checklist_item_status, measurement_values)이
 * 유지된다. 지우고 새로 넣으면 기록이 함께 사라진다.
 */

export interface ChecklistItemRow {
  label: string
  itemType: 'check' | 'measure'
  unit: string | null
  options: string[] | null
  hasNote: boolean
}

export interface MeasurementFieldRow {
  label: string
  unit: string | null
}

export interface ParseResult<T> {
  rows: T[]
  errors: string[]
}

export interface SyncPreview {
  added: string[]
  updated: string[]
  unchanged: string[]
  removed: string[]
}

const CHECKLIST_HEADERS = ['순서', '항목명', '유형', '단위', '보기', '비고란']
const MEASUREMENT_HEADERS = ['순서', '항목명', '단위']

// 빈 상태에서 내려받으면 서식을 알 수 있도록 예시를 넣는다
const CHECKLIST_SAMPLE: (string | number)[][] = [
  [1, '환기팬 작동 확인', '체크', '', '', ''],
  [2, '배지 EC', '측정', 'mS/cm', '', 'Y'],
  [3, '병해 발생', '측정', '', '정상,의심,발생', 'Y'],
]

const MEASUREMENT_SAMPLE: (string | number)[][] = [
  [1, '초장', 'cm'],
  [2, '엽수', '장'],
]

function writeBook(headers: string[], rows: (string | number)[][], sheetName: string, fileName: string) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length * 3, 14) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, fileName)
}

export function downloadChecklistItems(
  title: string,
  items: { label: string; item_type: 'check' | 'measure'; unit: string | null; options: string[] | null; has_note: boolean }[],
) {
  const rows = items.length > 0
    ? items.map((it, idx) => [
        idx + 1,
        it.label,
        it.item_type === 'measure' ? '측정' : '체크',
        it.unit ?? '',
        (it.options ?? []).join(','),
        it.has_note ? 'Y' : '',
      ])
    : CHECKLIST_SAMPLE
  writeBook(CHECKLIST_HEADERS, rows, '항목', `${title || '체크리스트'}_항목.xlsx`)
}

export function downloadMeasurementFields(
  title: string,
  fields: { label: string; unit: string | null }[],
) {
  const rows = fields.length > 0
    ? fields.map((f, idx) => [idx + 1, f.label, f.unit ?? ''])
    : MEASUREMENT_SAMPLE
  writeBook(MEASUREMENT_HEADERS, rows, '항목', `${title || '측정양식'}_항목.xlsx`)
}

async function readFirstSheet(file: File): Promise<Record<string, unknown>[] | null> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const name = wb.SheetNames[0]
  if (!name) return null
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: '' })
}

function text(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim()
}

function isFlagOn(v: string): boolean {
  const s = v.toLowerCase()
  return s === 'y' || s === 'yes' || s === 'true' || s === 'o' || s === '1' || v === '예'
}

export async function parseChecklistItems(file: File): Promise<ParseResult<ChecklistItemRow>> {
  const errors: string[] = []
  let raw: Record<string, unknown>[] | null
  try {
    raw = await readFirstSheet(file)
  } catch {
    return { rows: [], errors: ['엑셀 파일을 읽을 수 없습니다.'] }
  }
  if (!raw) return { rows: [], errors: ['시트를 찾을 수 없습니다.'] }

  const rows: ChecklistItemRow[] = []
  const seen = new Set<string>()

  raw.forEach((r, idx) => {
    const line = idx + 2 // 1행은 헤더
    const label = text(r['항목명'])
    const typeText = text(r['유형'])
    const unit = text(r['단위'])
    const optionText = text(r['보기'])
    const noteText = text(r['비고란'])

    if (!label) {
      if (typeText || unit || optionText || noteText) errors.push(`${line}행: 항목명이 비어 있습니다.`)
      return
    }
    if (seen.has(label)) {
      errors.push(`${line}행: 항목명 '${label}'이(가) 중복됩니다.`)
      return
    }
    seen.add(label)

    let itemType: 'check' | 'measure'
    const lowered = typeText.toLowerCase()
    if (!typeText || typeText === '체크' || lowered === 'check') itemType = 'check'
    else if (typeText === '측정' || lowered === 'measure') itemType = 'measure'
    else {
      errors.push(`${line}행: 유형은 '체크' 또는 '측정'이어야 합니다. (입력값: ${typeText})`)
      return
    }

    const options = optionText ? optionText.split(',').map((s) => s.trim()).filter(Boolean) : []

    rows.push({
      label,
      itemType,
      // 체크 타입에는 단위/보기/비고란이 의미가 없으므로 버린다
      unit: itemType === 'measure' && unit ? unit : null,
      options: itemType === 'measure' && options.length > 0 ? options : null,
      hasNote: itemType === 'measure' && isFlagOn(noteText),
    })
  })

  if (rows.length === 0 && errors.length === 0) errors.push('불러올 항목이 없습니다.')
  return { rows, errors }
}

export async function parseMeasurementFields(file: File): Promise<ParseResult<MeasurementFieldRow>> {
  const errors: string[] = []
  let raw: Record<string, unknown>[] | null
  try {
    raw = await readFirstSheet(file)
  } catch {
    return { rows: [], errors: ['엑셀 파일을 읽을 수 없습니다.'] }
  }
  if (!raw) return { rows: [], errors: ['시트를 찾을 수 없습니다.'] }

  const rows: MeasurementFieldRow[] = []
  const seen = new Set<string>()

  raw.forEach((r, idx) => {
    const line = idx + 2
    const label = text(r['항목명'])
    const unit = text(r['단위'])

    if (!label) {
      if (unit) errors.push(`${line}행: 항목명이 비어 있습니다.`)
      return
    }
    if (seen.has(label)) {
      errors.push(`${line}행: 항목명 '${label}'이(가) 중복됩니다.`)
      return
    }
    seen.add(label)

    rows.push({ label, unit: unit || null })
  })

  if (rows.length === 0 && errors.length === 0) errors.push('불러올 항목이 없습니다.')
  return { rows, errors }
}

/** 항목명을 키로 들어온 목록과 기존 목록을 비교한다 */
export function diffByLabel<T extends { label: string }, E extends { label: string }>(
  incoming: T[],
  existing: E[],
  isSame: (incomingRow: T, existingRow: E) => boolean,
): SyncPreview {
  const existingByLabel = new Map(existing.map((e) => [e.label, e]))
  const incomingLabels = new Set(incoming.map((i) => i.label))

  const added: string[] = []
  const updated: string[] = []
  const unchanged: string[] = []

  for (const row of incoming) {
    const match = existingByLabel.get(row.label)
    if (!match) added.push(row.label)
    else if (isSame(row, match)) unchanged.push(row.label)
    else updated.push(row.label)
  }

  const removed = existing.filter((e) => !incomingLabels.has(e.label)).map((e) => e.label)
  return { added, updated, unchanged, removed }
}
