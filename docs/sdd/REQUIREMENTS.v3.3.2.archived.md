# 要件定義書 v3.3 — 業績管理アプリ

**プロダクト名**: 業績管理アプリ
**バージョン**: 3.3.0（最終版）
**作成日**: 2026-04-19
**作成者**: Kenta Kawana (<email>)
**前版**: `REQUIREMENTS.v2.1.archived.md`（Next.js 版、廃止）

## 改訂履歴
| Ver | 変更内容 |
|-----|---------|
| 3.0 | GAS + HTML Service の最小構成にスコープ再定義（v2.1 全面差し替え） |
| 3.1 | CRUD 拡張、ミニカレンダー UI 追加 |
| 3.2 | 報酬種別・論理削除・整合性警告追加 |
| 3.3 | QA/POレビュー指摘 19 件反映: QUERY式2件修正 / 列数整合 / 金額列追加 / サジェスト追加 / LockService / ScriptProperties / ロールバック補償 / 時間未定変換ロジック / CacheService による整合性チェック性能改善 / バックアップ戦略 / ログ管理 / PWA manifest 更新 / 成功指標明確化 |
| 3.3.1 | v3.3 最終検証指摘 6 件反映: `createAllDayEvent` のシグネチャ訂正（event 取得後に setDescription 等を別途呼出）/ バックアップを `DriveApp.makeCopy` でスプシ全体複製に統一 / 工数合計を 24h に丸め / `tryLock` 失敗時 `LOCK_TIMEOUT` 応答明記 / `manifest.webmanifest` の `doGet` 分岐配信方式明記 / `mobile-web-app-capable` 併記 |
| **3.3.2** | **v3.3.1 最終検証指摘 4 件反映**: 工数内訳実計算 25h に訂正 / §18 変更点サマリー整合 / BACKUP_FOLDER_ID と ALERT_EMAIL を ScriptProperties 管理に追加 / updateRecord 内で報酬無償化時の金額列クリアをサーバ側担保（AC-22） |

---

## 1. 目的

個人事業の業績を、スマートフォンから手軽に記録・管理・集計するための Web アプリを構築する。

- フォーム入力と同時に **Google カレンダー**に予定を登録
- 同じ内容を **Google スプレッドシート**にも記録
- **ミニカレンダー UI** で視覚的に実施状況を把握
- 編集・削除も本アプリから実行
- 月次・年次の業績集計はスプシの標準機能で対応

---

## 2. 利用条件

| 項目 | 内容 |
|------|------|
| 利用者 | 本人 1 名のみ |
| アカウント | 個人 Google アカウント（Workspace 非使用） |
| 入力環境 | スマートフォン（iOS / Android）主体、PC ブラウザも可 |
| 想定件数 | 月 10 件程度 |
| 月額コスト | $0 |
| 拡張性 | 考慮しない（必要時に都度対応） |

---

## 3. スコープ

### In Scope（Must）

| ID | 要件 |
|----|------|
| F-1 | ミニカレンダー UI（月ビュー + 選択日の予定リスト） |
| F-2 | 新規登録（時間未定も可） |
| F-3 | 既存予定の編集 |
| F-4 | 削除（Calendar 完全削除 + Sheets 論理削除 `cancelled`） |
| F-5 | Google Calendar と Sheets の同時反映（Compensating Rollback 対応） |
| F-6 | スマホ最適化 UI |
| F-7 | 依頼元・会場場所の過去入力サジェスト（表記ゆれ防止） |
| F-8 | 金額入力（任意、業績集計用） |

### In Scope（Should）

| ID | 要件 |
|----|------|
| F-9 | 整合性警告表示（**手動リフレッシュボタン方式**、初期ロード時は実行しない） |

### Out of Scope

- ダッシュボード自動生成（スプシのピボット・関数で対応）
- 通知機能
- 複数ユーザー対応
- 自動テスト（手動チェックリストで対応）
- 繰り返し予定
- 受付日と実施日の区別（登録日時 B 列で代用）
- 実施後の成果メモ欄（将来必要時に追加）

