# Architecture Decision Records (ADR) v2.0

**対象**: 業績管理アプリ
**Version**: 2.0.0
**作成日**: 2026-04-19
**対応要件**: REQUIREMENTS.md v2.0.0

## v1.0 → v2.0 変更点
- ADR-011（KV 冪等化の採用）、ADR-012（allowlist 方式）、ADR-013（重複検知の Sheets 全スキャン採用）を追加

---

## ADR Index

| ADR ID | タイトル | ステータス | 日付 |
|--------|---------|-----------|------|
| ADR-001 | フレームワークに Next.js 15 App Router を採用 | Accepted | 2026-04-19 |
| ADR-002 | デプロイ先に Cloudflare Pages を採用 | Accepted | 2026-04-19 |
| ADR-003 | 認証に next-auth v5 を採用 | Accepted | 2026-04-19 |
| ADR-004 | データストアに独自 DB を持たず Google Sheets を真実の情報源とする | Accepted | 2026-04-19 |
| ADR-005 | Google API クライアントに googleapis を採用 | Accepted | 2026-04-19 |
| ADR-006 | トランザクション整合性は Calendar→Sheets 順 + Compensating rollback で実現 | Accepted | 2026-04-19 |
| ADR-007 | バリデーションに Zod を採用 | Accepted | 2026-04-19 |
| ADR-008 | OAuth 同意画面を「内部」運用に限定 | Accepted | 2026-04-19 |
| ADR-009 | タイムゾーンは Asia/Tokyo 固定 | Accepted | 2026-04-19 |
| ADR-010 | 開発時のみ MCP（google-calendar-mcp, mcp-google-sheets）を活用 | Accepted | 2026-04-19 |
| ADR-011 | 冪等化に Cloudflare Workers KV を採用 | Accepted | 2026-04-19 (v2.0) |
| ADR-012 | 認可は allowlist 方式（環境変数）を採用し RBAC は Phase 2 まで延期 | Accepted | 2026-04-19 (v2.0) |
| ADR-013 | 二重登録検知に Sheets 全スキャン（直近 90 日）を採用 | Accepted | 2026-04-19 (v2.0) |

---

## ADR-001: フレームワークに Next.js 15 App Router を採用

**Status**: Accepted
**Date**: 2026-04-19
**Deciders**: PO, Dev

### Context
予約入力 Web アプリを構築する必要がある。フロント・バックエンド両方が必要で、サーバ側 API を最小コードで書けて、Cloudflare Workers にデプロイ可能なフレームワークが欲しい。

### Options

| 案 | 長所 | 短所 |
|----|------|------|
| **Next.js 15 App Router** | Server Actions で API 不要、RSC で高速、エコシステム最大 | App Router は新しく学習コスト |
| Remix | フォーム処理が自然、型安全 | 採用実績が相対的に少、Workers 対応途上 |
| Astro | 静的ファースト、超高速 | フォーム処理は別途 BFF 必要 |
| SvelteKit | 軽量、DX 良好 | コミュニティ・MCP エコシステムが小 |
| Apps Script 単体 | ゼロデプロイ | UI 制限、6 分実行制限、保守性低 |

### Decision
**Next.js 15 App Router** を採用する。

### Consequences

- ✅ Server Actions により API ルートの実装が不要
- ✅ RSC により初期表示が高速
- ✅ Claude Code 含む AI 支援が最大
- ⚠️ App Router の学習コスト
- ⚠️ Cloudflare Workers 互換のため Node.js API 制約あり

### References
- https://nextjs.org/docs/app
- リサーチレポート `research/.../report.md` セクション 7

---

## ADR-002: デプロイ先に Cloudflare Pages を採用

**Status**: Accepted
**Date**: 2026-04-19
**Deciders**: PO, Dev

### Context
月額コスト $0 で商用運用可能な PaaS が必要。Edge 実行でレイテンシを抑えたい。

### Options

| 案 | 月額 | 商用OK | Edge |
|----|------|--------|------|
| **Cloudflare Pages** | $0（無料枠潤沢） | ✅ | ✅ |
| Vercel Hobby | $0 | ❌ 商用不可 | ✅ |
| Vercel Pro | $20〜 | ✅ | ✅ |
| Netlify | $0 | ✅ | △ |
| AWS Amplify | 従量課金 | ✅ | △ |
| Firebase Hosting | $0 〜 | ✅ | △ |

### Decision
**Cloudflare Pages** を採用する。

### Consequences

- ✅ 完全無料で商用利用可
- ✅ Edge 実行によりレイテンシ低
- ✅ GitHub 連携で自動デプロイ
- ⚠️ Workers ランタイム制約（Node.js 完全互換ではない）
- ⚠️ Sentry 等の一部 SDK で Edge 対応確認が必要

