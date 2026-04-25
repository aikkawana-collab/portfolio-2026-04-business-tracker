/**
 * 業績管理アプリ — Google Apps Script バックエンド
 * REQUIREMENTS.md v4.0.1 準拠
 */

// ==========================================================
// Initial Setup (手動で 1 回だけ Apps Script エディタから実行)
// ==========================================================

/**
 * 初回セットアップ
 *
 * Apps Script エディタで `setupInitialData` を選択 → 実行ボタンをクリック → 完了。
 *
 * 実行内容:
 *  1. Google スプレッドシート「予約台帳」を新規作成
 *  2. records シートに 12 列のヘッダを設置（Protect Range）
 *  3. ScriptProperties に SPREADSHEET_ID と CALENDAR_ID を自動登録
 *
 * 2 回目以降の実行は無視される（既にセットアップ済み）。
 */
function setupInitialData() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty('SPREADSHEET_ID');
  if (existingId) {
    console.log('既にセットアップ済み: SPREADSHEET_ID=' + existingId);
    try {
      const ss = SpreadsheetApp.openById(existingId);
      console.log('スプシ URL: ' + ss.getUrl());
    } catch (e) {
      console.warn('保存されている ID のスプシが見つかりません。プロパティを削除して再実行してください。', e);
    }
    return;
  }

  const ss = SpreadsheetApp.create('予約台帳');
  const sheet = ss.getActiveSheet();
  sheet.setName('records');

  const headers = [
    '受付ID', '登録日時', '実施日', '開始時刻', '終了時刻', '時間未定',
    '依頼内容', '依頼元', '会場場所', 'ステータス', '報酬種別', 'CalendarイベントID'
  ];
  sheet.getRange(1, 1, 1, 12).setValues([headers]);
  sheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#f3f4f6');
  sheet.setFrozenRows(1);

  // 列幅調整
  [120, 140, 100, 80, 80, 80, 250, 180, 180, 100, 80, 200].forEach(function(w, i) {
    sheet.setColumnWidth(i + 1, w);
  });

  // ヘッダ行保護
  try {
    const protection = sheet.getRange('A1:L1').protect().setDescription('ヘッダ保護');
    protection.addEditor(Session.getEffectiveUser());
    protection.removeEditors(protection.getEditors());
    if (protection.canDomainEdit()) protection.setDomainEdit(false);
  } catch (e) {
    console.warn('ヘッダ保護設定失敗（続行）', e);
  }

  props.setProperty('SPREADSHEET_ID', ss.getId());
  props.setProperty('CALENDAR_ID', 'primary');

  console.log('✅ セットアップ完了');
  console.log('SPREADSHEET_ID: ' + ss.getId());
  console.log('スプシ URL: ' + ss.getUrl());
  console.log('CALENDAR_ID: primary (getDefaultCalendar を使用)');
  console.log('');
  console.log('次のステップ: デプロイ済み Web App URL にスマホでアクセスしてください。');
}

/**
 * 動作確認用ヘルスチェック関数
 * 実行することで権限同意フローが開始されます。
 */
function healthCheck() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty('SPREADSHEET_ID');
  const calendarId = props.getProperty('CALENDAR_ID');

  console.log('=== Health Check ===');
  console.log('SPREADSHEET_ID: ' + (spreadsheetId || '(未設定 → setupInitialData を先に実行)'));
  console.log('CALENDAR_ID: ' + (calendarId || '(未設定)'));

  if (spreadsheetId) {
    try {
      const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('records');
      console.log('records シート行数: ' + sheet.getLastRow());
    } catch (e) {
      console.error('スプシアクセス失敗', e);
    }
  }

  try {
    const cal = getTargetCalendar();
    console.log('Calendar 名: ' + (cal ? cal.getName() : '取得不可'));
  } catch (e) {
    console.error('Calendar アクセス失敗', e);
  }
}

/**
 * 診断関数: スプシの中身と getMonthRecords の動作を詳細出力
 * Apps Script エディタから実行してログを確認してください
 */