---

## 4. 入力項目

| # | 項目 | 必須 | 入力形式 | 例 |
|---|------|-----|---------|-----|
| 1 | 実施日 | ✅ | date ピッカー | 2026-04-25 |
| 2 | 時間未定トグル | — | checkbox | ✅ / ☐ |
| 3 | 開始時刻 | ※ | time ピッカー | 14:00 |
| 4 | 所要時間 | ※ | select | 30分 / 1時間 / 1.5時間 / 2時間 / 3時間 / 半日(4h) / 終日 |
| 5 | 依頼内容 | ✅ | textarea | Web打合せ |
| 6 | 依頼元 | ✅ | text + `<datalist>` サジェスト | 〇〇株式会社 |
| 7 | 会場場所 | ✅ | text + `<datalist>` サジェスト | オンライン |
| 8 | 報酬種別 | ✅ | radio | 有償 / 無償 |
| 9 | 金額 | 任意 | number（JPY、税込整数） | 50000（無償時は非活性＆自動クリア） |

※ **時間未定トグル**が ON のときは 3・4 は非活性（Calendar に終日イベントとして登録）

### 4.1 サジェスト機能（F-7）

- `<datalist>` を使用、**過去 90 日分**（想定 30 件前後、実用的に十分な表記ゆれ検出範囲）の `records` シートから該当列のユニーク値を取得
- CacheService で 5 分間キャッシュ（コールドスタート対策）
- **新規値の即時反映**: `createRecord` / `updateRecord` 成功時にキャッシュを明示的に invalidate（`CacheService.remove(key)`）し、次回フォーム表示で新規値が候補に出るようにする
- 表記ゆれ例（「〇〇株式会社」と「○○株式会社」）を抑制し、ピボット集計の信頼性を確保

---

## 5. 画面構成

### 5.1 メイン画面（一覧）

```
┌────────────────────────────┐
│     << 2026年 4月 >>   [今日] │  ← ミニカレンダー月切替
│  月 火 水 木 金 土 日          │
│         1  2  3  4  5          │
│  6  7  8  •9 10 11 12          │  ← 予定のある日に「●」
│ 13 14 15 16 17[•18]19 20       │  ← 選択中の日は枠
│ 21 22 23 •24 25 26 27          │
│ 28 29 30                       │
├────────────────────────────┤
│ 📅 4/18（金）の予定  [🔄 整合性]│  ← 整合性チェック手動起動
│ ┌──────────────────────────┐ │
│ │ 14:00-15:00              │ │
│ │ Web打合せ - 〇〇株式会社 │ │
│ │ 📍 オンライン 💰有償¥50,000 │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ ⏰ 時間未定              │ │
│ │ 撮影 - 佐藤様            │ │
│ │ 📍 スタジオA 💰有償       │ │
│ └──────────────────────────┘ │
│                                │
│ [＋ 4/18 に追加]                │  ← 下部固定
└────────────────────────────┘
```

**整合性チェック**: `[🔄 整合性]` ボタン押下時のみ全件 Calendar API 呼出（`CacheService` で 5 分結果保持）。初期ロード時は実行しない（NFR-P-01 3 秒制約遵守）。

### 5.2 新規登録／編集画面

```
┌────────────────────────────┐
│ [← 戻る]   新規登録 / 編集     │
├────────────────────────────┤
│ 📅 実施日  [2026-04-18  ▼]    │
│ [✓] 時間未定                   │
│ ⏰ 開始    [  :  ] (灰色時)    │
│ ⏱ 時間    [1時間 ▼] (灰色時)   │
│ 💼 依頼内容 [___________]      │
│ 🏢 依頼元   [_____] (サジェスト)│
│ 📍 会場場所 [_____] (サジェスト)│
│ 💰 報酬種別                    │
│   ( ) 有償  ( ) 無償           │
│ 💴 金額     [_____] 円 (任意)  │  ← 無償選択時は非活性＆値クリア
├────────────────────────────┤
│ [ 登録する / 更新する ]         │  ← 下部固定
│ （編集時のみ）[ 削除する ]       │
└────────────────────────────┘
```