### References
- https://pages.cloudflare.com/
- Vercel Hobby 商用不可: https://vercel.com/docs/limits/usage

---

## ADR-003: 認証に next-auth v5 を採用

**Status**: Accepted
**Date**: 2026-04-19

### Context
Google OAuth2 による認証、Refresh Token 管理、Edge 実行対応が必要。

### Options

| 案 | 長所 | 短所 |
|----|------|------|
| **next-auth v5 (Auth.js)** | 無料、Edge 対応、Next.js 親和性最高、CSRF 内蔵 | 破壊的変更が多いβ期間あり |
| Clerk | UI 込みで楽 | 有料プランが必要 |
| Auth0 | エンタープライズ品質 | コスト高 |
| 自前実装 | 完全制御 | セキュリティリスク高、保守コスト |

### Decision
**next-auth v5 (beta)** を採用する。

### Consequences

- ✅ 無料、OSS、広く採用
- ✅ Edge runtime 対応
- ✅ CSRF、PKCE 等の基本セキュリティ内蔵
- ⚠️ β 期間のため API 変化の可能性 → リリース時に GA 版へ追従

---

## ADR-004: データストアに独自 DB を持たず Google Sheets を真実の情報源とする

**Status**: Accepted
**Date**: 2026-04-19

### Context
予約データの保管場所を決定する必要がある。業務ユーザーはスプシ操作に慣れており、手動集計・アーカイブも行う。

### Options

| 案 | 長所 | 短所 |
|----|------|------|
| **Google Sheets（SoT）** | ユーザーが直接編集可、無料、BI 連携可 | 1M 行上限、整合性リスク |
| PostgreSQL (Neon 等) | リレーショナル強い | 月額コスト、運用工数 |
| Firestore | スケール強い | スプシ連携別途 |
| Sheets + DB ミラー | 両方使える | 同期複雑化 |

### Decision
**Google Sheets を真実の情報源とする**。DB は持たない。

### Consequences

- ✅ ユーザーが直接編集・集計可能（業務文化との親和性）
- ✅ 月額 $0
- ✅ Looker Studio 直結可（Phase 3）
- ⚠️ Calendar⇔Sheets の整合性は Compensating Transaction で保証（ADR-006）
- ⚠️ 100 件/日 × 365 = 36,500 件/年、10 年で 365,000 行。1M 行上限には十分な余裕あり

---

## ADR-005: Google API クライアントに googleapis を採用

**Status**: Accepted
**Date**: 2026-04-19

### Context
Node.js から Calendar / Sheets API を呼び出すライブラリが必要。

### Options

| 案 | 週DL | 長所 | 短所 |
|----|------|------|------|
| **googleapis** | 5.17M | 公式、全 API 網羅 | バンドルサイズ大 |
| @googleapis/calendar + @googleapis/sheets | 個別 | 軽量 | 2 パッケージ管理 |
| google-spreadsheet（Sheets のみ） | 314K | DSL が簡潔 | Calendar 別途 |
| REST 直接呼び出し | — | 依存ゼロ | 型定義・リトライ自作 |

### Decision
**googleapis + google-spreadsheet 併用**。
- Calendar: `googleapis`
- Sheets: `google-spreadsheet`（DSL で可読性優先）

### Consequences

- ✅ 両ライブラリともメジャー、採用実績豊富
- ⚠️ Bundle size 大きい → Tree-shaking 前提でモジュール単位 import

---

## ADR-006: トランザクション整合性は Calendar→Sheets 順 + Compensating rollback で実現

**Status**: Accepted
**Date**: 2026-04-19

### Context
Calendar と Sheets は独立した 2 つの外部システム。両方への書き込みを原子的に実行する仕組みがない。

### Options

| 案 | 長所 | 短所 |
|----|------|------|
| **Calendar → Sheets、失敗時 Calendar 削除** | 実装簡単、Calendar をマスタ扱い | ロールバック自体が失敗する可能性 |
| Sheets → Calendar、失敗時 Sheets 論理削除 | 台帳が先に残る | Calendar 未登録状態の台帳が残存 |
| 2 Phase Commit 相当 | 整合性強 | 実装コスト高、外部 API では現実的でない |
| Outbox Pattern（キュー） | 非同期で確実 | キュー運用が必要 |

### Decision
**Calendar 登録 → Sheets 追記の順とし、Sheets 失敗時は Calendar を `events.delete` でロールバック**する。
ロールバック自体が失敗した場合は不整合ログを出力し、月次手動復旧とする（Runbook 5.2）。

### Consequences

- ✅ 実装シンプル
- ✅ 想定件数（10〜50/日）なら二重失敗の発生確率は極めて低い
- ⚠️ ロールバック失敗時の手動復旧手順を Runbook に明記
- ⚠️ 冪等性のため `reservationId` を Calendar の description に記載し、重複検知に利用