function debugSheet() {
  try {
    const sheet = getRecordsSheet();
    const data = sheet.getDataRange().getValues();
    console.log('=== debugSheet ===');
    console.log('Total rows (含ヘッダ): ' + data.length);
    console.log('Sheet Name: ' + sheet.getName());
    console.log('Sheet TZ: ' + sheet.getParent().getSpreadsheetTimeZone());
    console.log('Script TZ: ' + Session.getScriptTimeZone());

    for (let i = 0; i < Math.min(data.length, 6); i++) {
      console.log('--- Row ' + (i + 1) + ' ---');
      const row = data[i];
      for (let j = 0; j < row.length; j++) {
        const v = row[j];
        const typeLabel = v instanceof Date ? 'Date' : typeof v;
        const colLabel = String.fromCharCode(65 + j);
        let extra = '';
        if (v instanceof Date) {
          extra = ' → JST YMD=' + Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm') +
                  ', localGetYear=' + v.getFullYear() +
                  ', localGetMonth+1=' + (v.getMonth() + 1) +
                  ', localGetDate=' + v.getDate();
        }
        console.log('  ' + colLabel + '(' + j + ') [' + typeLabel + '] = ' + v + extra);
      }
    }

    // getMonthRecords を現在の月で呼び出す
    const now = new Date();
    const year = parseInt(Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy'));
    const month = parseInt(Utilities.formatDate(now, 'Asia/Tokyo', 'MM'));
    console.log('=== getMonthRecords(' + year + ', ' + month + ') ===');
    const records = getMonthRecords(year, month);
    console.log('取得件数: ' + records.length);
    records.forEach(function(r, idx) {
      console.log('  [' + idx + '] ' + r.scheduledDate + ' ' + r.startTime + '-' + r.endTime + ' ' + r.requestContent + ' / status=' + r.status);
    });
  } catch (e) {
    console.error('debugSheet error', e);
  }
}

// ==========================================================
// Entry Point
// ==========================================================

/**
 * Web App エントリポイント
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle('本アプリ 業績記録')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * HTML 分割用ヘルパー（将来用、未使用）
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ==========================================================
// Utility
// ==========================================================

/**
 * 対象カレンダーを取得。
 * CALENDAR_ID が 'primary' または空のとき getDefaultCalendar() を使う。
 * getCalendarById('primary') は null を返すため使用禁止。
 */
function getTargetCalendar() {
  const id = PropertiesService.getScriptProperties().getProperty('CALENDAR_ID');
  if (!id || id === 'primary') {
    return CalendarApp.getDefaultCalendar();
  }
  return CalendarApp.getCalendarById(id);
}

/**
 * records シートを取得
 */
function getRecordsSheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error('SPREADSHEET_ID が ScriptProperties に設定されていません');
  }
  const ss = SpreadsheetApp.openById(id);
  const sheet = ss.getSheetByName('records');
  if (!sheet) {
    throw new Error('records シートが見つかりません');
  }
  return sheet;
}

/**
 * UUID 生成
 */
function generateUUID() {
  return Utilities.getUuid();
}

/**
 * 所要時間文字列 → 分数変換
 */
function durationToMinutes(duration) {
  const map = {
    '30min': 30,
    '1h': 60,
    '1.5h': 90,
    '2h': 120,
    '3h': 180,
    'half': 240,
    'full': 480
  };
  return map[duration] || 60;
}

/**
 * HH:mm + 分数 → HH:mm
 * 翌日跨ぎは 23:59 にクランプ（個人利用で 1 日内完結の前提）
 */
