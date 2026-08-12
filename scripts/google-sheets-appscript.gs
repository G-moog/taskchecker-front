/**
 * TaskChecker 측정 기록 → 구글 시트 적재용 Apps Script
 *
 * 웹앱 하나로 여러 스프레드시트 파일에 쓴다.
 * 어느 파일의 어느 탭에 쓸지는 요청이 지정한다 (spreadsheetId, tab).
 * 이 스크립트를 배포한 계정이 편집 권한을 가진 시트만 쓸 수 있다.
 *
 * 설치 방법
 *  1. 구글 시트를 하나 만들고 확장 프로그램 → Apps Script 를 연다
 *     (어느 시트에 붙여도 상관없다. openById로 대상을 직접 지정하므로
 *      붙여둔 시트는 스크립트를 담는 그릇 역할만 한다)
 *  2. 이 파일 내용을 통째로 붙여넣는다
 *  3. 아래 SECRET을 길고 무작위한 문자열로 바꾼다
 *  4. 배포 → 새 배포 → 유형: 웹 앱
 *       - 실행 계정: 나
 *       - 액세스 권한: 모든 사용자
 *     openById는 "모든 스프레드시트" 권한을 요구하므로 승인 화면이 한 번 더 뜬다
 *  5. 발급된 /exec URL과 SECRET을 Supabase Edge Function 시크릿에 등록한다
 *       SHEETS_WEBHOOK_URL    = https://script.google.com/macros/s/..../exec
 *       SHEETS_WEBHOOK_SECRET = 3번에서 정한 문자열
 *
 * 동작
 *  - 지정된 탭이 없으면 새로 만든다
 *  - 항목이 추가되면 헤더에 열을 자동으로 덧붙인다 (기존 데이터는 그대로)
 *  - mode 'append' : 측정 양식 — 제출할 때마다 새 줄
 *  - mode 'upsert' : 체크리스트 — rowKey가 같은 줄이 있으면 덮어쓰고, 없으면 추가
 *                    (같은 날 값을 고쳐도 줄이 늘지 않는다)
 */

var SECRET = 'CHANGE_ME'

var KEY_COLUMN = '_key'   // upsert용 숨김 열
var DATE_COLUMN = '제출일시'
var USER_COLUMN = '입력자'
var SAVED_COLUMN = '최종 저장일시'   // 체크리스트 전용 — 그날 마지막으로 값을 저장한 시각

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents)

    if (body.secret !== SECRET) {
      return reply({ error: 'unauthorized' })
    }
    if (!body.spreadsheetId) {
      return reply({ error: 'spreadsheetId가 없습니다' })
    }

    var ss
    try {
      ss = SpreadsheetApp.openById(body.spreadsheetId)
    } catch (openErr) {
      return reply({ error: '시트를 열 수 없습니다. 이 스크립트를 배포한 계정에 편집 권한이 있는지 확인하세요.' })
    }

    var isUpsert = body.mode === 'upsert' && body.rowKey
    var tabName = String(body.tab || body.form || '측정').substring(0, 90)
    var sheet = ss.getSheetByName(tabName)

    if (!sheet) {
      sheet = ss.insertSheet(tabName)
      sheet.appendRow([DATE_COLUMN, USER_COLUMN])
      sheet.setFrozenRows(1)
      sheet.getRange(1, 1, 1, 2).setFontWeight('bold')
    }

    var headers = readHeaders(sheet)

    headers = ensureColumn(sheet, headers, DATE_COLUMN)
    headers = ensureColumn(sheet, headers, USER_COLUMN)
    if (body.lastSavedAt) {
      headers = ensureColumn(sheet, headers, SAVED_COLUMN)
    }

    var incoming = body.values || []
    for (var i = 0; i < incoming.length; i++) {
      headers = ensureColumn(sheet, headers, columnName(incoming[i]))
    }

    if (isUpsert) {
      headers = ensureColumn(sheet, headers, KEY_COLUMN)
      sheet.hideColumns(headers.indexOf(KEY_COLUMN) + 1)
    }

    // 헤더 순서에 맞춰 한 줄 구성
    var row = []
    for (var c = 0; c < headers.length; c++) row.push('')

    row[headers.indexOf(DATE_COLUMN)] = body.submittedAt ? new Date(body.submittedAt) : new Date()
    row[headers.indexOf(USER_COLUMN)] = body.submittedBy || ''
    if (body.lastSavedAt) {
      row[headers.indexOf(SAVED_COLUMN)] = new Date(body.lastSavedAt)
    }

    for (var j = 0; j < incoming.length; j++) {
      var idx = headers.indexOf(columnName(incoming[j]))
      if (idx !== -1) row[idx] = incoming[j].value
    }

    if (isUpsert) {
      row[headers.indexOf(KEY_COLUMN)] = body.rowKey
      var existing = findRowByKey(sheet, headers.indexOf(KEY_COLUMN) + 1, body.rowKey)
      if (existing > 0) {
        sheet.getRange(existing, 1, 1, row.length).setValues([row])
        return reply({ ok: true, tab: tabName, row: existing, updated: true })
      }
    }

    sheet.appendRow(row)
    return reply({ ok: true, tab: tabName, row: sheet.getLastRow(), updated: false })
  } catch (err) {
    return reply({ error: String(err) })
  }
}

function readHeaders(sheet) {
  var lastCol = sheet.getLastColumn()
  if (lastCol < 1) return []
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String)
}

/** 헤더에 없는 열이면 끝에 추가하고 갱신된 헤더 배열을 돌려준다 */
function ensureColumn(sheet, headers, name) {
  if (headers.indexOf(name) !== -1) return headers
  headers.push(name)
  sheet.getRange(1, headers.length).setValue(name).setFontWeight('bold')
  return headers
}

/** rowKey가 일치하는 행 번호를 찾는다. 없으면 0 */
function findRowByKey(sheet, keyCol, rowKey) {
  var lastRow = sheet.getLastRow()
  if (lastRow < 2) return 0
  var keys = sheet.getRange(2, keyCol, lastRow - 1, 1).getValues()
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === String(rowKey)) return i + 2
  }
  return 0
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
