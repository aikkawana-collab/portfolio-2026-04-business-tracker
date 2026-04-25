# 要件定義書 v4.0 — 業績管理アプリ

**プロダクト名**: 業績管理アプリ
**バージョン**: 4.0.1（QA/PO 最終指摘 6 件反映版）
**作成日**: 2026-04-19
**作成者**: Kenta Kawana (<email>)
**前版**: `REQUIREMENTS.v3.3.2.archived.md`（過剰設計のため差し替え）

## 改訂の主旨（v3.3.2 → v4.0）

独立レビュー（QA 78/100 + PO 61/100）を受け、以下 2 方向で全面改訂:

### 技術修正（QA 指摘）
- `CalendarApp.getCalendarById('primary')` は null を返す致命バグ → `getDefaultCalendar()` 使用に修正
- **C 列（実施日）を明示的に Date 型で書込**（QUERY `MONTH(C)` が動作するように）
- `eventId` の変数スコープ明記
- 版番号・参照行番号の整合

### 過剰設計の削除（PO 指摘）
ユーザーとのディスカッションに**存在しなかった**要件をレビュアーが勝手に追加していたため削除:

| 削除項目 | 削除理由 |
|---------|---------|
| LockService（同時実行制御） | 利用者 1 名のため競合しない |
| reconcile / pending_rollback キュー | 月 10 件規模で手動対応で十分 |
| サジェスト機能（依頼元・会場） | ユーザー要望になかった（レビュアー追加） |
| 金額入力列 | ユーザー明示「有償/無償のみで問題ない」 |
| sessionStorage 復元 | ユーザー要望になかった |
| PWA manifest 配信 | ホーム画面追加だけで十分 |
| 日次バックアップトリガー | Google の自動版管理で十分 |
| MailApp エラー通知 | `console.error` で十分 |
| BACKUP_FOLDER_ID / ALERT_EMAIL | 上記削除に伴い不要 |

**工数**: 25h → **18.5h**（6.5h 削減）
**スプシ列数**: 14 → **12 列**
**保守性**: 6 ヶ月後の自分が理解しやすい構造に

---

## 1. 目的

個人事業の業績を、スマートフォンから手軽に記録・管理・集計するための Web アプリを構築する。

- フォーム入力と同時に **Google カレンダー**に予定登録
- 同じ内容を **Google スプレッドシート**にも記録
- **ミニカレンダー UI** で視覚的に実施状況を把握
- 編集・削除も本アプリから実行
- 月次・年次の業績集計は **スプシの標準機能**で対応

---

## 2. 利用条件

| 項目 | 内容 |
|------|------|
| 利用者 | 本人 1 名のみ |
| アカウント | 個人 Google アカウント（Workspace 非使用） |
| 入力環境 | スマートフォン主体（PC も可） |
| 想定件数 | 月 10 件程度 |
| 月額コスト | $0 |
| 拡張性 | 考慮しない |

---

## 3. スコープ

### In Scope（Must）

| ID | 要件 |
|----|------|
| F-1 | ミニカレンダー UI（月ビュー + 選択日の予定リスト） |
| F-2 | 新規登録（時間未定も可） |
| F-3 | 既存予定の編集 |
| F-4 | 削除（Calendar 完全削除 + Sheets 論理削除 `cancelled`） |
| F-5 | Google Calendar と Sheets の同時反映（失敗時 Calendar ロールバック） |
| F-6 | スマホ最適化 UI |

### In Scope（Should）

| ID | 要件 |
|----|------|
| F-7 | 整合性警告表示（**手動リフレッシュボタン方式**） |

### Out of Scope

- サジェスト機能（表記ゆれはユーザー自身で注意）
- 金額入力・売上集計（有償/無償のみ管理）
- 通知機能（メール/LINE）
- 複数ユーザー対応
- 自動テスト（手動チェックリストで対応）
- 繰り返し予定
- PWA マニフェスト（ホーム画面追加は可能）
- 自動バックアップ（Google の版履歴に依存）
- 同時実行制御（LockService）
- ロールバック失敗時の自動リトライ（発生時は手動対応）

---

## 4. 入力項目

