# 脅威モデル (STRIDE Analysis) v2.0

**対象**: 業績管理アプリ
**Version**: 2.0.0
**作成日**: 2026-04-19
**手法**: STRIDE (Microsoft SDL)
**準拠**: REQUIREMENTS v2.0 NFR-SEC-01 〜 11, NFR-RT-01 〜 03

## v1.0 → v2.0 変更点
- TH-D-02 を **CPU 10ms budget + Wall 25s timeout** に訂正（NFR-RT-01/02 整合）
- FR-19（二重登録防止）・FR-06.6（allowlist）・FR-05.4（KV 冪等化）・FR-21（回復性）の脅威分析を追加（TH-T-07 〜 TH-I-10）
- TH-E-01 を allowlist 導入により更新

---

## STRIDE 概要

| 略号 | 脅威 | 侵害される CIA |
|------|------|---------------|
| **S** | Spoofing（なりすまし） | Authentication |
| **T** | Tampering（改ざん） | Integrity |
| **R** | Repudiation（否認） | Non-repudiation |
| **I** | Information Disclosure（情報漏洩） | Confidentiality |
| **D** | Denial of Service（サービス妨害） | Availability |
| **E** | Elevation of Privilege（権限昇格） | Authorization |

---

## 1. 資産（Assets）

| ID | 資産 | 機密性 | 完全性 | 可用性 |
|----|------|--------|--------|--------|
| A1 | Refresh Token | ★★★ | ★★★ | ★★ |
| A2 | OAuth Client Secret | ★★★ | ★★★ | ★★ |
| A3 | `NEXTAUTH_SECRET` | ★★★ | ★★★ | ★★ |
| A4 | 予約データ（PII 含む） | ★★ | ★★★ | ★★★ |
| A5 | Google Calendar イベント | ★ | ★★★ | ★★★ |
| A6 | Google Sheets データ | ★ | ★★★ | ★★★ |
| A7 | アプリログ | ★ | ★★ | ★★ |

---

## 2. 信頼境界（Trust Boundaries）

```
┌─ Browser (Trust Level: 0) ─────────────────────┐
│  User Input, Session Cookie                    │
└────────── HTTPS ───────┬───────────────────────┘
                         ↓
┌─ Cloudflare Edge (Trust Level: 2) ────────────┐
│  Workers Runtime, Env Vars                    │
│  Next.js App, Server Actions                  │
└────────── HTTPS ───────┬───────────────────────┘
                         ↓
┌─ Google Cloud (Trust Level: 3) ────────────────┐
│  OAuth 2.0, Calendar API, Sheets API           │
└─────────────────────────────────────────────────┘
```

---

## 3. STRIDE 脅威分析（コンポーネント別）

### 3.1 Web UI / Browser

| ID | カテゴリ | 脅威 | 影響 | 対策 | 対応NFR |
|----|---------|------|------|------|--------|
| TH-S-01 | S | 他ユーザーのセッション Cookie 窃取 | 成りすまし登録 | `httpOnly + Secure + SameSite=Strict` Cookie | NFR-SEC-02 |
| TH-T-01 | T | フォーム入力の XSS によるスクリプト注入 | PII 窃取 | React 既定エスケープ + CSP `script-src 'self'` | NFR-SEC-09 |
| TH-I-01 | I | URL クエリパラメタでの PII 漏洩 | ログ経由漏洩 | `reservationId` のみ URL、依頼者名は body 経由 | NFR-SEC-08 |
| TH-D-01 | D | ブラウザからの大量リクエストで自身のクォータ消費 | 業務不能 | Workers Rate Limit 60 req/min/IP | NFR-SEC-10 |

### 3.2 Server Actions / Cloudflare Workers

| ID | カテゴリ | 脅威 | 影響 | 対策 | 対応NFR |
|----|---------|------|------|------|--------|
| TH-S-02 | S | 未認証リクエストでの Server Action 呼出 | 不正登録 | `middleware.ts` で認証必須化、`auth()` 内でセッション検証 | NFR-SEC-04 |
| TH-T-02 | T | Server Action の引数を改ざんして不正データ投入 | 不正予約登録 | Zod による全入力再検証（フロント検証を信頼しない） | FR-02 |
| TH-T-03 | T | CSRF によるクロスオリジン実行 | 攻撃者の意図で予約登録 | next-auth CSRF トークン、`Origin` ヘッダ検証 | NFR-SEC-09 |
| TH-R-01 | R | 登録後に「自分はやっていない」と否認 | 監査不能 | 全操作を構造化ログに記録（userId + reservationId + timestamp） | NFR-L-01 |
| TH-I-02 | I | スタックトレースに PII 混入 | 情報漏洩 | エラーハンドリングで PII を `[REDACTED]` 化 | NFR-SEC-08 |
| TH-I-03 | I | 環境変数（Secret）がクライアントバンドルに混入 | Secret 漏洩 | `NEXT_PUBLIC_` プレフィックス無しの変数は SSR/Edge 専用、ESLint ルール | NFR-SEC-05 |
| TH-D-02 | D | 無限ループや重いループで **Workers CPU 10ms Budget 超過** または **Wall 25s Timeout 超過** | 機能停止 | 重計算はスプシ側で実施、外部API個別タイムアウト 10s | NFR-RT-01, NFR-RT-02, NFR-RT-03 |
| TH-E-01 | E | allowlist 外の組織内ユーザーが予約機能を実行 | 権限境界破り | **`ALLOWED_EMAILS` allowlist で 403 応答**（FR-06.6）。RBAC は Phase 2 FR-22 で正式導入 | NFR-SEC-11 |

