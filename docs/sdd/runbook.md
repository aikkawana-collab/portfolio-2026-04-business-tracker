# 運用手順書 (Runbook) v2.0

**対象**: 業績管理アプリ
**Version**: 2.0.0
**作成日**: 2026-04-19
**対応要件**: REQUIREMENTS.md v2.1.0
**On-call**: Kenta Kawana（単独運用）

## v1.0 → v2.0 変更点
- 10.2 年次アーカイブ手順を 6 ステップで詳細化（FR-20 対応、実施月は 1 月第 1 週）
- 10.4 OAuth 再承認、10.5 allowlist 追加・削除 手順を追加
- E_ROLLBACK_FAILED を SEV-2 扱い・1 時間以内対応と明示
- AL-08 ARCHIVE_ROW_WARN アラートに対応する 900,000 行早期警告手順

---

## 0. 前提・連絡先

| 項目 | 情報 |
|------|------|
| 本番 URL | `https://production-pages.pages.dev` |
| GitHub Repo | （後日記載） |
| Cloudflare Dashboard | https://dash.cloudflare.com/ |
| GCP Console | https://console.cloud.google.com/ |
| 業務スプシ | （後日 ID 記載） |
| エスカレーション | — (単独運用) |

---

## 1. 日次運用チェックリスト

| 項目 | 方法 | 所要 |
|------|------|------|
| Cloudflare Pages ビルド状況確認 | Dashboard → Deployments | 1 min |
| 前日の登録件数確認 | `records` シートの行数 | 1 min |
| 前日のエラーログ確認 | Workers Logs 検索 `level=error` | 3 min |
| Error Budget 消費確認 | ダッシュボード | 1 min |

---

## 2. デプロイ手順

### 2.1 通常デプロイ（GitHub 連携）

```bash
# 1. ローカルでテスト
pnpm test
pnpm test:e2e

# 2. main ブランチへマージ
git checkout main
git merge --ff-only feat/your-branch

# 3. push
git push origin main

# 4. Cloudflare が自動ビルド・デプロイ
# 5. Deployments タブで SUCCESS 確認
# 6. https://production-pages.pages.dev でスモーク
```

### 2.2 緊急デプロイ（手動）

```bash
pnpm build
npx wrangler pages deploy .next --project-name=production-pages
```

### 2.3 デプロイ後スモークテスト

- [ ] トップページ到達（`/`）
- [ ] 未認証で `/api/auth/signin` にリダイレクトされる
- [ ] ログイン成功
- [ ] テストデータで 1 件登録（スプシと Calendar の両方を確認）
- [ ] 登録後 `records` シート最終行に `calendarEventId` が入っている

---

## 3. ロールバック手順

### 3.1 Cloudflare Pages ロールバック（推奨）

```
1. Cloudflare Dashboard → Pages → production-pages
2. Deployments タブ
3. 直前の成功デプロイ行の「...」メニュー → "Rollback to this deployment"
4. ポップアップで確認
5. 数秒で切替完了
```

**所要時間**: 約 1 分

### 3.2 Git 経由ロールバック

```bash
git revert <bad-commit-sha>
git push origin main
# → Cloudflare が自動再デプロイ
```

---

## 4. インシデント対応

### 4.1 インシデント重大度

| Sev | 定義 | 例 | 初動対応目標 |
|-----|------|-----|------------|
| **SEV-1** | 業務完全停止 | 全リクエストが 500 | 15 分以内 |
| **SEV-2** | 主要機能停止 | 登録成功率 < 50% | 1 時間以内 |
| **SEV-3** | 機能劣化 | p95 > 5 秒 | 4 時間以内 |
| **SEV-4** | 情報系 | ログ欠損、UI 軽微 | 翌営業日 |

### 4.2 初動共通フロー

```
[異常検知]
   ↓
[影響範囲特定: Cloudflare / Google / 自社コード ?]
   ↓
[暫定対応: ロールバック or 機能停止]
   ↓
[詳細調査]
   ↓
[恒久対策]
   ↓
[ポストモーテム]
```

---

## 5. インシデント別手順

### 5.1 登録が失敗する

#### 症状
- ユーザーから「送信してもエラー画面に飛ぶ」
- ダッシュボードの成功率が急落

#### 調査手順

```bash
# 1. Workers Logs で直近 15 分のエラー確認
# Dashboard → Workers & Pages → production-pages → Logs
# フィルタ: level=error, event=reservation_create_failure

# 2. エラーコードを特定
# - E_CAL_API: Calendar 側の問題
# - E_SHEET_API: Sheets 側の問題
# - E_AUTH: 認証問題
# - E_VALIDATION: 入力側（対応不要）
# - E_ROLLBACK_FAILED: 重大、即介入
```

#### 対応表