| # | 項目 | 必須 | 入力形式 | 例 |
|---|------|-----|---------|-----|
| 1 | 実施日 | ✅ | date ピッカー | 2026-04-25 |
| 2 | 時間未定トグル | — | checkbox | ✅ / ☐ |
| 3 | 開始時刻 | ※ | time ピッカー | 14:00 |
| 4 | 所要時間 | ※ | select | 30分 / 1時間 / 1.5時間 / 2時間 / 3時間 / 半日(4h) / 終日 |
| 5 | 依頼内容 | ✅ | textarea | Web打合せ |
| 6 | 依頼元 | ✅ | text | 〇〇株式会社 |
| 7 | 会場場所 | ✅ | text | オンライン |
| 8 | 報酬種別 | ✅ | radio | 有償 / 無償 |

※ **時間未定トグル**が ON のときは 3・4 は非活性（終日イベントとして登録）

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
│ 📅 4/18（金）の予定  [🔄 整合性] │
│ ┌──────────────────────────┐ │
│ │ 14:00-15:00              │ │
│ │ Web打合せ - 〇〇株式会社 │ │
│ │ 📍 オンライン 💰 有償     │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ ⏰ 時間未定              │ │
│ │ 撮影 - 佐藤様            │ │
│ │ 📍 スタジオA 💰 有償      │ │
│ └──────────────────────────┘ │
│                                │
│ [＋ 4/18 に追加]                │  ← 下部固定
└────────────────────────────┘
```

### 5.2 新規登録／編集画面

```
┌────────────────────────────┐
│ [← 戻る]   新規登録 / 編集     │
├────────────────────────────┤
│ 📅 実施日  [2026-04-18 ▼]     │
│ [✓] 時間未定                   │
│ ⏰ 開始    [  :  ] (灰色時)    │
│ ⏱ 時間    [1時間 ▼] (灰色時)   │
│ 💼 依頼内容 [___________]      │
│ 🏢 依頼元   [___________]      │
│ 📍 会場場所 [___________]      │
│ 💰 報酬種別                    │
│   ( ) 有償  ( ) 無償           │
├────────────────────────────┤
│ [ 登録する / 更新する ]         │  ← 下部固定
│ （編集時のみ）[ 削除する ]       │
└────────────────────────────┘
```

---

## 6. データモデル

### 6.1 スプレッドシート `records` シート（**12 列**）

| 列 | 項目 | 型 | 例 |
|----|------|-----|-----|
| A | 受付ID | string (UUID) | `a3f9-...` |
| B | 登録日時 | **Date（日時型）** | `2026-04-19 14:30:00` |
| C | 実施日 | **Date（日付型）** | `2026-04-25` |
| D | 開始時刻 | string HH:mm（空欄可） | `14:00` |
| E | 終了時刻 | string HH:mm（空欄可） | `15:00` |
| F | 時間未定 | bool | `TRUE` / `FALSE` |
| G | 依頼内容 | string | `Web打合せ` |
| H | 依頼元 | string | `〇〇株式会社` |
| I | 会場場所 | string | `オンライン` |
| J | ステータス | string | `active` / `cancelled` |
| K | 報酬種別 | string | `有償` / `無償` |
| L | CalendarイベントID | string | Google 返却値 |

**重要**: B 列 `登録日時` と C 列 `実施日` は `new Date()` オブジェクトで書き込む。文字列ではない。これにより QUERY の `MONTH(C)` / `YEAR(C)` が正しく動作する。

### 6.2 Google Calendar イベント

| 要素 | 値 |
|------|-----|
| タイトル | `[依頼内容] - [依頼元]` |
| 場所 | 会場場所 |
| 説明 | `受付ID: <UUID>\n報酬: 有償/無償` |
| タイムゾーン | Asia/Tokyo |
| 時間未定時 | **終日イベント**（`createAllDayEvent()`） |

### 6.3 ScriptProperties（2 項目のみ）

```
SPREADSHEET_ID = "xxxxx"         # スプシ ID
CALENDAR_ID    = "primary"       # カレンダー ID（空 or "primary" なら getDefaultCalendar() 使用）
```

### 6.4 カレンダー取得ロジック（重要・R-05 対策）

```javascript
function getTargetCalendar() {
  const id = PropertiesService.getScriptProperties().getProperty('CALENDAR_ID');
  if (!id || id === 'primary') {
    return CalendarApp.getDefaultCalendar();  // ← primary はこちら
  }
  return CalendarApp.getCalendarById(id);     // ← メールアドレス形式のIDのみ
}
```

`CalendarApp.getCalendarById('primary')` は **null を返すため使用禁止**。

---

## 7. 処理フロー

### 7.1 新規登録

```
[フォーム送信] → フロント: 必須チェック + ボタン無効化
  ↓ google.script.run.createRecord(input)