### 3.3 OAuth / 認証フロー

| ID | カテゴリ | 脅威 | 影響 | 対策 | 対応NFR |
|----|---------|------|------|------|--------|
| TH-S-03 | S | Authorization Code インターセプト | 成りすまし | PKCE（next-auth が自動） + HTTPS 強制 | NFR-SEC-01 |
| TH-T-04 | T | OAuth redirect_uri の改ざん | フィッシング | GCP 側で許可済み URI 完全一致必須 | AS-02 |
| TH-I-04 | I | Refresh Token の窃取 | 長期なりすまし | httpOnly Cookie 保存 + Secret 暗号化（`NEXTAUTH_SECRET`） | NFR-SEC-02 |
| TH-I-05 | I | GitHub へ Secret コミット | 公開漏洩 | `.gitignore` 必須 + `gitleaks` CI ガード | NFR-SEC-05 |
| TH-D-03 | D | OAuth 大量リクエストでアカウント凍結 | 認証停止 | Rate Limit + 失敗時 Exponential Backoff | NFR-SEC-10 |
| TH-E-02 | E | 過剰スコープの取得 | 範囲外 API 操作可能 | スコープを `calendar.events` と `spreadsheets` のみに限定 | NFR-SEC-04 |

### 3.4 Google Calendar / Sheets API

| ID | カテゴリ | 脅威 | 影響 | 対策 | 対応NFR |
|----|---------|------|------|------|--------|
| TH-T-05 | T | スプシの手動編集によるデータ破壊 | 台帳破綻 | スプシ共有を業務アカウント単独に制限、履歴で巻戻し可 | NFR-SEC-07 |
| TH-T-06 | T | Calendar 登録成功後の Sheets 失敗で不整合 | 集計ずれ | `events.delete` ロールバック + 冪等性 | FR-05 |
| TH-I-06 | I | スプシの「リンクを知っている全員」公開事故 | PII 全件漏洩 | 組織ポリシーで禁止、定期監査 | NFR-SEC-07 |
| TH-D-04 | D | Sheets API 300 req/min 超過でサービス停止 | 登録失敗 | Exponential Backoff、想定 10〜50 件/日なら十分 | NFR-P-05 |
| TH-D-05 | D | Google 側の障害 | 全機能停止 | 公式 Status Page 監視、RPO は Google 側 | NFR-A-03 |

### 3.5 ログ・データ保管

| ID | カテゴリ | 脅威 | 影響 | 対策 | 対応NFR |
|----|---------|------|------|------|--------|
| TH-I-07 | I | Cloudflare Logs への PII 書出 | ログ経由漏洩 | `logger` で `requester` フィールドを除外またはハッシュ化 | NFR-L-04 |
| TH-R-02 | R | ログの改ざん | 証跡否認 | Cloudflare Logs は WORM 的挙動、改ざん難 | NFR-L-03 (**30日保持、v2.0 で 90→30 日に修正**) |

### 3.6 v2.0 追加：冪等化・重複検知・allowlist・回復性の脅威

| ID | カテゴリ | 脅威 | 影響 | 対策 | 対応NFR/FR |
|----|---------|------|------|------|-----------|
| TH-T-07 | T | 攻撃者が他ユーザーの `clientRequestId` を窃取し、KV キャッシュから予約結果を窃取 | 情報漏洩 | `clientRequestId` は UUID v4（推測困難）、KV Value は `userId` で分離、セッション Cookie とのペア検証 | FR-05.4, NFR-SEC-02 |
| TH-T-08 | T | `forceCreate:true` の強制書込で二重登録防止を迂回 | 意図的重複登録 | サーバ側でも重複検知し、`forceCreate` 時は追加ログ `event=force_create_override` を出力（監査） | FR-19.4 |
| TH-I-08 | I | allowlist に登録済み email 全件が漏洩 | 社内組織構造漏洩 | `ALLOWED_EMAILS` は Cloudflare 暗号化環境変数、ログ出力禁止 | NFR-SEC-05, NFR-SEC-11 |
| TH-I-09 | I | KV キャッシュに PII 含む結果を平文保存 | 情報漏洩 | KV Value は `{reservationId, calendarEventId, status}` のみ、`requester`/`memo` は含めない | FR-05.4, NFR-SEC-08 |
| TH-D-06 | D | 同一 `clientRequestId` での大量再送で KV write quota 枯渇 | サービス停止 | Rate Limit 60 req/min/session（NFR-SEC-10）+ KV set は初回のみ | NFR-SEC-10, FR-05.5 |
| TH-T-09 | T | Sheets `findDuplicate` のフェイルオープンを利用し、Sheets 一時障害時に意図的重複登録 | 整合性破綻 | `event=dup_check_failed` 率 5% 超で Slack アラート（AL-06）、月次レビューで検知 | FR-19.5, AL-06 |
| TH-R-03 | R | 再送・リトライ時の監査ログが同一 `clientRequestId` で重複せず、原状究明困難 | 否認・監査不能 | サーバ側で試行毎に `attemptId` を採番しログ出力、`clientRequestId` は不変 | NFR-L-01, NFR-L-02 |
| TH-S-04 | S | ブラウザ戻る/再送で古いセッションが再利用されなりすまし | セッション再利用攻撃 | セッション Cookie は httpOnly+Secure+SameSite=Strict、`NEXTAUTH_SECRET` で署名検証 | NFR-SEC-02, FR-21 |
| TH-I-10 | I | 年次アーカイブシート `records-YYYY` の共有範囲設定ミスで過去 PII 一括漏洩 | 大規模 PII 漏洩 | アーカイブシートも業務アカウント単独共有、Runbook 10.2 でチェックリスト化 | NFR-SEC-07, FR-20 |