---

## 6. データモデル

### 6.1 スプレッドシート `records` シート（**14 列**）

| 列 | 項目 | 型 | 例 | 用途 |
|----|------|-----|-----|------|
| A | 受付ID | UUID（`Utilities.getUuid()`） | `a3f9-...` | 内部管理 |
| B | 登録日時 | datetime | `2026-04-19 14:30:00` | 履歴・受付日代替 |
| C | 最終更新日時 | datetime | `2026-04-19 16:00:00` | 履歴 |
| D | 実施日 | date | `2026-04-25` | **集計軸** |
| E | 開始時刻 | HH:mm（空欄可） | `14:00` | 表示 |
| F | 終了時刻 | HH:mm（空欄可） | `15:00` | 表示 |
| G | 時間未定 | bool | `TRUE` / `FALSE` | 表示制御 |
| H | 依頼内容 | text | `Web打合せ` | **集計軸** |
| I | 依頼元 | text | `〇〇株式会社` | **集計軸** |
| J | 会場場所 | text | `オンライン` | **集計軸** |
| K | ステータス | `active` / `cancelled` | `active` | **集計軸**（実施率） |
| L | 報酬種別 | `有償` / `無償` | `有償` | **集計軸** |
| **M** | **金額** | number（JPY税込、空欄可） | `50000` | **集計軸（売上総額）** |
| N | CalendarイベントID | string | Google 返却値 | 整合性管理 |

→ ヘッダ行は Protect Range で手動編集防止

### 6.2 Google Calendar イベント

| 要素 | 値 |
|------|-----|
| タイトル | `[依頼内容] - [依頼元]` |
| 場所 | 会場場所 |
| 説明 | `受付ID: <UUID>\n報酬: 有償/無償 ¥金額` |
| タイムゾーン | Asia/Tokyo |
| 時間未定時 | **終日イベント**（`createAllDayEvent()`） |

### 6.3 ScriptProperties（ハードコード排除）

```
SPREADSHEET_ID    = "xxxxx"    # スプシ ID
CALENDAR_ID       = "primary"  # カレンダー ID
BACKUP_FOLDER_ID  = "yyyyy"    # 日次バックアップ保存先 Drive フォルダ ID
ALERT_EMAIL       = "<email>"  # 重大エラー通知先
```

`PropertiesService.getScriptProperties().getProperty()` で参照。コード改修時も値は残る。

### 6.4 CacheService（整合性チェック高速化）

| キー | 内容 | TTL |
|------|------|------|
| `suggest_requester` | 依頼元候補リスト JSON | 300 秒（5 分） |
| `suggest_location` | 会場場所候補リスト JSON | 300 秒 |
| `consistency_check_{YYYYMM}` | 整合性結果 JSON | 300 秒 |

### 6.5 PropertiesService（Rollback 補償）

```
未処理 rollback キュー:
  UserProperties > "pending_rollbacks" = [
    { reservationId, calendarEventId, createdAt },
    ...
  ]
```

ロールバック失敗時にこのキューに追記。起動時に `reconcile()` 関数がチェックし、未処理を再試行。

---

## 7. 処理フロー

### 7.1 新規登録

```
[フォーム送信] → フロント: 必須チェック + ボタン無効化
  ↓ google.script.run.createRecord(input)
[Code.gs: createRecord()]
  ├─ const lock = LockService.getScriptLock()
  ├─ if (!lock.tryLock(5000)) return { success:false, error:'LOCK_TIMEOUT' }
  ├─ サーバ側再バリデーション
  ├─ 受付ID = Utilities.getUuid()
  ├─ 終了時刻 = 開始時刻 + 所要時間（時間未定なら null）
  ├─ Calendar 登録:
  │   - 時刻指定時: event = CalendarApp.getCalendarById(CAL_ID).createEvent(title, start, end)
  │   - 時間未定時: event = CalendarApp.getCalendarById(CAL_ID).createAllDayEvent(title, date)
  │                ※ `createAllDayEvent` は options 引数を受け付けないため、event 取得後に
  │                   event.setDescription(desc); event.setLocation(loc); を別途呼出
  ├─ sheet.appendRow([14列分])
  │   例外時 → CalendarApp.getCalendarById(CAL_ID).getEventById(eventId).deleteEvent()
  │           その削除も失敗 → UserProperties の pending_rollback キューに追加
  ├─ CacheService.remove('suggest_requester') / .remove('suggest_location')  ← F-7 即時反映
  ├─ lock.releaseLock()
  └─ return { success, reservationId }
```