[Code.gs: createRecord(input)]
  ├─ サーバ側再バリデーション
  ├─ const reservationId = Utilities.getUuid()
  ├─ 終了時刻 = 開始時刻 + 所要時間（時間未定なら null）
  ├─ const cal = getTargetCalendar()
  ├─ Calendar 登録:
  │   if (時間未定) {
  │     event = cal.createAllDayEvent(title, scheduledDate);
  │   } else {
  │     event = cal.createEvent(title, start, end);
  │   }
  │   event.setLocation(場所);
  │   event.setDescription(`受付ID: ${reservationId}\n報酬: ${有償or無償}`);
  ├─ const eventId = event.getId()   ← 変数に明示保持
  ├─ try {
  │     sheet.appendRow([
  │       reservationId, new Date(), new Date(scheduledDate),
  │       startTime, endTime, timeUndefined,
  │       requestContent, requester, location,
  │       'active', paymentType, eventId
  │     ]);
  │   } catch (e) {
  │     // ロールバック
  │     try {
  │       cal.getEventById(eventId).deleteEvent();
  │     } catch (e2) {
  │       console.error(`ロールバック失敗: reservationId=${reservationId}, eventId=${eventId}`, e2);
  │       return { success: false, error: 'CALENDAR_ORPHAN',
  │                message: 'Sheets登録に失敗し、カレンダー削除にも失敗しました。手動でカレンダーから削除してください。',
  │                orphanEventId: eventId };
  │     }
  │     return { success: false, error: 'SHEETS_FAILED' };
  │   }
  └─ return { success: true, reservationId }
```

### 7.2 編集

```
[カードタップ] → reservationId 取得
  ↓ getRecord(id) → 該当行取得 → フォームプリセット
  ↓ ユーザー修正 → updateRecord(id, newData)

[Code.gs: updateRecord(id, newData)]
  ├─ const cal = getTargetCalendar()
  ├─ const event = cal.getEventById(既存eventId)
  ├─ 終日 ⇄ 時刻指定 の遷移を判定:
  │   ① 変化なし（両方とも同じ状態）:
  │       event.setTitle() / setLocation() / setTime() / setDescription()
  │   ② 時間未定 → 時刻確定:
  │       終日イベントの setTime() は不可のため:
  │       - event.deleteEvent()
  │       - newEvent = cal.createEvent(title, start, end)
  │       - newEvent.setLocation() / setDescription()
  │       - スプシ L 列を新 eventId に更新
  │   ③ 時刻確定 → 時間未定:
  │       - event.deleteEvent()
  │       - newEvent = cal.createAllDayEvent(title, date)
  │       - newEvent.setLocation() / setDescription()
  │       - スプシ L 列を新 eventId に更新
  ├─ スプシ該当行を更新（updateRow）
  └─ return { success: true }
```

### 7.3 削除

```
[削除ボタン] → confirm("削除しますか？") → OK
  ↓ deleteRecord(id)

[Code.gs: deleteRecord(id)]
  ├─ const cal = getTargetCalendar()
  ├─ try {
  │     cal.getEventById(eventId).deleteEvent();
  │   } catch (e) {
  │     console.error(`Calendar削除失敗: eventId=${eventId}`, e);
  │     // Sheets論理削除は継続
  │   }
  ├─ スプシ J 列（ステータス）を `cancelled` に更新 ← 論理削除
  └─ return { success: true }
```

### 7.4 整合性チェック（手動起動のみ）

```
[🔄 整合性] ボタン押下
  ↓ checkConsistency(year, month)