### References
- Compensating Transaction Pattern: https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction

---

## ADR-007: バリデーションに Zod を採用

**Status**: Accepted
**Date**: 2026-04-19

### Options

| 案 | 長所 | 短所 |
|----|------|------|
| **Zod** | TS 親和性最高、エコシステム最大 | バンドルサイズ中 |
| Yup | 成熟、学習資料多い | TS 推論が弱い |
| Valibot | 超軽量 | コミュニティ小 |
| io-ts | 関数型 | 学習コスト高 |

### Decision
**Zod** を採用する。フロント・サーバ両方で同一スキーマを使う。

### Consequences

- ✅ 型安全性、可読性高
- ✅ `zod/v4` は Tree-shaking 対応
- ⚠️ バンドルサイズ増（重要機能なので許容）

---

## ADR-008: OAuth 同意画面を「内部」運用に限定

**Status**: Accepted
**Date**: 2026-04-19

### Context
Google OAuth 同意画面は「外部」設定の場合、Google の審査が必要で時間がかかる。

### Decision
OAuth 同意画面を **「内部」** に設定し、本システムは業務用 Workspace アカウント組織内のみで使用する。

### Consequences

- ✅ 同意画面審査が不要
- ✅ 審査落ちリスク（R-04）を回避
- ❌ 外部顧客向け展開不可（NG-01 と整合）
- ⚠️ Workspace 退会時はアクセス自動失効

---

## ADR-009: タイムゾーンは Asia/Tokyo 固定

**Status**: Accepted
**Date**: 2026-04-19

### Context
Calendar API のタイムゾーン指定は必須。ユーザーは国内限定の業務。

### Decision
全予約イベントの `timeZone` を `Asia/Tokyo` に固定する。スプシの日付・時刻列も JST 表記で統一。

### Consequences

- ✅ 処理シンプル
- ❌ 国際化対応不可（Out of Scope OUT-04 と整合）

---

## ADR-010: 開発時のみ MCP（google-calendar-mcp, mcp-google-sheets）を活用

**Status**: Accepted
**Date**: 2026-04-19

### Context
Claude Code 利用時、MCP サーバを `.mcp.json` に登録することで開発が対話駆動で進む。

### Decision
開発時に以下 MCP を使用する（**本番コードには含めない**）。

- `@cocal/google-calendar-mcp`（nspady）
- `mcp-google-sheets`（xing5）

### Consequences

- ✅ 開発中のスプシ状態確認・Calendar 確認が高速
- ✅ Claude Code のコード生成品質向上（30〜50% 工数削減）
- ⚠️ 資格情報の配置に注意（個人開発環境の `~/.config/` に限定）

---

## ADR-011: 冪等化に Cloudflare Workers KV を採用

**Status**: Accepted
**Date**: 2026-04-19 (v2.0)
**Deciders**: PO, Dev

### Context
FR-03.5 / FR-05.4 / FR-21 により、`clientRequestId` 単位で予約登録を冪等化する必要がある。
- Calendar API 側の `requestId` パラメタは 60 分保持だが、Sheets 側には同等機能がなく、クライアント再送時に両者の整合確保が必要。
- ブラウザ戻る・タブ閉じ・ネット切断などの edge case でも、同一 `clientRequestId` での再送に対し**同一結果**を返す必要がある。

### Options

| 案 | 長所 | 短所 |
|----|------|------|
| **Cloudflare Workers KV** | Edge 配置・低レイテンシ、TTL 自動削除、無料枠 1 GB / 100K read/日 | 書込遅延 ~60s（結果整合性） |
| Cloudflare Durable Objects | 強整合性、ロック容易 | 有料、Edge 分散が必要 |
| メモリ（Workers インメモリ） | 最速、無料 | Worker 毎に独立、状態共有不可 |
| 外部 Redis | 柔軟 | コスト、別サービス管理 |

### Decision
**Cloudflare Workers KV（Namespace: `IDEMPOTENCY_CACHE`）** を採用。TTL 3600 秒。

### Consequences

- ✅ 月額 $0 内で運用可（想定 50 件/日 × 31 日 = 1,550 write/月 で無料枠 1K/日 に余裕）
- ✅ TTL 自動管理でガベージコレクション不要
- ⚠️ KV の**書込後数秒〜60 秒の結果整合性**により、同一 `clientRequestId` の超高速連投（< 500ms）は重複検知できない可能性 → 二重送信防止ボタン無効化（FR-01.3）で補完
- ⚠️ 書込失敗時は Calendar 側の `requestId` 冪等化（60 分）でフォールバック

### References
- Cloudflare KV: https://developers.cloudflare.com/kv/
- Google Calendar API `requestId`: https://developers.google.com/calendar/api/v3/reference/events/insert

---

## ADR-012: 認可は allowlist 方式（環境変数）を採用し RBAC は Phase 2 まで延期