### 7.2 編集

```
[カードタップ] → reservationId 取得
  ↓ getRecord(id) → 該当行取得 → フォームプリセット
  ↓ ユーザー修正 → updateRecord(id, newData)
[Code.gs: updateRecord()]
  ├─ const lock = LockService.getScriptLock()
  ├─ if (!lock.tryLock(5000)) return { success:false, error:'LOCK_TIMEOUT' }
  ├─ 既存 eventId で Calendar イベント取得
  ├─ 時間未定 → 時刻確定への遷移:
  │    終日イベントの setTime() は不可のため:
  │    ① 既存終日イベント.deleteEvent()
  │    ② createEvent() で新規作成 → 新 eventId 取得
  │    ③ event.setDescription() / setLocation() を別途呼出
  │    ④ スプシ N 列を新 eventId に更新
  ├─ 時刻指定 → 時間未定への遷移:
  │    同様に deleteEvent → createAllDayEvent → setDescription/setLocation
  ├─ 時刻/内容の単純変更:
  │    event.setTitle() / setLocation() / setTime() / setDescription()
  ├─ **報酬種別が「無償」に変更された場合、M 列（金額）を空文字で上書き**（AC-22 サーバ側担保）
  ├─ スプシ該当行を更新（C 列 最終更新日時も更新）
  ├─ CacheService.remove('suggest_requester') / .remove('suggest_location')
  ├─ lock.releaseLock()
  └─ return { success }
```

### 7.3 削除

```
[削除ボタン] → confirm("削除しますか？") → OK
  ↓ deleteRecord(id)
[Code.gs: deleteRecord()]
  ├─ const lock = LockService.getScriptLock()
  ├─ if (!lock.tryLock(5000)) return { success:false, error:'LOCK_TIMEOUT' }
  ├─ CalendarApp.getCalendarById(CAL_ID).getEventById(eventId).deleteEvent()  ← 完全削除
  │   失敗時 → pending_rollback キューに追加、スプシは更新を継続（cancelled）
  ├─ スプシ K 列を `cancelled` に更新 ← 論理削除
  ├─ lock.releaseLock()
  └─ return { success }
```

### 7.4 整合性チェック（手動起動）

```
[🔄 整合性] ボタン → checkConsistency(YYYYMM)
  ├─ CacheService.get("consistency_check_{YYYYMM}") → 5 分以内ならキャッシュ返却
  ├─ キャッシュなし: スプシから当該月の active レコード取得
  ├─ 各レコードで CalendarApp.getEventById(eventId)
  │    - 取得不可 → ⚠️「Googleカレンダーで削除済み」
  │    - タイトル/場所/時刻差異 → ⚠️「Googleカレンダーで変更あり」
  │    - 一致 → 警告なし
  ├─ 結果を CacheService.put() 300 秒
  └─ フロントに警告情報を返し、カードにバッジ描画
```

**競合解決ポリシー**: 本アプリで再編集すると本アプリ側の値で強制上書き。警告は情報提供のみで自動同期しない。

### 7.5 ロールバック補償（reconcile）

```
[doGet 実行時 or 一覧ロード時] → reconcilePendingRollbacks()
  ├─ UserProperties.getProperty("pending_rollbacks") 取得
  ├─ 各エントリで再試行:
  │    CalendarApp.getEventById(id).deleteEvent()
  │    成功: キューから除去
  │    失敗: 24h 超なら Gmail.send でアラート通知
  └─ キューを書き戻し
```

---