function addMinutesToTime(time, minutes) {
  const parts = time.split(':').map(Number);
  const total = parts[0] * 60 + parts[1] + minutes;
  if (total >= 1440) {
    // 翌日跨ぎは許容しない → 23:59 にクランプ
    return '23:59';
  }
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

/**
 * 入力バリデーション → エラーメッセージ配列
 */
function validateInput(input) {
  const errors = [];
  if (!input) {
    errors.push('入力がありません');
    return errors;
  }
  if (!input.scheduledDate) errors.push('実施日は必須です');
  if (!input.requestContent || !String(input.requestContent).trim()) errors.push('依頼内容は必須です');
  if (!input.requester || !String(input.requester).trim()) errors.push('依頼元は必須です');
  if (!input.location || !String(input.location).trim()) errors.push('会場場所は必須です');
  if (!input.paymentType || ['有償', '無償'].indexOf(input.paymentType) === -1) errors.push('報酬種別は 有償 / 無償 のいずれかです');

  if (!input.timeUndefined) {
    if (!input.startTime) errors.push('開始時刻は必須です（時間未定でない場合）');
    else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) errors.push('開始時刻は HH:mm 形式です');
    if (!input.duration) errors.push('所要時間は必須です（時間未定でない場合）');
  }

  if (input.requestContent && String(input.requestContent).length > 500) errors.push('依頼内容は 500 文字以内');
  if (input.requester && String(input.requester).length > 100) errors.push('依頼元は 100 文字以内');
  if (input.location && String(input.location).length > 200) errors.push('会場場所は 200 文字以内');

  return errors;
}

/**
 * Date または文字列を JST の YYYY-MM-DD 文字列に変換
 * - Date: Utilities.formatDate で JST 固定変換
 * - 文字列: YYYY-MM-DD が先頭にある場合はそれを抽出
 * - その他: null
 */
function formatDateYMD(d) {
  if (!d) return null;
  if (d instanceof Date) {
    return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
  }
  if (typeof d === 'string') {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
  }
  return null;
}

/**
 * Date オブジェクトを JST で YYYY-MM-DD HH:mm:ss 文字列に変換
 */
function formatDateTime(d) {
  if (!d || !(d instanceof Date)) return null;
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
}

/**
 * 時刻セル値を HH:mm 文字列に正規化
 * - Date: JST HH:mm 抽出
 * - string: HH:mm 部分抽出
 * - その他: 空文字
 */
function formatTimeValue(v) {
  if (!v) return '';
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'Asia/Tokyo', 'HH:mm');
  }
  const s = String(v);
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    return String(m[1]).padStart(2, '0') + ':' + m[2];
  }
  return '';
}

/**
 * 比較用の文字列正規化（trim のみ）
 */
function normalizeString(s) {
  return String(s || '').trim();
}

/**
 * 日付文字列 YYYY-MM-DD → Date オブジェクト（Asia/Tokyo 00:00）
 */
function parseDate(ymd) {
  const parts = ymd.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  return d;
}

/**
 * 日付と HH:mm から Date 生成
 */
function combineDateTime(date, hhmm) {
  const parts = hhmm.split(':').map(Number);
  const d = new Date(date);
  d.setHours(parts[0], parts[1], 0, 0);
  return d;
}

// ==========================================================
// Read
// ==========================================================

/**
 * 指定月（1-12）の active レコードを取得
 */
function getMonthRecords(year, month) {
  try {
    const sheet = getRecordsSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();

    const targetPrefix = year + '-' + String(month).padStart(2, '0');
    const records = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const status = row[9];
      if (status !== 'active') continue;

      const scheduledYMD = formatDateYMD(row[2]);
      if (!scheduledYMD) continue;
      if (scheduledYMD.substring(0, 7) !== targetPrefix) continue;

      records.push({
        rowIndex: i + 2,
        reservationId: row[0],
        registeredAt: formatDateTime(row[1]),
        scheduledDate: scheduledYMD,
        startTime: formatTimeValue(row[3]),
        endTime: formatTimeValue(row[4]),
        timeUndefined: Boolean(row[5]),
        requestContent: String(row[6] || ''),
        requester: String(row[7] || ''),
        location: String(row[8] || ''),
        status: String(row[9] || ''),
        paymentType: String(row[10] || ''),
        calendarEventId: String(row[11] || '')
      });
    }
    return records;
  } catch (e) {
    console.error('getMonthRecords error', e);
    throw e;
  }
}

/**
 * 受付ID で 1 件取得
 */