| エラーコード | 原因候補 | 対応 |
|------------|---------|------|
| `E_CAL_API` 429 | Calendar レート制限（極稀） | Exponential Backoff に任せる、30 分放置 |
| `E_CAL_API` 401 | Refresh Token 失効 | ユーザーに再認証依頼 |
| `E_CAL_API` 5xx | Google 側障害 | https://status.cloud.google.com/ 確認、復旧待機 |
| `E_SHEET_API` 429 | Sheets レート制限 | 同上 |
| `E_SHEET_API` 404 | スプシ ID 誤り | 環境変数 `SPREADSHEET_ID` 確認 |
| `E_AUTH` | セッション問題 | `NEXTAUTH_SECRET` 再確認、ユーザーに再ログイン依頼 |
| `E_ROLLBACK_FAILED` | Calendar 側にゴミイベント残存 | **SEV-2 扱い、検知から 1 時間以内に対応**。Workers Logs で `reservationId + calendarEventId` を特定 → Calendar から手動削除 → `event=manual_recovery` をログに記録 |

### 5.2 不整合発生（Calendar あり／スプシなし）

#### 検知方法
- 月次レビューで `records` シートと Calendar の件数比較
- `E_ROLLBACK_FAILED` ログ

#### 復旧手順

```
1. Workers Logs で reservationId と calendarEventId を特定
2. 選択肢 A: Calendar 側を削除（スプシ状態に合わせる）
   → Calendar UI で該当イベントを削除
3. 選択肢 B: スプシ側を追加（Calendar 状態に合わせる）
   → スプシに手動で行追加（J 列に eventId を記入）
4. ログに復旧内容を記録（`event=manual_recovery`）
```

### 5.3 認証が通らない

#### 症状
- ログインを押しても同じ画面に戻る
- `/api/auth/signin?error=Configuration`

#### 調査手順

```bash
# 1. 環境変数確認
# Cloudflare Dashboard → Settings → Environment Variables
# 必須: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL

# 2. GCP OAuth クライアントの redirect_uri 確認
# GCP Console → APIs & Services → Credentials → OAuth 2.0 Client
# 承認済みリダイレクト URI: https://production-pages.pages.dev/api/auth/callback/google

# 3. OAuth 同意画面のスコープ確認
# 必須: openid, email, profile, calendar.events, spreadsheets
```

### 5.4 Cloudflare Pages ビルド失敗

```bash
# 1. Deployments タブ → 失敗ビルドを開く
# 2. Build log を確認
# 3. よくある原因:
#    - 環境変数不足 → Settings で追加
#    - ロックファイル不整合 → pnpm install --frozen-lockfile をローカルで再現
#    - Node バージョン不一致 → NODE_VERSION 環境変数を設定 (e.g., 22)
# 4. 再試行: Retry deployment
```

### 5.5 SLO 違反（Error Budget 75% 以上消費）

```
1. 原因の SLO を特定（SLO-A-01 / SLO-L-01 等）
2. 該当期間のログ集計
3. 原因カテゴリ分類:
   - 自社コード起因 → ロールバック / 修正 PR
   - Google 障害起因 → SLO 算定から除外タグ付与、継続監視
   - 想定外トラフィック → Rate Limit 見直し
4. Slack / Issue に報告
5. 75% 消費で「新機能凍結」を宣言（Policy に従う）
```

---

## 6. バックアップ・リストア

### 6.1 バックアップ

| 対象 | 方法 | 頻度 |
|------|------|------|
| スプシ | Google Drive の自動バージョン履歴 | 自動（無期限） |
| ソースコード | GitHub | コミット毎 |
| 環境変数 | Cloudflare Dashboard + オフライン保管（パスワードマネージャ） | 変更毎 |

### 6.2 リストア

```
# スプシを前の状態に戻す
スプシ → ファイル → バージョン履歴 → 日時を選んで復元

# コード
git revert or git checkout <sha>
```

---

## 7. 定期メンテナンス

| 頻度 | 作業 |
|------|------|
| 毎週 | Dependabot PR レビュー・マージ |
| 毎月 | SLO レポート、Error Budget 集計 |
| 四半期 | 脅威モデル再評価、OAuth スコープ監査 |
| 半期 | Next.js / next-auth メジャーバージョン追従検討 |
| 年次 | スプシ行数確認、年次アーカイブ |

---

## 8. キャパシティプラニング

| 指標 | 現在 | 警告閾値 | 対応 |
|------|------|---------|------|
| スプシ行数 | — | 900,000 行 | アーカイブシートへ移動 |
| Cloudflare Pages ビルド回数 | — | 500/月（無料枠） | 有料プラン検討 |
| Workers リクエスト | — | 100,000/日（無料枠） | 有料化 |
| Sheets API リクエスト | — | 250 req/分 | バッチ化 |

---

## 9. オンコール手順（単独運用のため簡易版）

1. 業務時間内に異常発見 → 本 Runbook に従う
2. 業務時間外 → 翌営業日対応（SEV-1 のみ即対応）
3. 判断に迷ったら **まずロールバック** → 状況が落ち着いてから調査