## 8. 技術スタック

| 層 | 技術 |
|----|------|
| UI | HTML + CSS (CSS Grid) + Vanilla JavaScript |
| 実行環境 | Google Apps Script Web App |
| 同時実行制御 | **LockService**（`ScriptLock` 5 秒 timeout、失敗時は `LOCK_TIMEOUT` エラーコード応答） |
| 設定管理 | **PropertiesService**（`ScriptProperties` / `UserProperties`） |
| キャッシュ | **CacheService**（`UserCache`、5 分 TTL、値 100KB 上限に注意。月 10 件想定なら 1KB 程度で問題なし） |
| データ | Google Sheets（個人アカウント） |
| 予定 | Google Calendar（個人アカウント） |
| バックアップ | 時限トリガー（日次スプシ複製）|
| エラー通知 | MailApp（重大エラーのみ自分のメールへ）|

**外部ライブラリ・外部インフラ不使用。**

---

## 9. セキュリティ

| 項目 | 内容 |
|------|------|
| Web App 公開設定 | 「自分のみ実行可」 |
| 実行アカウント | スクリプト所有者（自分） |
| URL 漏洩時の影響 | ゼロ（他人は Google ログインで弾かれる） |
| データ保管 | すべて個人 Google アカウント内 |
| ハードコード禁止 | SPREADSHEET_ID / CALENDAR_ID / BACKUP_FOLDER_ID / ALERT_EMAIL は ScriptProperties 管理 |
| シート保護 | `records` シートのヘッダ行を Protect Range で保護 |
| 初回同意 | Calendar / Sheets / Mail / Properties へのアクセス許可 1 回のみ |
| PII 管理 | 依頼元名は自己責任で管理（第三者提供なし） |

---

## 10. スマホ最適化要件

| 項目 | 基準 |
|------|------|
| viewport | `width=device-width, initial-scale=1`（`maximum-scale` は指定しない、アクセシビリティ配慮） |
| PWA 対応 | `manifest.webmanifest` 相当の JSON を `doGet(e)` で `e.parameter.resource === 'manifest'` 分岐配信（`ContentService.createTextOutput(JSON).setMimeType(ContentService.MimeType.JSON)`）、HTML 側で `<link rel="manifest" href="?resource=manifest">` 参照 |
| 旧 iOS 対応 | `<meta name="apple-mobile-web-app-capable" content="yes">` + `<meta name="mobile-web-app-capable" content="yes">` 併記（Chromium 系との互換性確保）、`apple-mobile-web-app-title` も設定 |
| ミニカレンダーのセル | 最小 44 × 44 px（タップ領域確保） |
| 入力フィールド高さ | 48 px 以上 |
| フォントサイズ | 16 px 以上（iOS オートズーム抑止） |
| ネイティブピッカー使用 | `type="date"` `type="time"` `select` `radio` `type="number"` |
| 下部固定ボタン | `position: sticky; bottom` |
| オフライン時 UX | 送信失敗時に「通信エラー。再送信してください」表示 + 入力値を `sessionStorage` に一時保存 |

---

## 11. 集計の実現方法（アプリ外）

月次・年次集計はスプシ標準機能で対応。`summary` シート初期作成を工数に計上（+30 分）。

| 集計 | QUERY 例 |
|------|---------|
| 月別件数 | `=QUERY(records!A:N, "SELECT MONTH(D), COUNT(A) WHERE K='active' GROUP BY MONTH(D) ORDER BY MONTH(D)", 1)` |
| 依頼元別件数 | ピボットテーブル（行: I 依頼元 / 値: A 件数） |
| 有償/無償比率 | `=COUNTIF(records!L:L,"有償")` / `=COUNTIF(records!L:L,"無償")` |
| 実施率 | `=COUNTIF(records!K:K,"active")/(COUNTA(records!A:A)-1)` |
| 月別売上総額 | `=QUERY(records!A:N, "SELECT MONTH(D), SUM(M) WHERE K='active' AND L='有償' GROUP BY MONTH(D)", 1)` |
| 依頼元別売上 | `=QUERY(records!A:N, "SELECT I, SUM(M) WHERE K='active' GROUP BY I ORDER BY SUM(M) DESC", 1)` |