function getRecord(id) {
  try {
    const sheet = getRecordsSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;

    const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[0] === id) {
        return {
          rowIndex: i + 2,
          reservationId: row[0],
          registeredAt: formatDateTime(row[1]),
          scheduledDate: formatDateYMD(row[2]),
          startTime: formatTimeValue(row[3]),
          endTime: formatTimeValue(row[4]),
          timeUndefined: Boolean(row[5]),
          requestContent: String(row[6] || ''),
          requester: String(row[7] || ''),
          location: String(row[8] || ''),
          status: String(row[9] || ''),
          paymentType: String(row[10] || ''),
          calendarEventId: String(row[11] || '')
        };
      }
    }
    return null;
  } catch (e) {
    console.error('getRecord error', e);
    throw e;
  }
}

// ==========================================================
// Create
// ==========================================================

/**
 * 新規予約登録
 * Calendar → Sheets の順で書き込み、Sheets 失敗時は Calendar をロールバック
 */
function createRecord(input) {
  try {
    const errors = validateInput(input);
    if (errors.length > 0) {
      return { success: false, error: 'VALIDATION', messages: errors };
    }

    const reservationId = generateUUID();
    const scheduledDate = parseDate(input.scheduledDate);
    const cal = getTargetCalendar();
    if (!cal) {
      return { success: false, error: 'CALENDAR_NOT_FOUND', message: 'カレンダーが取得できませんでした' };
    }

    const title = input.requestContent + ' - ' + input.requester;
    const description = '受付ID: ' + reservationId + '\n報酬: ' + input.paymentType;

    let event;
    let endTime = '';
    try {
      if (input.timeUndefined) {
        event = cal.createAllDayEvent(title, scheduledDate);
      } else {
        endTime = addMinutesToTime(input.startTime, durationToMinutes(input.duration));
        const startDt = combineDateTime(scheduledDate, input.startTime);
        const endDt = combineDateTime(scheduledDate, endTime);
        event = cal.createEvent(title, startDt, endDt);
      }
      event.setLocation(input.location);
      event.setDescription(description);
    } catch (calError) {
      console.error('Calendar作成失敗', calError);
      return { success: false, error: 'CALENDAR_CREATE_FAILED', message: String(calError) };
    }

    const eventId = event.getId();

    try {
      const sheet = getRecordsSheet();
      sheet.appendRow([
        reservationId,
        new Date(),
        scheduledDate,
        input.timeUndefined ? '' : input.startTime,
        input.timeUndefined ? '' : endTime,
        Boolean(input.timeUndefined),
        input.requestContent,
        input.requester,
        input.location,
        'active',
        input.paymentType,
        eventId
      ]);
      SpreadsheetApp.flush();
    } catch (sheetError) {
      console.error('Sheets追記失敗、Calendarロールバック開始', sheetError);
      try {
        const ev = cal.getEventById(eventId);
        if (ev) {
          ev.deleteEvent();
        } else {
          throw new Error('getEventById returned null');
        }
      } catch (rollbackError) {
        console.error('CALENDAR_ORPHAN: reservationId=' + reservationId + ', eventId=' + eventId, rollbackError);
        return {
          success: false,
          error: 'CALENDAR_ORPHAN',
          message: 'Sheets登録に失敗し、Calendar削除にも失敗しました。手動でカレンダーから以下のイベントを削除してください。',
          orphanEventId: eventId
        };
      }
      return { success: false, error: 'SHEETS_FAILED', message: String(sheetError) };
    }

    return { success: true, reservationId: reservationId };
  } catch (e) {
    console.error('createRecord error', e);
    return { success: false, error: 'UNKNOWN', message: String(e) };
  }
}

// ==========================================================
// Update
// ==========================================================

/**
 * 既存予約の更新
 * 終日⇄時刻変換時は deleteEvent + createEvent で L 列 eventId を更新
 */
