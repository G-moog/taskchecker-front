/**
 * 날짜 키(status_date 등)는 반드시 이 함수들로 만든다.
 *
 * new Date().toISOString()은 UTC 기준이라 한국(UTC+9)에서는
 * 00:00~08:59 사이에 전날 날짜가 나온다. 그 결과 체크리스트가
 * 자정이 아니라 오전 9시에 초기화되는 문제가 있었다.
 */

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** 로컬 시간 기준 YYYY-MM-DD */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 로컬 시간 기준 오늘 날짜 (YYYY-MM-DD) */
export function todayString(): string {
  return toDateString(new Date())
}