> **注意**: GAS の `MONTH()` は 1〜12 を返す（0-indexed ではない）。v3.2 の `MONTH(D)+1` は誤りだったため修正済。
> 実施率の式も括弧優先順位を修正。

---

## 12. 受入基準

全シナリオで「Wi-Fi 環境下、ウォーム状態（直前 5 分以内に実行済み）」を前提条件とする。

- [ ] **AC-01**: スマホで Web App URL を開く → ミニカレンダーが 3 秒以内に表示される（ウォーム時）
- [ ] **AC-02**: コールドスタート時は 6 秒以内に表示される
- [ ] **AC-03**: 予定のある日に「●」が表示され、タップでリストがフィルタされる
- [ ] **AC-04**: 「＋ 追加」ボタンで登録画面が開く
- [ ] **AC-05**: 時間未定トグル ON で時間入力が無効化される
- [ ] **AC-06**: 送信 → 3 秒以内に Calendar と Sheets の両方に反映される（ウォーム時）
- [ ] **AC-07**: 依頼元・会場場所のサジェストが過去入力値を表示
- [ ] **AC-08**: 既存予定カードのタップで編集画面が開き、値がプリセットされる
- [ ] **AC-09**: 編集保存で Calendar と Sheets の両方が更新される
- [ ] **AC-10**: 時間未定 → 時刻確定への変更で Calendar の終日イベントが時刻指定イベントに置換される
- [ ] **AC-11**: 削除ボタンで Calendar は完全削除、Sheets は `cancelled` になる
- [ ] **AC-12**: `🔄 整合性` ボタンで直接編集された予定に ⚠️ が表示される
- [ ] **AC-13**: Sheets 登録失敗時は Calendar 側がロールバックされる
- [ ] **AC-14**: ロールバック失敗時は `pending_rollbacks` に記録され、次回起動時に再試行される
- [ ] **AC-15**: 通信断時に送信失敗 → 入力値が sessionStorage に保存され、復帰時に復元
- [ ] **AC-16**: 無償選択時は金額欄が非活性
- [ ] **AC-17**: スプシでピボット集計・QUERY 関数が正しく動作
- [ ] **AC-18**: iPhone / Android の両方で表示崩れがない
- [ ] **AC-19**: 同時操作（LockService）で競合しない
- [ ] **AC-20**: 日次バックアップトリガーで**スプシ本体全体が** `records-backup-YYYY-MM-DD` として Drive に複製される（`DriveApp.getFileById().makeCopy()` 実行）
- [ ] **AC-21**: LockService `tryLock(5000)` 失敗時、レスポンス `{success:false, error:'LOCK_TIMEOUT'}` が返る
- [ ] **AC-22**: 有償→無償への変更時、金額欄（M 列）が自動的にクリアされる
- [ ] **AC-23**: pending_rollback が 24 時間以上未処理の場合、MailApp で自分宛アラートメールが送信される
- [ ] **AC-24**: 有償→無償→有償 を繰り返したとき、金額欄の再入力を求められる（クリアされた状態）

---

## 13. 実装工数