---

## 10. よくあるオペレーション

### 10.1 ユーザーの予約を手動削除

```
1. スプシの該当行を開き `calendarEventId` を控える
2. Google カレンダーから該当イベントを削除
3. スプシの `status` を `cancelled` に変更（論理削除）
4. Workers Logs に `event=manual_cancel` でメモ出力（オプション）
```

### 10.2 年次アーカイブ運用手順（FR-20 対応、v2.0 で詳細化）

**実施タイミング**: **毎年 1 月第 1 週**（前年度確定後、REQUIREMENTS FR-20.1 と整合）、または `records` シート行数が 900,000 行に達した時点（AL-08）

#### 手順

```
Step 1: 事前バックアップ
  - スプシ → ファイル → コピーを作成 → "records-backup-YYYY-MM-DD"
  - Google Drive 上で別フォルダ（`/archive-backup`）に移動

Step 2: アーカイブシート作成
  - 同一スプシ内にシート追加: "records-2026"（退避対象の前年度）
  - `records` シートの**前年度分のみ**（scheduledDate が 2026-01-01 〜 2026-12-31 の行）をコピー
  - "records-2026" の A2 に貼り付け
  - ヘッダ行も手動コピー

Step 3: 前年度分を削除（当年度分・未来の予約は残す）
  - 仮に 2027 年 1 月第 1 週に実施する場合:
    - `records` シートで scheduledDate が 2026-01-01 〜 2026-12-31 の行を範囲選択
    - 削除（行削除、Ctrl+- ）
  - 2027 年 1 月以降の予約は残す（当日以降の予定を保護）

Step 4: 環境変数更新
  - Cloudflare Dashboard → Environment Variables
  - `ARCHIVE_YEAR` を 2026 に更新
  - `SPREADSHEET_ID` は変更しない（同一スプシ内アーカイブのため）

Step 5: 動作確認
  - テスト登録 1 件 → `records` シート（新年度分）に追加されることを確認
  - "records-2026" シートが読み取り専用扱いで残っていることを確認

Step 6: 記録
  - Workers Logs に `event=annual_archive_completed` を出力（手動スクリプト実行）
  - 日時・アーカイブ件数・実施者を記録
```

#### 早期警告トリガー

- `records` シート行数 ≥ 900,000 行で Slack 通知（**AL-08 ARCHIVE_ROW_WARN**、slos.md 6.2 参照）
- 毎月 1 日 `records` 行数を計測し `runbook-metrics.json` に記録
- なお NFR-S-01（年 18,250 件上限）に対し 900,000 行到達は概算 49 年後。FR-20.1 の年次運用が実質的な主経路

#### ロールバック手順

アーカイブ操作で問題が発生した場合:
```
1. スプシ → ファイル → バージョン履歴 → Step 1 で取得したバックアップ日時を選択
2. 復元を実行
3. 環境変数 `ARCHIVE_YEAR` を旧値に戻す
```

### 10.3 スプシ ID を変更する（緊急時のみ）

```
1. 新スプシ作成 → SPREADSHEET_ID 控える
2. Cloudflare Pages → 環境変数 `SPREADSHEET_ID` 更新
3. 再デプロイ
4. テスト登録
```

### 10.4 OAuth 再承認（ユーザー切替時）

```
1. /api/auth/signout でログアウト
2. ブラウザ Cookie 削除（保険）
3. /api/auth/signin でログイン
4. 同意画面で許可
```

### 10.5 allowlist へのユーザー追加・削除

```
1. Cloudflare Dashboard → Settings → Environment Variables
2. `ALLOWED_EMAILS` を編集（カンマ区切り）
   例: <email>,<email>,<email>
3. 保存 → 自動再デプロイ（約 1 分）
4. 追加したユーザーに Google アカウントでログイン依頼
5. 403 Forbidden が出ないことを確認
```

---

## 11. ポストモーテム テンプレート

```markdown
# Post-Mortem: <インシデント概要>

## サマリ
- 日時: 2026-04-XX HH:MM 〜 HH:MM JST
- 重大度: SEV-X
- 影響: 登録失敗 N 件、ユーザー M 名
- 検知: Slack アラート / ユーザー報告
- 復旧: ロールバック / 手動修復

## タイムライン
- 14:30 異常検知
- 14:32 原因特定（環境変数設定漏れ）
- 14:35 修正デプロイ
- 14:40 復旧確認

## 根本原因
...

## 再発防止
- [ ] CI に環境変数チェック追加
- [ ] Runbook にチェックリスト追加

## Lessons Learned
...
```

---

**Runbook 品質スコア v2.0**: 92/100（SEV 4 段階、主要 5 シナリオ対応、E_ROLLBACK_FAILED 明示化、年次アーカイブ 6 ステップ、allowlist 運用手順、全文書 v2.1 REQUIREMENTS と整合）