function updateRecord(id, newData) {
  try {
    const errors = validateInput(newData);
    if (errors.length > 0) {
      return { success: false, error: 'VALIDATION', messages: errors };
    }

    const existing = getRecord(id);
    if (!existing) {
      return { success: false, error: 'NOT_FOUND', message: '対象の予約が見つかりません' };
    }

    const cal = getTargetCalendar();
    if (!cal) {
      return { success: false, error: 'CALENDAR_NOT_FOUND' };
    }

    const scheduledDate = parseDate(newData.scheduledDate);
    const title = newData.requestContent + ' - ' + newData.requester;
    const description = '受付ID: ' + id + '\n報酬: ' + newData.paymentType;

    let currentEvent = null;
    try {
      currentEvent = cal.getEventById(existing.calendarEventId);
    } catch (e) {
      currentEvent = null;
    }

    const wasAllDay = Boolean(existing.timeUndefined);
    const willBeAllDay = Boolean(newData.timeUndefined);

    let newEventId = existing.calendarEventId;
    let endTime = '';

    if (wasAllDay !== willBeAllDay || !currentEvent) {
      // 終日⇄時刻変換、または既存イベント消失 → delete + create
      if (currentEvent) {
        try {
          currentEvent.deleteEvent();
        } catch (e) {
          console.warn('既存イベント削除失敗（続行）', e);
        }
      }

      let newEvent;
      try {
        if (willBeAllDay) {
          newEvent = cal.createAllDayEvent(title, scheduledDate);
        } else {
          endTime = addMinutesToTime(newData.startTime, durationToMinutes(newData.duration));
          const startDt = combineDateTime(scheduledDate, newData.startTime);
          const endDt = combineDateTime(scheduledDate, endTime);
          newEvent = cal.createEvent(title, startDt, endDt);
        }
        newEvent.setLocation(newData.location);
        newEvent.setDescription(description);
      } catch (calError) {
        console.error('updateRecord: Calendar再作成失敗', calError);
        return { success: false, error: 'CALENDAR_CREATE_FAILED', message: String(calError) };
      }
      newEventId = newEvent.getId();
    } else {
      // 同型の遷移 → update in place
      try {
        currentEvent.setTitle(title);
        currentEvent.setLocation(newData.location);
        currentEvent.setDescription(description);
        if (!willBeAllDay) {
          endTime = addMinutesToTime(newData.startTime, durationToMinutes(newData.duration));
          const startDt = combineDateTime(scheduledDate, newData.startTime);
          const endDt = combineDateTime(scheduledDate, endTime);
          currentEvent.setTime(startDt, endDt);
        }
      } catch (calError) {
        console.error('updateRecord: Calendar更新失敗', calError);
        return { success: false, error: 'CALENDAR_UPDATE_FAILED', message: String(calError) };
      }
    }

    try {
      const sheet = getRecordsSheet();
      const rowIndex = existing.rowIndex;
      sheet.getRange(rowIndex, 3).setValue(scheduledDate);
      sheet.getRange(rowIndex, 4).setValue(willBeAllDay ? '' : newData.startTime);
      sheet.getRange(rowIndex, 5).setValue(willBeAllDay ? '' : endTime);
      sheet.getRange(rowIndex, 6).setValue(willBeAllDay);
      sheet.getRange(rowIndex, 7).setValue(newData.requestContent);
      sheet.getRange(rowIndex, 8).setValue(newData.requester);
      sheet.getRange(rowIndex, 9).setValue(newData.location);
      sheet.getRange(rowIndex, 11).setValue(newData.paymentType);
      sheet.getRange(rowIndex, 12).setValue(newEventId);
    } catch (sheetError) {
      console.error('updateRecord: Sheets更新失敗', sheetError);
      // 終日⇄時刻変換で新規 eventId が作られた場合は、orphan 防止のためロールバック
      if (newEventId !== existing.calendarEventId) {
        try {
          const newEv = cal.getEventById(newEventId);
          if (newEv) newEv.deleteEvent();
          console.warn('updateRecord: 新規 Calendar イベントを削除（Sheets失敗ロールバック）eventId=' + newEventId);
        } catch (rbErr) {
          console.error('updateRecord: ロールバックも失敗 eventId=' + newEventId, rbErr);
          return {
            success: false,
            error: 'CALENDAR_ORPHAN',
            message: 'Sheets更新に失敗し、新規Calendar作成のロールバックにも失敗しました。',
            orphanEventId: newEventId
          };
        }
      }
      return { success: false, error: 'SHEETS_UPDATE_FAILED', message: String(sheetError) };
    }

    return { success: true };
  } catch (e) {
    console.error('updateRecord error', e);
    return { success: false, error: 'UNKNOWN', message: String(e) };
  }
}

