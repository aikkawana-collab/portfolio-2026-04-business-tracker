# 業績管理アプリ — プロジェクトメモ

> 個人利用向け管理メモ。重要情報・運用手順・トラブル時の対処をここに一元化。

**最終更新**: 2026-04-19

---

## 🏢 アカウント情報

| 項目 | 値 |
|------|-----|
| 本番運用アカウント | `<email>`（個人 Gmail、事業用） |
| 開発元アカウント | `<email>`（clasp 現在ログイン中） |
| GitHub アカウント | `aikkawana-collab` |

---

## 🔗 重要 URL

### 本番 Web App（スマホからアクセス・利用）
```
https://script.google.com/macros/s/<deployment-id>/exec
```
※ ブラウザが `<email>` でログインしている必要あり。

### Apps Script エディタ（コード直接編集・ログ確認）
```
https://script.google.com/d/<script-id>osEFK4hWpwIH8/edit
```

### GitHub リポジトリ（ソースコード・履歴）
```
https://github.com/aikkawana-collab/business-tracker
```

### データ（業務アカウントの Drive / Calendar）
- **スプレッドシート**: Drive 内の「予約台帳」（setupInitialData 実行時に自動生成）
- **カレンダー**: 業務アカウント既定（primary）

---

## 🆔 技術 ID 一覧

| 項目 | 値 |
|------|-----|
| Script ID（プロジェクト） | `<script-id>osEFK4hWpwIH8` |
| Deployment ID（Web App） | `<deployment-id>` |
| Script timezone | Asia/Tokyo |
| Web App access | MYSELF（所有者 `<email>` のみ）|
| ScriptProperties | `SPREADSHEET_ID` / `CALENDAR_ID=primary` |

---

## 📅 システム仕様の要点

- **月額コスト**: $0
- **実装工数**: 約 18.5h（実績）
- **ファイル**: `src/Code.gs` + `src/index.html` + `src/appsscript.json`
- **技術スタック**: Google Apps Script + HTML Service + Sheets + Calendar
- **外部ライブラリ**: なし（Vanilla JS のみ）
- **スプシ 12 列**: 受付ID / 登録日時 / 実施日 / 開始時刻 / 終了時刻 / 時間未定 / 依頼内容 / 依頼元 / 会場場所 / ステータス / 報酬種別 / CalendarイベントID

---

## 🔄 コード更新フロー

### 業務アカウント（本番）のコードを更新する
```bash
cd "/Users/kawanakenta/Cursol Project/業績管理アプリ"

# 1. 現在ログイン中のアカウントを確認
./node_modules/.bin/clasp login --status 2>/dev/null || cat ~/.clasprc.json | grep -o '"email":"[^"]*"' | head -1

# 2. 業務アカウントに切替（必要なら）
./node_modules/.bin/clasp logout
./node_modules/.bin/clasp login   # ブラウザで <email> を選択

# 3. コード push
./node_modules/.bin/clasp push --force

# 4. 既存の Web App URL を維持したままデプロイ
./node_modules/.bin/clasp deploy \
  --description "vX.X: 変更内容の説明" \
  --deploymentId <deployment-id>

# 5. GitHub に commit
git add src/
git commit -m "変更内容"
git push origin main

# 6. 個人アカウントに戻す（任意）
./node_modules/.bin/clasp logout
./node_modules/.bin/clasp login   # <email> を選択
```

### ⚠️ 重要
- `--deploymentId` を**必ず指定**すること（指定しないと新しい URL が生成されてしまう）
- ローカル `.clasp.json` は業務アカウントの Script ID を保持している
- 個人 Gmail でログイン中に `clasp push` しても、権限エラーで失敗するだけで破壊はしない

---

## 🧪 診断・メンテナンス用関数

Apps Script エディタで実行可能な関数（`src/Code.gs` に実装済）:

| 関数名 | 用途 |
|-------|------|
| `setupInitialData()` | 初回セットアップ（スプシ作成・ScriptProperties 登録）。2 回目以降は無視。 |
| `healthCheck()` | プロパティ確認 / スプシ行数 / Calendar 名を表示 |
| `debugSheet()` | スプシ全行をログ出力（型・値・JST 変換を詳細表示）|

---

## 📊 業績集計（スプシ側で手動作成）

### 月別件数（QUERY 関数例）
```
=QUERY(records!A:L, "SELECT MONTH(C), COUNT(A) WHERE J='active' GROUP BY MONTH(C) ORDER BY MONTH(C)", 1)
```

### 依頼元別集計（ピボットテーブル）
- 挿入 → ピボットテーブル
- 行: H 依頼元
- 値: A 件数

### 有償 / 無償 比率
```
=COUNTIF(records!K:K,"有償") & " 件 / " & COUNTIF(records!K:K,"無償") & " 件"
```

### 実施率
```
=COUNTIF(records!J:J,"active") / (COUNTA(records!A:A) - 1)
```

---

## 🛠 トラブルシュート

| 症状 | 対応 |
|------|------|
| 403 Forbidden | スマホブラウザが別アカウントにログイン中。`<email>` でログインし直す |
| 「Google で確認されていません」警告 | 自作アプリ。「詳細」→「安全でないページへ移動」で許可可能 |
| 登録したのに UI に出ない | Apps Script エディタで `debugSheet` を実行し、ログを確認 |
| カレンダーに孤児イベント残存 | エラー画面の `orphanEventId` でカレンダーから手動削除 |
| Calendar 削除失敗 | `healthCheck` で getDefaultCalendar() 動作確認 |
| 権限エラー | 一度 Web App URL を開き直す or Apps Script で同意し直す |
| コールドスタート遅い | 初回アクセス数秒待機。2 回目以降は高速 |

---

## 🗂 古いデプロイ（個人 Gmail 側）の扱い

開発初期に `<email>` で作成した古いアプリ・スプシが残っている可能性:

- Apps Script プロジェクト: `<script-id>qd1OhTBWVYuB9`
- 自動生成された古い「予約台帳」スプシ

不要なら個人 Gmail でログインして Drive / Apps Script から手動削除可能（任意）。

---

## 📌 今後の改善候補（TODO）

- [ ] 年次アーカイブ機能（スプシが 900,000 行を超えたとき用・実質数十年不要）
- [ ] `summary` シートの初期テンプレ自動生成
- [ ] 売上金額管理（Phase 3 相当、必要なら）
- [ ] LINE 通知連携（Phase 3 相当、必要なら）

※ 現時点では全て不要判定済み。必要になった段階で検討。

---

## 📚 関連ドキュメント

- [要件定義書 v4.0.1](./docs/sdd/REQUIREMENTS.md) — 最新の正式仕様
- [DEPLOYMENT.md](./DEPLOYMENT.md) — デプロイ完了サマリー
- [README.md](./README.md) — プロジェクト概要

### 別プロジェクト（リンクのみ）

- **ポートフォリオ自動公開ツール 要件定義書**
  - 保存先: `~/Desktop/portfolio-tool-requirements.md`
  - 用途: 毎月作成するアプリを Notion + GitHub に自動公開する汎用ツール
  - 開発場所: `~/Portfolio/`（新規ディレクトリを別途作成して開発）
  - 本アプリ を最初のテストケースとする
  - **このプロジェクト（本アプリ）とは完全に独立して開発**

---

## 🗓 変更履歴メモ

| 日付 | 内容 |
|------|------|
| 2026-04-19 | 初版リリース。v1.2 で本番稼働開始（業務アカウント `<email>`）|
| 2026-04-19 | v1.3 (@3 deploy): タイムゾーン・Sheet 値型のロバスト化（getMonthRecords / getRecord / checkSingleRecord 修正） |
| 2026-04-19 | 実機テスト完了、全 19 Issue クローズ |
| 2026-04-20 | clasp ログインを個人 Gmail に復帰。ポートフォリオ化の方針検討（別プロジェクトで実施予定） |
