/**
 * TaskChecker 측정 기록 → 구글 시트 적재용 Apps Script
 *
 * 설치 방법
 *  1. 구글 시트를 새로 하나 만든다 (이 시트에 데이터가 계속 쌓인다)
 *  2. 확장 프로그램 → Apps Script → 이 파일 내용을 통째로 붙여넣는다
 *  3. 아래 SECRET을 길고 무작위한 문자열로 바꾼다
 *  4. 배포 → 새 배포 → 유형: 웹 앱
 *       - 실행 계정: 나
 *       - 액세스 권한: 모든 사용자
 *  5. 발급된 /exec URL과 SECRET을 Supabase Edge Function 시크릿에 등록한다
 *       SHEETS_WEBHOOK_URL    = https://script.google.com/macros/s/..../exec
 *       SHEETS_WEBHOOK_SECRET = 3번에서 정한 문자열
 *
 * 동작
 *  - 측정 양식 이름으로 탭을 찾고, 없으면 새로 만든다
 *  - 양식에 항목이 추가되면 헤더에 열을 자동으로 덧붙인다
 *  - 헤더 순서에 맞춰 한 줄씩 append 한다 (기존 데이터는 건드리지 않음)
 */

var SECRET = 'CHANGE_ME'

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents)

    if (body.secret !== SECRET) {
      return reply({ error: 'unauthorized' })
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet()
    // 시트 탭 이름은 100자 제한
    var tabName = String(body.form || '측정').substring(0, 90)
    var sheet = ss.getSheetByName(tabName)

    if (!sheet) {
      sheet = ss.insertSheet(tabName)
      sheet.appendRow(['제출일시', '입력자'])
      sheet.setFrozenRows(1)
      sheet.getRange(1, 1, 1, 2).setFontWeight('bold')
    }

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String)

    // 고정 열이 없으면 만들어 준다 (사람이 헤더를 지운 경우 대비)
    headers = ensureColumn(sheet, headers, '제출일시')
    headers = ensureColumn(sheet, headers, '입력자')

    // 새 측정 항목이 생겼으면 열을 덧붙인다
    var incoming = body.values || []
    for (var i = 0; i < incoming.length; i++) {
      headers = ensureColumn(sheet, headers, columnName(incoming[i]))
    }

    // 헤더 순서에 맞춰 한 줄 구성
    var row = []
    for (var c = 0; c < headers.length; c++) row.push('')

    row[headers.indexOf('제출일시')] = body.submittedAt ? new Date(body.submittedAt) : new Date()
    row[headers.indexOf('입력자')] = body.submittedBy || ''

    for (var j = 0; j < incoming.length; j++) {
      var idx = headers.indexOf(columnName(incoming[j]))
      if (idx !== -1) row[idx] = incoming[j].value
    }

    sheet.appendRow(row)

    return reply({ ok: true, tab: tabName, row: sheet.getLastRow() })
  } catch (err) {
    return reply({ error: String(err) })
  }
}

/** 헤더에 없는 열이면 끝에 추가하고 갱신된 헤더 배열을 돌려준다 */
function ensureColumn(sheet, headers, name) {
  if (headers.indexOf(name) !== -1) return headers
  headers.push(name)
  sheet.getRange(1, headers.length).setValue(name).setFontWeight('bold')
  return headers
}

/** 단위가 있으면 '온도(℃)' 형태로 — 엑셀 출력과 같은 표기 */
function columnName(v) {
  return v.unit ? v.label + '(' + v.unit + ')' : v.label
}

function reply(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}