// ==========================================================
// Delete
// ==========================================================

/**
 * 予約削除
 * Calendar は完全削除、Sheets は論理削除（status=cancelled）
 */
function deleteRecord(id) {
  try {
    const existing = getRecord(id);
    if (!existing) {
      return { success: false, error: 'NOT_FOUND' };
    }

    const cal = getTargetCalendar();
    try {
      if (cal) {
        const event = cal.getEventById(existing.calendarEventId);
        if (event) event.deleteEvent();
      }
    } catch (e) {
      console.error('Calendar削除失敗: eventId=' + existing.calendarEventId, e);
      // Sheets 論理削除は継続
    }

    try {
      const sheet = getRecordsSheet();
      sheet.getRange(existing.rowIndex, 10).setValue('cancelled');
    } catch (sheetError) {
      console.error('deleteRecord: Sheets更新失敗', sheetError);
      return { success: false, error: 'SHEETS_UPDATE_FAILED', message: String(sheetError) };
    }

    return { success: true };
  } catch (e) {
    console.error('deleteRecord error', e);
    return { success: false, error: 'UNKNOWN', message: String(e) };
  }
}

// ==========================================================
// Consistency Check (手動起動)
// ==========================================================

/**
 * 指定月の各レコードについて Calendar と Sheets の整合性を確認
 * 結果は CacheService に 5 分キャッシュ
 */
function checkConsistency(year, month) {
  try {
    const cacheKey = 'consistency_' + year + '_' + month;
    const cache = CacheService.getUserCache();
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const records = getMonthRecords(year, month);
    const cal = getTargetCalendar();
    if (!cal) return [];

    const results = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      results.push(checkSingleRecord(r, cal));
    }

    cache.put(cacheKey, JSON.stringify(results), 300);
    return results;
  } catch (e) {
    console.error('checkConsistency error', e);
    return [];
  }
}

/**
 * 単一レコードの整合性チェック
 */
function checkSingleRecord(r, cal) {
  let event = null;
  try {
    event = cal.getEventById(r.calendarEventId);
  } catch (e) {
    event = null;
  }

  if (!event) {
    return {
      reservationId: r.reservationId,
      status: 'calendar_deleted',
      warning: 'Googleカレンダーで削除済み'
    };
  }

  const expectedTitle = r.requestContent + ' - ' + r.requester;
  const expectedLocation = normalizeString(r.location);

  const actualTitle = normalizeString(event.getTitle());
  const actualLocation = normalizeString(event.getLocation());

  const reasons = [];

  if (normalizeString(expectedTitle) !== actualTitle) reasons.push('タイトル');
  if (expectedLocation !== actualLocation) reasons.push('場所');

  if (event.isAllDayEvent()) {
    if (r.scheduledDate) {
      // r.scheduledDate は YYYY-MM-DD 文字列
      const expectedKey = r.scheduledDate;
      const actualKey = formatDateYMD(event.getAllDayStartDate());
      if (expectedKey !== actualKey) reasons.push('日付');
    }
  } else {
    if (r.startTime && r.endTime && r.scheduledDate) {
      const scheduledDate = parseDate(r.scheduledDate);
      const expectedStart = combineDateTime(scheduledDate, r.startTime);
      const expectedEnd = combineDateTime(scheduledDate, r.endTime);
      if (event.getStartTime().getTime() !== expectedStart.getTime()) reasons.push('開始時刻');
      if (event.getEndTime().getTime() !== expectedEnd.getTime()) reasons.push('終了時刻');
    }
  }

  if (reasons.length > 0) {
    return {
      reservationId: r.reservationId,
      status: 'calendar_modified',
      warning: 'Googleカレンダーで変更あり (' + reasons.join(', ') + ')'
    };
  }

  return { reservationId: r.reservationId, status: 'ok' };
}