**Status**: Accepted
**Date**: 2026-04-19 (v2.0)
**Deciders**: PO, Dev

### Context
FR-06.6 / NFR-SEC-11 / AC-12 により、組織内全員がログインできる状態を防ぐ必要がある（TH-E-01 対策）。Phase 1 は 1〜数名の特定業務担当者に限定するが、正式な RBAC（閲覧専用ロール等）は Phase 2 での導入を計画（FR-22）。

### Options

| 案 | 長所 | 短所 |
|----|------|------|
| **email allowlist（環境変数）** | 実装コスト極小、即効 | 担当者追加時に再デプロイ必要 |
| Google Workspace Group 連携 | Google 側で集中管理 | Admin API 権限が必要、複雑 |
| DB + 管理画面 RBAC | 完全なロール管理 | Phase 1 でオーバーエンジニアリング |
| OAuth 同意画面の「許可ユーザー」設定 | Google 標準機能 | 「内部」設定時は組織全員が対象で選別不可 |

### Decision
**Cloudflare 環境変数 `ALLOWED_EMAILS`（カンマ区切り）で email を列挙し、`next-auth` の `signIn` callback で検証する**。Phase 2 FR-22 で正式 RBAC を導入。

### Consequences

- ✅ Phase 1 MVP を 2〜3 週間で実現可能
- ✅ ADR-008（内部アプリ扱い）と組み合わせて Defense in Depth
- ⚠️ 担当者追加時は環境変数更新 + 再デプロイ（1 分）が必要
- ⚠️ `ALLOWED_EMAILS` は PII（組織構造）相当のため guardrails G-RT-01 で公開禁止を明文化
- ⚠️ Phase 2 で DB ベース RBAC に移行時、allowlist は削除（ADR-012 を Superseded 化）

### References
- REQUIREMENTS v2.0 FR-06.6, NFR-SEC-11, R-11
- threats.md TH-E-01, TH-I-08

---

## ADR-013: 二重登録検知に Sheets 全スキャン（直近 90 日）を採用

**Status**: Accepted
**Date**: 2026-04-19 (v2.0)
**Deciders**: PO, Dev

### Context
FR-19 により、同一 `scheduledDate + startTime + requester` の予約重複を Calendar 登録前に検知する必要がある（業務破綻リスク R-12 対策）。

### Options

| 案 | 長所 | 短所 |
|----|------|------|
| **Sheets `values.get` 全スキャン（直近 90 日分、最大 ~4,500 行）** | 実装簡単、追加インフラ不要 | レイテンシ依存（実測 400〜800ms） |
| 独立 DB（KV + 複合キー） | 高速 O(1) | インフラ追加、整合性管理 |
| Calendar 側の時間帯クエリ `events.list` | Google 側で絞込 | `requester` はフリーテキストで正確検索不可 |
| フロント側チェック（localStorage 履歴） | 追加 API 呼出不要 | ブラウザ越し・マシン越しで非同期 |

### Decision
**Sheets `values.get` で `records!C:G` を取得し、メモリ上で `scheduledDate + startTime + requester` をフィルタ**する。想定 50 件/日 × 90 日 = 最大 4,500 行、`google-spreadsheet` のキャッシュで ~400ms 以内を目標（NFR-P-01 p95 3.0 秒の 13% 予算内）。

### Consequences

- ✅ 追加インフラなし、Phase 1 で即導入可能
- ✅ `findDuplicate` フェイルオープン（FR-19.5）で可用性優先
- ⚠️ スキャン範囲 90 日は業務要件に基づく（長期運用では妥当性再評価）
- ⚠️ FR-19.5 フェイルオープンは G-02「月次不整合 0 件」と競合する可能性 → AL-06 で 5% 超時アラート＋月次手動チェック（runbook 10.1）で補完
- ⚠️ Phase 2 で件数増加が予想される場合、KV 側に重複キー専用 Namespace を追加検討（ADR 追加）

### References
- REQUIREMENTS v2.0 FR-19, AL-06, G-02, R-12
- Google Sheets API クォータ（300 req/分）: https://developers.google.com/sheets/api/limits

---

## ADR テンプレート（新規作成用）

```markdown
## ADR-NNN: <タイトル>

**Status**: Proposed / Accepted / Deprecated / Superseded by ADR-XXX
**Date**: YYYY-MM-DD
**Deciders**: ...

### Context
（状況説明、なぜこの決定が必要か）

### Options
（検討した選択肢とトレードオフ）

### Decision
（採用した選択肢）

### Consequences
（結果として起きる良いこと・悪いこと）

### References
（参考資料）
```

---

**ADR 品質スコア v2.0**: 92/100（v2.0 新要件 ADR-011〜013 追加、既存 10 件と合わせ 13 件、v2.0 REQUIREMENTS と完全整合）
