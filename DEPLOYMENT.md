# デプロイ完了状態 と 利用開始手順

## ✅ 自動化済み（実施済み）

| 項目 | 状態 | 備考 |
|------|------|------|
| GitHub リポジトリ作成 | ✅ | [business-tracker](https://github.com/aikkawana-collab/business-tracker) |
| コードコミット・プッシュ | ✅ | main ブランチに最新 |
| Apps Script プロジェクト作成 | ✅ | Script ID: `<script-id>qd1OhTBWVYuB9` |
| コード push（Code.gs / index.html / appsscript.json） | ✅ | 3 ファイル |
| Web App デプロイ（自分のみ実行可） | ✅ | `@2` version |
| Issue 管理（19 件起票・15 件クローズ） | ✅ | T-01〜T-18 クローズ済 |

---

## 🔑 重要な URL

### Apps Script エディタ
```
https://script.google.com/d/<script-id>qd1OhTBWVYuB9/edit
```

### Web App URL（スマホからアクセス）
```
https://script.google.com/macros/s/<deployment-id>/exec
```

### GitHub リポジトリ
```
https://github.com/aikkawana-collab/business-tracker
```

---

## 📋 利用開始までのあと 3 ステップ（所要 3 分）

### Step 1: 初回セットアップ（Apps Script エディタで 1 クリック実行）

1. [Apps Script エディタ](https://script.google.com/d/<script-id>qd1OhTBWVYuB9/edit) を開く
2. 左の関数選択ドロップダウンで **`setupInitialData`** を選択
3. 「実行」ボタンをクリック
4. 初回は OAuth 同意画面が表示される → 許可
   - 「このアプリは Google Drive、スプレッドシート、カレンダーにアクセスします」→ 許可
   - 「Google で確認されていません」警告 → 詳細 → 安全ではないページへ移動 → 許可（自分で作成したアプリなので安全）
5. 実行ログで以下を確認:
   ```
   ✅ セットアップ完了
   SPREADSHEET_ID: xxxxx
   スプシ URL: https://docs.google.com/spreadsheets/d/xxxxx/edit
   CALENDAR_ID: primary (getDefaultCalendar を使用)
   ```

この 1 回の実行で以下が完了します:
- ✅ Google スプレッドシート「予約台帳」が作成される
- ✅ records シートに 12 列のヘッダが配置される
- ✅ ヘッダ行が保護される
- ✅ ScriptProperties に `SPREADSHEET_ID` と `CALENDAR_ID` が自動登録される

### Step 2: スマホでアクセス

1. スマホのブラウザで Web App URL を開く:
   ```
   https://script.google.com/macros/s/<deployment-id>/exec
   ```
2. Google アカウントでログイン（自分以外は 403 で弾かれる設定済）
3. ミニカレンダー画面が表示されれば成功

### Step 3: ホーム画面に追加

| 端末 | 手順 |
|------|------|
| iPhone (Safari) | 下部の共有アイコン → 「ホーム画面に追加」 |
| Android (Chrome) | メニュー → 「ホーム画面に追加」 |

これでアプリ風に起動できます。

---

## 🧪 動作確認（T-19 実機テスト）

Step 2 のあと、以下の 16 項目を試してください:

### 基本動作
- [ ] ミニカレンダーが表示される
- [ ] 月切替ボタン（◀ / 今日 / ▶）が動作する
- [ ] 日付タップで選択状態になる

### 新規登録
- [ ] 「＋ 追加」ボタンでフォームが開く
- [ ] 必須項目（日付・依頼内容・依頼元・会場場所・報酬種別）を入力して送信 → 3 秒以内に一覧に戻る
- [ ] スプレッドシート「予約台帳」に新しい行が追加されている
- [ ] Google カレンダーに新しい予定が追加されている
- [ ] イベントタイトルが `[依頼内容] - [依頼元]` になっている
- [ ] イベント本文に `受付ID: xxx` と `報酬: 有償/無償` が含まれている

### 時間未定
- [ ] 「⏰ 時間未定」チェックで開始時刻と所要時間が灰色になる
- [ ] この状態で登録 → カレンダーに終日イベントとして登録される

### 編集
- [ ] 既存カードをタップすると編集画面が開く
- [ ] 値がプリセットされている
- [ ] 時間未定 → 時刻指定に変更して保存 → カレンダー側のイベント ID が変わる（L 列確認）
- [ ] 時刻指定 → 時間未定 も同様

### 削除
- [ ] 編集画面の「この予定を削除」ボタン → 確認ダイアログ → OK
- [ ] Google カレンダーから完全削除される
- [ ] スプレッドシート J 列（ステータス）が `cancelled` に変わる（行は残る）

### 整合性チェック
- [ ] Google カレンダーで直接タイトルを変更
- [ ] アプリに戻り「🔄 整合性」ボタンをタップ
- [ ] 該当カードに ⚠️「Googleカレンダーで変更あり」が表示される

### スマホ UI
- [ ] iPhone / Android で表示崩れなし
- [ ] 入力欄のフォーカス時に拡大されない（iOS）
- [ ] 下部のボタンがスクロールしても常に見える

---

## 🔧 トラブルシュート

| 症状 | 対応 |
|------|------|
| `SPREADSHEET_ID が ScriptProperties に設定されていません` エラー | Step 1 の setupInitialData を実行していない。実行する |
| 登録したのにカレンダーに出ない | Apps Script 実行数 → ログでエラー確認 |
| 「Google で確認されていません」警告 | 自分で作成したアプリなので安全。「詳細」→「安全でないページへ移動」で許可 |
| 403 Forbidden | 自分以外の Google アカウントでログインしている。自分のアカウントでログイン |
| 画面が白い | コールドスタート中。5 秒ほど待つ |
| 整合性チェックで誤検知 | Calendar 側を変更した場合 or キャッシュが 5 分古い。5 分後に再実行 |

---

## 📊 月次業績を確認

スプレッドシートの別シート（例: `summary`）を作成し、以下の QUERY 関数を設置:

```sheet
=QUERY(records!A:L, "SELECT MONTH(C), COUNT(A) WHERE J='active' GROUP BY MONTH(C) ORDER BY MONTH(C)", 1)
```

または「挿入 → ピボットテーブル」で:
- 行: 依頼元 / 依頼内容 / 会場場所
- 値: 件数

---

## 🔄 コード更新時

ローカルでコード修正後:

```bash
cd "/Users/kawanakenta/Cursol Project/業績管理アプリ"
./node_modules/.bin/clasp push --force
./node_modules/.bin/clasp deploy --description "vX.X description"
```

---

## 📦 技術情報

- **実装**: Google Apps Script + HTML Service + Vanilla JS
- **依存ライブラリ**: なし
- **月額コスト**: $0
- **コード行数**: Code.gs 約 520 行、index.html 約 600 行
- **ドキュメント**: [REQUIREMENTS.md v4.0.1](./docs/sdd/REQUIREMENTS.md)