| 作業 | 工数 |
|------|------|
| スプシ新規作成（14 列ヘッダ + 保護範囲設定） | 30min |
| Apps Script プロジェクト作成 + `appsscript.json` | 15min |
| **ScriptProperties 設定**（SPREADSHEET_ID / CALENDAR_ID） | 15min |
| バックエンド `Code.gs` | — |
| ├ `doGet()` + ルーティング | 30min |
| ├ `reconcilePendingRollbacks()` | 30min |
| ├ `getMonthRecords(year, month)` | 1h |
| ├ `getRecord(id)` / `getSuggestions(column)` | 45min |
| ├ `createRecord(input)` + LockService + バリデーション | 2h |
| ├ `updateRecord(id, newData)` + 終日⇄時刻変換 | 2.5h |
| ├ `deleteRecord(id)` | 1h |
| ├ `checkConsistency(records)` + CacheService | 1.5h |
| ├ UUID / 所要時間変換 / エラーハンドリング ユーティリティ | 1h |
| フロント `index.html` | — |
| ├ ミニカレンダー描画（CSS Grid） | 2.5h |
| ├ リスト描画 + 整合性バッジ + 手動リフレッシュボタン | 2h |
| ├ 登録・編集フォーム（共通化）+ サジェスト datalist | 2.5h |
| ├ 通信処理・トースト・画面遷移 + sessionStorage 復元 | 2h |
| ├ モバイル最適化 CSS 仕上げ + PWA manifest | 1.5h |
| `summary` シート初期セットアップ（QUERY 例を設置） | 30min |
| 日次バックアップトリガー設定 | 30min |
| Web App デプロイ設定 | 15min |
| 実機テスト（iPhone / Android） | 1.5h |
| **合計** | **約 25h（5 営業日、内訳実計算値）** |

> v3.2 の 19.5h から +5.5h：サジェスト機能 / 金額列 / LockService / PropertiesService / ロールバック補償 / バックアップトリガー / sessionStorage 復元 / `summary` シート / PWA manifest（`doGet` 分岐配信含む）。

---

## 14. ファイル構成

```
reservation-app/                   ← Apps Script プロジェクト
├─ Code.gs                            ← サーバサイドロジック
├─ index.html                         ← フロント一式
└─ appsscript.json                    ← マニフェスト（タイムゾーン等）

※ PWA `manifest.webmanifest` は別ファイルではなく `Code.gs` の `doGet(e)` 内で
  `e.parameter.resource === 'manifest'` 分岐 → `ContentService.createTextOutput(JSON.stringify(MANIFEST)).setMimeType(ContentService.MimeType.JSON)` で配信。
  HTML 側は `<link rel="manifest" href="?resource=manifest">` で参照。

外部リソース（手動作成）:
├─ "予約台帳" (Google Sheets)         ← records シート（14 列）+ summary シート
└─ Google Calendar                    ← 個人アカウント既定カレンダー

GAS 組込ストレージ:
├─ ScriptProperties                   ← SPREADSHEET_ID, CALENDAR_ID
├─ UserProperties                     ← pending_rollbacks キュー
└─ UserCache                          ← サジェスト / 整合性チェック結果
```

---

## 15. 成功指標（Definition of Success）

定量的に測定可能な基準を設定:

| # | 指標 | 目標値 | 測定方法 |
|---|------|--------|---------|
| S-1 | リリース後の継続利用日数 | ≥ 20 営業日 / 月 | 登録ログの日毎利用日数 |
| S-2 | Calendar ⇔ Sheets 不整合件数 | 0 件 / 月 | 月次の `checkConsistency()` 実行結果 |
| S-3 | データ破損による再入力回数 | 0 回 / 3 ヶ月 | ロールバック失敗ログ |
| S-4 | ピボット集計の信頼性 | 依頼元 JOIN 不一致 ≤ 5% | サジェスト機能導入前後の比較 |
| S-5 | 入力所要時間 | 平均 ≤ 45 秒 / 件 | 実測（任意） |
| S-6 | 実運用ランニングコスト | $0 / 月 | Google / Cloudflare 請求確認 |

---

## 16. バックアップ・ログ・運用

### 16.1 バックアップ

**日次バックアップ**: GAS の時限トリガーで**スプシ本体全体**を Drive フォルダに複製（毎日 23:00）
- 実装:
  ```js
  function dailyBackup() {
    const file = DriveApp.getFileById(SPREADSHEET_ID);
    const backupFolder = DriveApp.getFolderById(BACKUP_FOLDER_ID);
    const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    file.makeCopy(`records-backup-${today}`, backupFolder);
  }
  ScriptApp.newTrigger('dailyBackup').timeBased().atHour(23).everyDays(1).create();
  ```
- 対象: **スプシ全体**（`records` シート + `summary` シートの両方）
- 保持期間: 30 日（トリガー内で 31 日以前のバックアップを `setTrashed(true)` で削除）