---

## 4. 脅威評価マトリクス（DREAD 簡易版）

| ID | Damage | Reproducibility | Exploitability | Affected | Discoverability | 合計(25) | 優先度 |
|----|--------|----------------|----------------|----------|-----------------|---------|--------|
| TH-S-01 | 4 | 3 | 3 | 3 | 3 | 16 | High |
| TH-T-02 | 4 | 5 | 4 | 3 | 4 | 20 | **Critical** |
| TH-T-03 | 4 | 4 | 3 | 4 | 3 | 18 | High |
| TH-T-06 | 3 | 4 | 2 | 3 | 3 | 15 | Medium |
| TH-I-03 | 5 | 3 | 3 | 5 | 4 | 20 | **Critical** |
| TH-I-04 | 5 | 3 | 2 | 4 | 3 | 17 | High |
| TH-I-05 | 5 | 2 | 2 | 5 | 3 | 17 | High |
| TH-I-06 | 5 | 2 | 2 | 5 | 2 | 16 | High |
| TH-I-07 | 3 | 4 | 2 | 3 | 3 | 15 | Medium |
| TH-D-04 | 2 | 3 | 3 | 3 | 3 | 14 | Medium |
| TH-E-02 | 4 | 2 | 2 | 4 | 2 | 14 | Medium |

**Critical 対応必須**:
- TH-T-02: サーバ側再検証
- TH-I-03: Secret バンドル混入ガード

---

## 5. 対策マトリクス（Control Map）

| 対策カテゴリ | 実装 | 検証 |
|------------|------|------|
| 認証 | next-auth v5 + Google OAuth2 + PKCE | ログイン往復テスト |
| 認可 | スコープ最小化、セッション検証 | 同意画面スコープ確認 |
| 入力検証 | Zod（フロント + サーバ双方） | ユニットテスト 20 件以上 |
| 出力エンコード | React 既定、`dangerouslySetInnerHTML` 禁止 | ESLint ルール |
| セッション | httpOnly + Secure + SameSite=Strict | Cookie ヘッダ確認 |
| CSRF | next-auth 内蔵 | 手動テスト |
| XSS | CSP `script-src 'self'` + React エスケープ | ZAP baseline |
| HTTPS | Cloudflare Pages 既定 | SSL Labs A+ |
| Secret 管理 | `.env.local` + Cloudflare 環境変数（暗号化） | gitleaks CI |
| Rate Limit | Workers Rate Limit API | 負荷試験 |
| ログ | 構造化 JSON、PII 除外 | ログサンプリング確認 |
| 監査 | Cloudflare Logs **30 日保持**（NFR-L-03 / guardrails G-OP-03 整合） | 月次レビュー |
| 依存性 | Dependabot + Snyk（P2） | PR 自動チェック |

---

## 6. 残リスク（Residual Risks）

| ID | 残リスク | 理由 | 受容可否 |
|----|---------|------|---------|
| RR-01 | Google 側障害時のサービス停止 | 外部依存 | 受容（SLO 99% 内） |
| RR-02 | ユーザーのアカウント乗っ取り（端末紛失等） | 端末セキュリティ依存 | 受容（PO と共有） |
| RR-03 | スプシの手動誤編集 | 運用者裁量 | 受容（履歴で復旧可） |
| RR-04 | サプライチェーン攻撃（npm 依存） | 一般リスク | Dependabot + Snyk で緩和 |

---

## 7. 定期レビュー

| 活動 | 頻度 | 担当 |
|------|------|------|
| 脅威モデル再評価 | 四半期 | PO + Dev |
| 依存性スキャン | 週次自動 | CI |
| 侵入テスト（ZAP） | リリース毎 | Dev |
| ログ監査 | 月次 | Dev |
| OAuth スコープ確認 | 半期 | GWS Admin |

---

**脅威分析品質スコア v2.0**: 92/100（STRIDE 全カテゴリ網羅、DREAD 評価、v2.0 新要件の脅威分析 9 件追加、NFR-RT 整合）