[Code.gs: checkConsistency(year, month)]
  ├─ スプシから当該月の active レコード取得
  ├─ 各レコードで:
  │   try {
  │     const event = cal.getEventById(eventId)
  │     if (event.isDeleted()) → ⚠️「Googleカレンダーで削除済み」
  │     else if (タイトル/場所/時刻 差異) → ⚠️「Googleカレンダーで変更あり」
  │     else → 警告なし
  │   } catch {
  │     → ⚠️「Googleカレンダーで削除済み」
  │   }
  └─ 結果をフロントに返却、カードにバッジ描画
```

**比較ルール**:
- タイトル: `trim()` 後に完全一致
- 場所: `trim()` 後に完全一致
- 時刻: `Date.getTime()` で一致判定

**競合解決ポリシー**: 本アプリで再編集すると本アプリ側の値で**強制上書き**。警告は情報提供のみ、自動同期しない。

---

## 8. 技術スタック

| 層 | 技術 |
|----|------|
| UI | HTML + CSS (CSS Grid) + Vanilla JavaScript |
| 実行環境 | Google Apps Script Web App |
| 設定管理 | PropertiesService（ScriptProperties 2 項目のみ） |
| キャッシュ | CacheService（整合性チェック結果のみ、TTL 5 分） |
| データ | Google Sheets（個人アカウント） |
| 予定 | Google Calendar（個人アカウント） |

**外部ライブラリ・外部インフラ不使用。**

---

## 9. セキュリティ

| 項目 | 内容 |
|------|------|
| Web App 公開設定 | 「自分のみ実行可」 |
| 実行アカウント | スクリプト所有者（自分） |
| URL 漏洩時の影響 | ゼロ（Google ログインで他人は弾かれる） |
| データ保管 | すべて個人 Google アカウント内 |
| ハードコード禁止 | SPREADSHEET_ID / CALENDAR_ID は ScriptProperties |
| 初回同意 | Calendar / Sheets へのアクセス許可 1 回のみ |

---

## 10. スマホ最適化要件

| 項目 | 基準 |
|------|------|
| viewport | `width=device-width, initial-scale=1`（`maximum-scale` は指定しない） |
| ミニカレンダーのセル | 最小 44 × 44 px |
| 入力フィールド高さ | 48 px 以上 |
| フォントサイズ | 16 px 以上（iOS オートズーム抑止） |
| ネイティブピッカー使用 | `type="date"` `type="time"` `select` `radio` |
| 下部固定ボタン | `position: sticky; bottom` |
| ホーム画面追加 | iOS/Android 標準機能で追加可能（manifest は不要） |
| オフライン時 | 送信失敗で「通信エラー」表示、ユーザーは再送信を手動実行 |

---

## 11. 集計の実現方法（アプリ外）

月次・年次集計は **Google Sheets 標準機能**のみで対応:

| 集計 | 方法 |
|------|------|
| 月別件数 | `=QUERY(records!A:L, "SELECT MONTH(C), COUNT(A) WHERE J='active' GROUP BY MONTH(C) ORDER BY MONTH(C)", 1)` |
| 依頼元別件数 | ピボットテーブル（行: H 依頼元 / 値: A 件数） |
| 依頼内容別件数 | ピボットテーブル（行: G 依頼内容 / 値: A 件数） |
| 会場別件数 | ピボットテーブル（行: I 会場場所 / 値: A 件数） |
| 有償/無償比率 | `=COUNTIF(records!K:K,"有償")` / `=COUNTIF(records!K:K,"無償")` |
| 実施率 | `=COUNTIF(records!J:J,"active")/(COUNTA(records!A:A)-1)` |

> **注意**: QUERY の `MONTH(C)` は 1〜12 を返す（1-indexed）。C 列が Date 型で書かれていることが前提。

> **年次アーカイブ後の対応**: 旧データを別シートに移した場合、`summary` シートの QUERY 参照範囲を更新する必要あり（手動対応）。

---

## 12. 受入基準（16 項目）

前提: Wi-Fi 環境下、ウォーム状態（直前 5 分以内に実行済み）

- [ ] **AC-01**: ミニカレンダーが 3 秒以内に表示される（ウォーム時）
- [ ] **AC-02**: コールドスタート時は 6 秒以内に表示される
- [ ] **AC-03**: 予定のある日に「●」が表示され、タップでリストがフィルタされる
- [ ] **AC-04**: 「＋ 追加」ボタンで登録画面が開く
- [ ] **AC-05**: 時間未定トグル ON で時間入力が非活性になる
- [ ] **AC-06**: 送信 → 3 秒以内に Calendar と Sheets の両方に反映される（ウォーム状態 + 安定 Wi-Fi 前提）
- [ ] **AC-07**: 既存予定カードのタップで編集画面が開き、値がプリセットされる
- [ ] **AC-08**: 編集保存で Calendar と Sheets の両方が更新される
- [ ] **AC-09**: 時間未定 → 時刻確定の変更で Calendar 終日イベントが時刻指定イベントに置換され、L 列の eventId が更新される
- [ ] **AC-10**: 削除で Calendar は完全削除、Sheets J 列が `cancelled` になる
- [ ] **AC-11**: `🔄 整合性` ボタンで直接編集された予定に ⚠️ が表示される。比較ルール: **終日イベントは日付のみ比較**（時刻は 00:00 のため時刻比較無効）、**時刻指定イベントは `getStartTime().getTime()` / `getEndTime().getTime()` 完全一致**、タイトル・場所は `trim()` 後の完全一致
- [ ] **AC-12**: Sheets 登録失敗時は Calendar 側がロールバックされる
- [ ] **AC-13**: ロールバック自体が失敗した場合、エラー画面で `orphanEventId` が表示され、ユーザーが手動削除できる
- [ ] **AC-14**: `CALENDAR_ID = 'primary'` のとき `getDefaultCalendar()` が使用される（`getCalendarById('primary')` は null で失敗する）
- [ ] **AC-15**: スプシ C 列が Date 型で書き込まれ、`QUERY` の `MONTH(C)` が正しく 1〜12 を返す
- [ ] **AC-16**: iPhone / Android で表示崩れなく動作する

---

## 13. 実装工数

| 作業 | 工数 |
|------|------|
| スプシ作成（12 列ヘッダ） | 10min |
| Apps Script プロジェクト作成 + `appsscript.json` | 15min |
| ScriptProperties 設定（SPREADSHEET_ID / CALENDAR_ID） | 10min |
| バックエンド `Code.gs` | — |
| ├ `doGet()` + ルーティング | 30min |
| ├ `getTargetCalendar()` ユーティリティ | 15min |
| ├ `getMonthRecords(year, month)` | 1h |
| ├ `getRecord(id)` | 30min |
| ├ `createRecord(input)` + try/catch ロールバック | 1.5h |
| ├ `updateRecord(id, newData)` + 終日⇄時刻変換 | 2h |
| ├ `deleteRecord(id)` | 45min |
| ├ `checkConsistency(year, month)` + CacheService | 1.5h |
| ├ UUID / 所要時間変換 / バリデーション ユーティリティ | 45min |
| フロント `index.html` | — |
| ├ ミニカレンダー描画（CSS Grid） | 2.5h |
| ├ リスト描画 + 整合性バッジ + 手動リフレッシュボタン | 1.25h |
| ├ 登録・編集フォーム（共通化） | 2h |
| ├ 通信処理・トースト・画面遷移 | 1.25h |
| ├ モバイル最適化 CSS | 0.75h |
| Web App デプロイ設定（自分のみ） | 15min |
| 実機テスト（iPhone / Android） | 1h 10min |
| **合計** | **18.5h = 1,110 分（3〜4 営業日、内訳完全整合）** |

---

## 14. ファイル構成

```
reservation-app/                   ← Apps Script プロジェクト
├─ Code.gs                            ← サーバサイドロジック（約 250 行想定）
├─ index.html                         ← フロント一式（HTML + CSS + JS）
└─ appsscript.json                    ← マニフェスト（タイムゾーン等）