**復旧手順**:
1. 指定フォルダから `records-backup-YYYY-MM-DD` を開く
2. 対象行をコピー → 本体スプシに貼付、または本体を丸ごと置換
3. 対応する Calendar イベントが無ければ手動再作成

### 16.2 ログ管理

- `console.log` / `console.error` を Code.gs 全関数に配置（実行数で閲覧可）
- **重大エラー**（ロールバック失敗、24h 超の pending_rollback 等）は `MailApp.sendEmail()` で自分宛通知
- 月次でログを目視確認（5 分）

### 16.3 運用チェックリスト

| 頻度 | 作業 | 所要 |
|------|------|------|
| 毎月 | `summary` シートで実績確認・ピボット更新 | 5 min |
| 毎月 | Apps Script 実行ログの目視（エラー有無） | 5 min |
| 毎年 1 月第 1 週 | 前年度データを別シート `records-YYYY` へ退避 | 15 min |
| 必要時 | ScriptProperties 値の更新（スプシ/カレンダー変更時） | 2 min |

---

## 17. 用語集

| 用語 | 定義 |
|------|------|
| 受付ID | `Utilities.getUuid()` で生成する UUID v4 |
| 時間未定 | 終日イベントとして Calendar に登録される状態 |
| 論理削除 | スプシ K 列を `cancelled` に更新（行は残す） |
| 物理削除 | Calendar イベントを `.deleteEvent()` で削除 |
| サジェスト | `<datalist>` による過去入力値の候補表示 |
| Compensating Rollback | Calendar 成功後に Sheets 失敗した場合、Calendar を補償削除するパターン |
| reconcile | 未処理の pending_rollback を次回起動時に再試行する処理 |
| コールドスタート | Apps Script の初回実行時の立ち上げ遅延（2〜5 秒） |
| ウォーム状態 | 直前 5 分以内に同一 Web App を実行済みの状態 |

---

## 18. v3.2 からの変更点サマリー

| # | 変更 | 種別 |
|---|------|------|
| 1 | スプシ列数 13 → **14 列**（M 列「金額」追加） | 追加 |
| 2 | 依頼元・会場場所に `<datalist>` サジェスト追加（F-7） | 追加 |
| 3 | QUERY 式の `MONTH(D)+1` → `MONTH(D)` に修正 | 不具合修正 |
| 4 | 実施率計算式の括弧優先順位修正 | 不具合修正 |
| 5 | LockService 必須化（create/update/delete） | 整合性強化 |
| 6 | ScriptProperties / CacheService / UserProperties の役割明記 | GAS ベストプラクティス |
| 7 | ロールバック失敗時の補償処理（pending_rollbacks + reconcile） | 信頼性強化 |
| 8 | 時間未定 ⇄ 時刻指定の変換は delete + create 再作成で対応と明記 | 仕様明確化 |
| 9 | 整合性チェックを手動リフレッシュ方式に変更（パフォーマンス対策） | 設計変更 |
| 10 | NFR「3 秒以内」の測定条件（ウォーム時/コールド時）を明記 | 受入基準強化 |
| 11 | PWA `manifest.webmanifest` への移行、`maximum-scale=1` 削除 | アクセシビリティ |
| 12 | オフライン時の sessionStorage 復元（F-21 相当） | UX 強化 |
| 13 | 日次バックアップトリガー追加（MailApp エラー通知も） | 運用強化 |
| 14 | 成功指標 S-1〜S-6 を定量化 | PO 指摘反映 |
| 15 | ヘッダ行の Protect Range 推奨 | データ保護 |
| 16 | 手動テストチェックリスト（AC-01〜AC-20）を 20 項目に拡張 | 検証強化 |
| 17 | 工数 19.5h → 25h に修正（現実的見積、v3.3.1 実計算値） | PO 指摘反映 |

---

**文書終わり** — v3.3 (2026-04-19)

**次ステップ**: v3.3 を第三者レビューで再検証し、100/100 確認後にスターターコード作成