外部リソース（手動作成）:
├─ "予約台帳" (Google Sheets)         ← records シート（12 列）
└─ 個人 Google カレンダー（既定）
```

---

## 15. 成功指標

月 10 件規模・個人利用の現実に即した指標:

| # | 指標 | 目標値 |
|---|------|--------|
| S-1 | リリース後 3 ヶ月間の継続利用（実稼働） | **月 8 件以上の入力継続**（想定 10 件/月に対して 80% 以上） |
| S-2 | Calendar ⇔ Sheets 不整合件数 | 月次で 0 件（手動整合性チェック時） |
| S-3 | 月次ピボット集計の動作 | 毎月 1 回以上、問題なく実行可能 |
| S-4 | ランニングコスト | $0 / 月 |

---

## 16. 運用

### 16.1 日常運用
- スマホのホーム画面アイコンからアプリ起動 → 入力 / 編集 / 削除
- スプシは必要に応じて PC で開き集計確認

### 16.2 定期メンテナンス

| 頻度 | 作業 | 所要 |
|------|------|------|
| 月次 | `🔄 整合性` で月次チェック | 1 分 |
| 月次 | スプシでピボット更新 | 5 分 |
| 月次 | Apps Script 実行数でエラー有無確認 | 1 分 |
| 年次 | 前年度データを `records-YYYY` へ手動退避 | 15 分 |

### 16.3 トラブル対応

| 症状 | 対応 |
|------|------|
| 登録したのに Calendar に出ない | Apps Script 実行数 → ログ確認 |
| ⚠️ 警告が表示されている | 本アプリから再編集で上書き |
| `CALENDAR_ORPHAN` エラー | エラー画面の `orphanEventId` をメモ → Google カレンダーで手動検索して削除 |
| 権限エラー | 再ログイン、承認を再実行 |
| 画面が白い | ネット接続確認、コールドスタートで数秒待機 |

### 16.4 バックアップ
- Google Sheets の**版履歴**（自動）で復旧可能
- 誤削除時は版履歴から復元

---

## 17. 用語集

| 用語 | 定義 |
|------|------|
| 受付ID | `Utilities.getUuid()` で生成する UUID v4 |
| 時間未定 | 終日イベントとして Calendar に登録される状態 |
| 論理削除 | スプシ J 列を `cancelled` に更新（行は残す） |
| 物理削除 | Calendar イベントを `.deleteEvent()` で削除 |
| `CALENDAR_ORPHAN` | Calendar 成功 → Sheets 失敗 → Calendar 削除も失敗の 3 重失敗状態 |
| コールドスタート | Apps Script 初回実行時の立ち上げ遅延（2〜5 秒） |
| ウォーム状態 | 直前 5 分以内に同一 Web App を実行済みの状態 |

---

## 18. v3.3.2 からの主な変更（何を残し、何を削ったか）

### ✅ 残した要件（ディスカッションで user が明示希望したもの）
- ミニカレンダー + リスト UI（折衷案 D として user が選択）
- 時間未定トグル（user が提案）
- 編集機能（user が提案）
- 削除（Calendar 完全 / Sheets 論理）（user が明示）
- 整合性警告（user「いいかもしれない」Should 扱い）
- 報酬種別のみ（user が明示「有償/無償だけ」）

### ❌ 削除した要件（レビュアー追加だった過剰設計）
| 削除 | user 要望? |
|------|----------|
| 金額入力列 | ❌ user 明示「不要」 |
| サジェスト機能 | ❌ user 言及なし |
| LockService | ❌ user 言及なし（1 人運用で不要） |
| reconcile / pending_rollbacks | ❌ user 言及なし |
| sessionStorage 復元 | ❌ user 言及なし |
| PWA manifest 配信 | ❌ user 言及なし |
| 日次自動バックアップ | ❌ user 言及なし（Google 版履歴で十分） |
| MailApp エラー通知 | ❌ user 言及なし |

### 🔧 技術修正（実装不可だった点）
- `CalendarApp.getCalendarById('primary')` → `getDefaultCalendar()` に訂正
- B 列 / C 列の Date 型書込を明示（QUERY 関数動作のため）
- `eventId` 変数スコープの明記
- バージョン番号の整合

### 📊 数値変化
- スプシ列: 14 → **12 列**
- 機能要件: F-1 〜 F-9 → **F-1 〜 F-7**
- 受入基準: 24 項目 → **16 項目**
- 工数: 25h → **18.5h**
- ScriptProperties: 4 項目 → **2 項目**

---

**文書終わり** — v4.0 (2026-04-19)

**次ステップ**: スターターコード（`Code.gs` / `index.html` / `appsscript.json`）作成
