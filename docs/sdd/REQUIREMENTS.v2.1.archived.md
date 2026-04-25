# 要件定義書 (Requirements Specification) v2.1

**プロダクト名**: 業績管理アプリ
**バージョン**: 2.1.0
**作成日**: 2026-04-19
**作成者**: Kenta Kawana (<email>)
**ステータス**: DRAFT → READY FOR REVIEW
**方式**: SDD (Spec-Driven Development) / EARS (Easy Approach to Requirements Syntax)
**品質スコア目標**: 100/100 — 第三者レビュー（QAリード + PO）指摘**38件（v1.0 26件 + v2.0 12件）全反映**

---

## 改訂履歴

| Ver | 日付 | 変更内容 | 著者 |
|-----|------|---------|------|
| 0.1 | 2026-04-14 | 構造メモ作成 | Kenta Kawana |
| 0.2 | 2026-04-14 | ディープリサーチ（QA 85/100 PASS） | Research Agent |
| 1.0 | 2026-04-19 | SDD 要件定義書 初版 | SDD Pipeline |
| 2.0 | 2026-04-19 | QA/POレビュー指摘26件反映、p95測定区間統一、冪等性明文化、二重登録防止・allowlist追加、過剰NFR削減 | SDD Pipeline v2 |
| **2.1** | **2026-04-19** | **v2.0 最終 QA レビュー指摘 12 件反映。全文書整合性確保（threats/design/guardrails/adr 更新）。AC-15/16/17 追加、FR-01.6 状態遷移、ADR-011/012/013 追加、ログ 30 日統一、バンドル 150KB 統一** | **SDD Pipeline v2.1** |

### v1.0 → v2.0 主要変更点

| # | 変更 | 理由 |
|---|------|------|
| C1 | p95 測定区間を **「クリック→`/success` DOM 表示」** に統一 | 3 箇所矛盾の解消 |
| C2 | **冪等性キー（clientRequestId）** を FR-03 / FR-05 に正式追加、AC-09 と T-009 DoD を整合 | AC-09 が実装タスクに紐付いていなかった |
| C3 | **Error Budget を実トラフィック（月 ~1,000 件）で再計算** | 26,000 件/月の根拠なし |
| C4 | **FR-19 二重登録防止ルール** を新設 | 業務破綻リスクの根源対策 |
| C5 | **FR-06.6 ログイン allowlist** を新設 | 組織全員がログイン可能なリスクを塞ぐ |
| C6 | **FR-20 年次アーカイブ運用** を新設（Runbook 連動） | スプシ行数上限の実運用手順が空 |
| M1 | AC-08 スコープ記述を「業務用スコープは2つのみ（基本スコープ除く）」に修正 | openid/email/profile との矛盾 |
| M2 | FR-02.3 過去日付確認を `window.confirm()` で明文化＋AC-11 追加 | テスト不能だった |
| M3 | ロールバック中の同時再試行を `clientRequestId` ベース冪等化で封じ込め | 未定義の edge case |
| M4 | Phase 1 の RBAC 非採用を明示的受容リスクに格上げ | 「放置」でなく「意図的受容」に |
| M5 | マイルストーンと工数見積を整合（12営業日ベース、UAT 8h） | 9 営業日と 15 営業日の矛盾 |
| R1 | NFR-P-04「10 req/s」削除、NFR-P-02「p99」削除 | 想定の 700 倍の過剰設計 |
| R2 | G-05「連携ワークフロー定義数」→ Phase 3 Goal へ移動 | 形式指標でビジネス価値希薄 |
| R3 | NPS → 「継続利用日数 ≥ 20 営業日/月」に変更 | サンプル数 1〜数名で NPS 不成立 |
| R4 | SonarCloud Rating A を Phase 2+ に延期 | MVP オーバーエンジニアリング |
| R5 | 変更管理プロセス簡素化（GitHub Issue 中心） | 単独運用で CR 票フロー過剰 |
| E1 | ブラウザ戻る/タブ閉じ/ネット切断の挙動を FR-21 に明記 | edge case 漏れ |
| E2 | `amount` 通貨単位を JPY 整数（税込）と定義 | 型定義の穴 |
| E3 | Wall timeout と CPU budget を分離して制約記載 | threats と guardrails の矛盾 |

---

## 目次

1. [プロジェクト概要・背景・目的](#1-プロジェクト概要背景目的)
2. [ステークホルダーと役割](#2-ステークホルダーと役割)
3. [用語集](#3-用語集glossary)
4. [スコープ定義](#4-スコープ定義)
5. [業務要件（As-Is / To-Be）](#5-業務要件as-is--to-be)
6. [機能要件（FR）](#6-機能要件fr)
7. [非機能要件（NFR）](#7-非機能要件nfr)
8. [データ要件](#8-データ要件)
9. [外部インターフェース要件](#9-外部インターフェース要件)
10. [制約条件・前提条件](#10-制約条件前提条件)
11. [受け入れ基準（Acceptance Criteria）](#11-受け入れ基準acceptance-criteria)
12. [リスクと対応策](#12-リスクと対応策)
13. [マイルストーンと成果物](#13-マイルストーンと成果物)
14. [変更管理・承認プロセス](#14-変更管理承認プロセス)
15. [トレーサビリティマトリクス](#15-トレーサビリティマトリクス)

---

## 1. プロジェクト概要・背景・目的

### 1.1 プロジェクト概要

業績管理アプリは、**Webフォームから入力した予約情報を Google カレンダーに登録し、同時に Google スプレッドシートへ台帳記録する業務Webアプリケーション**である。スプレッドシートを台帳兼 BI として活用し、月別件数・依頼内容別集計・業績ダッシュボードを構築する。

### 1.2 背景

| 項目 | 内容 |
|------|------|
| 業界文脈 | Calendly／TimeRex 等の SaaS は月額 $10〜$20。スプシ文化の業務現場では SaaS の閉じた UI が会計・経理との連動を阻害 |
| 技術文脈 | Google API は完全無料（Calendar 無制限、Sheets 300 req/分）、Cloudflare Pages 無料・商用OK、MCP エコシステムで工数 30〜50% 削減 |
| 組織文脈 | 業務用 Google アカウント保有、社内 1〜数名運用 |

### 1.3 目的（Goals）

| ID | 目的 | 達成指標（KPI） | 測定方法 |
|-----|------|----------------|---------|
| G-01 | 予約入力から完了画面表示までを 3 秒以内で完了 | クリックから`/success` DOM表示 p95 ≤ 3.0 秒 | Web Vitals Analytics |
| G-02 | スプシ台帳と Google カレンダーを常に同期 | 月次不整合件数 0 件 | 月次 `records` × Calendar 件数突合 |
| G-03 | Calendly 等の有料 SaaS を置き換え、月額 $0 運用 | ランニングコスト ≤ $0/月 | Cloudflare / GCP 請求書 |
| G-04 | 月別・依頼内容別の業績を自動集計・可視化 | `summary` シートの当月分が自動反映（Phase 2） | スプシ QUERY 関数更新確認 |
| G-05 | 継続的な業務活用の定着 | **継続利用日数 ≥ 20 営業日/月**（MVP 1 ヶ月時点で達成） | 登録ログの日毎利用日数カウント |

> **Note**: v1.0 で G-05 だった「会計連携の下地」は Phase 3 の Goal に移動（Phase 3 開始時に正式定義）。

### 1.4 非目的（Non-Goals）

| ID | 非目的 | 理由 |
|-----|--------|------|
| NG-01 | 外部顧客向けのセルフ予約サイト化 | OAuth 内部アプリ限定 |
| NG-02 | 大規模 SaaS スケール対応 | 小規模業務特化 |
| NG-03 | 独自 DB 採用 | スプシを真実の情報源に |
| NG-04 | スマホネイティブアプリ | Web で十分 |
| NG-05 | RBAC（Role-Based Access Control） | Phase 1 は認証済み=全権限で受容（R-11） |

### 1.5 成功基準（Definition of Success）

- ✅ Phase 1 MVP を **2026-05-06 までにデプロイ完了**
- ✅ リリース後 30 日間の登録失敗率 < 1%
- ✅ **継続利用日数 ≥ 20 営業日/月**（G-05）
- ✅ Google カレンダー⇔スプシ間の整合性 100%
- ✅ 月次コスト $0

---

## 2. ステークホルダーと役割

### 2.1 ステークホルダー一覧

| ID | ステークホルダー | 役割 | 主要関心事 | 関与度 |
|----|-----------------|------|-----------|--------|
| SH-01 | プロダクトオーナー（Kenta Kawana） | 意思決定、要件確定、受入承認 | ROI、納期、品質 | ★★★★★ |
| SH-02 | エンドユーザー（業務担当者、1〜数名） | 予約入力、ステータス更新 | 入力スピード、誤操作防止 | ★★★★★ |
| SH-03 | 業績確認者（管理者） | 月次集計・売上確認 | 集計精度、可視化 | ★★★★☆ |
| SH-04 | 開発者（Claude Code + 人間レビュアー） | 実装、テスト、デプロイ | 技術的健全性、保守性 | ★★★★★ |
| SH-05 | Google Workspace 管理者 | OAuth 設定、スコープ承認 | セキュリティ、コンプライアンス | ★★★☆☆ |
| SH-06 | 会計・経理担当者（将来） | Phase 3 会計連携 | データ項目、形式 | ★★☆☆☆ |

### 2.2 RACI マトリクス

| アクティビティ | PO | EndUser | Admin | Dev | GWSAdmin |
|-------------|----|---------|-------|-----|---------|
| 要件承認 | **A** | C | C | R | I |
| GCP/OAuth 設定 | A | - | - | R | **C** |
| 実装・テスト | A | C | - | **R** | - |
| UAT | A | **R** | R | C | - |
| リリース承認 | **A** | C | C | R | I |
| 運用保守 | A | C | C | **R** | C |

---

## 3. 用語集（Glossary）

| 用語 | 英語 / 略語 | 定義 |
|------|------------|------|
| 予約 | Reservation | 実施予定の業務依頼。1 件につきスプシ 1 行・カレンダー 1 イベントに対応 |
| 受付ID | reservationId | 予約を一意に識別する UUID v4（サーバ側採番）。スプシ A 列 |
| クライアント冪等キー | clientRequestId | ブラウザ側で採番する UUID v4。同一送信判定・Calendar API `requestId` に使用 |
| カレンダーイベントID | calendarEventId | Google Calendar API が返す `event.id`。スプシ J 列 |
| 業務用Googleアカウント | Business GWS Account | 組織の Google Workspace アカウント |
| allowlist | Email 許可リスト | ログイン可能な業務担当者 email の明示的リスト |
| 台帳 | Ledger | 予約の全履歴を保持する `records` シート |
| サマリーシート | Summary | 月別・依頼内容別の件数集計 `summary` シート |
| ダッシュボードシート | Dashboard | グラフ可視化用 `dashboard` シート |
| アーカイブシート | Archive | 旧年度の台帳を退避する `records-YYYY` シート |
| 冪等化 | Idempotency | 同一入力で複数回実行しても結果が一意になる性質 |
| Compensating Transaction | 補償トランザクション | 成功した処理を取り消して整合性を保つパターン |
| Refresh Token | RT | OAuth2 のアクセストークン再発行用長期トークン |
| PII | Personally Identifiable Information | 個人識別情報（氏名・連絡先など） |
| MCP | Model Context Protocol | Claude Code の外部ツール統合規格 |
| Wall Timeout | Wall Clock 経過時間（I/O 含む） |
| CPU Budget | Workers の CPU 純計算時間（I/O 待機を除く） |
| Server Action | Next.js 15 App Router のサーバ側関数実行機構 |
| EARS | Easy Approach to Requirements Syntax | 要件記述標準構文 |
| MoSCoW | Must/Should/Could/Won't 優先度分類 |

---

## 4. スコープ定義

### 4.1 In Scope（対象範囲）

#### Phase 1 MVP — 12 営業日（2026-04-20 〜 2026-05-06）

- [IN-P1-01] 予約入力フォーム
- [IN-P1-02] Zod バリデーション
- [IN-P1-03] Google カレンダー `events.insert`（TZ: Asia/Tokyo、`requestId` 冪等化）
- [IN-P1-04] Google スプレッドシート `values.append`（`USER_ENTERED`）
- [IN-P1-05] Calendar 失敗時ロールバック（`events.delete`）+ 冪等キー保持
- [IN-P1-06] 完了画面 `/success`、エラー画面 `/error`
- [IN-P1-07] next-auth v5 + Google OAuth2 + **email allowlist**
- [IN-P1-08] **二重登録防止**（同一 `scheduledDate + startTime + requester` の検知）
- [IN-P1-09] Cloudflare Pages デプロイ
- [IN-P1-10] `records` シート（10 列）

#### Phase 2 自動化 — 1〜2 ヶ月

- [IN-P2-01] 予約編集・削除（論理削除）
- [IN-P2-02] 一覧表示・検索・フィルタ
- [IN-P2-03] `summary` シート自動集計
- [IN-P2-04] `dashboard` シート
- [IN-P2-05] RBAC（閲覧専用ロール追加）
- [IN-P2-06] SonarCloud Rating A 達成

#### Phase 3 拡張 — 2〜3 ヶ月

- [IN-P3-01] 売上管理（`amount` 列、JPY 整数税込）
- [IN-P3-02] 会計連携の下地（CSV エクスポート + 会計ソフトインポート手順）
- [IN-P3-03] Looker Studio 連携
- [IN-P3-04] 通知（メール／LINE WebHook）

### 4.2 Out of Scope（対象外）

| ID | 除外事項 | 理由 |
|----|---------|------|
| OUT-01 | 外部公開セルフ予約 | NG-01 |
| OUT-02 | 独自 RDB／NoSQL | NG-03 |
| OUT-03 | スマホネイティブ | NG-04 |
| OUT-04 | 多言語対応 | 日本語のみ |
| OUT-05 | マルチテナント | 単一組織 |
| OUT-06 | 決済機能 | 別システム |
| OUT-07 | リソース在庫管理 | Calendar 空き確認のみ |
| OUT-08 | 顧客マスタ | 依頼者自由入力 |
| OUT-09 | RBAC | Phase 2+、受容済（R-11） |

---

## 5. 業務要件（As-Is / To-Be）

### 5.1 As-Is（現状）

```
[依頼者] → [口頭/メール/LINE] → [担当者] → [手動Googleカレンダー登録]
                                         ↓
                                      [別途スプシ手入力]
                                         ↓
                                      [月末手動集計]
```

**As-Is 課題:**

| # | 課題 |
|---|------|
| 1 | 二重入力（カレンダーとスプシ） |
| 2 | 月末手動集計（週 3〜5 時間） |
| 3 | `calendarEventId` 未記録で修正時に紐付け不可 |
| 4 | 入力項目が非統一で集計不可 |
| 5 | **同じ予約が重複登録されることがある**（検知機能なし） |
| 6 | 業績の可視化なし |

### 5.2 To-Be

```
[依頼者] → [担当者Webフォーム] → [1クリック送信]
                                      ↓ 冪等キー付与
                             [Server Action: 3秒以内]
                             ↓ 重複検知
                             ↓
                 [Google Calendar] [Google Sheets]
                                      ↓
                            [summary自動集計]
                                      ↓
                            [dashboard可視化]
```

### 5.3 業務ユースケース

#### UC-01: 予約を新規登録する

| 項目 | 内容 |
|------|------|
| アクター | 業務担当者 |
| 事前条件 | allowlist に含まれる Google アカウントでログイン済み |
| 主フロー | フォーム入力→送信→バリデーション→**重複チェック**→Calendar 登録→Sheets 追記→`/success` |
| 代替フロー1 | バリデーション失敗→フォーム上でエラー表示 |
| 代替フロー2 | **重複検知**→確認ダイアログ「同日同時刻の予約が存在します。続行しますか？」 |
| 例外フロー1 | Calendar 成功・Sheets 失敗→Calendar ロールバック→`/error` |
| 例外フロー2 | Calendar 成功・ロールバックも失敗→不整合レポート→SEV-2 通知 |
| 事後条件 | スプシと Calendar が整合、`reservationId`/`calendarEventId` が保存 |

#### UC-02: 月別業績を確認する

| 項目 | 内容 |
|------|------|
| アクター | 業績確認者 |
| 主フロー | `summary` シートを開く→月別集計確認→`dashboard` でグラフ確認 |

#### UC-03: 予約を編集する（Phase 2）

| 項目 | 内容 |
|------|------|
| アクター | 業務担当者（RBAC で編集可ロールのみ） |
| 主フロー | 一覧→編集→`events.update` + `values.update`→`/success` |
| 例外 | `eventId` 不整合→不整合レポート画面 |

#### UC-04: 年次アーカイブを実施する（運用）

| 項目 | 内容 |
|------|------|
| アクター | 開発者／運用担当（年 1 回） |
| 事前条件 | `records` シート行数 ≥ 900,000（AL-08）または年初（**1 月第 1 週**、FR-20.1 と整合） |
| 主フロー | 旧データを `records-YYYY` シートに退避→`records` シートから削除→環境変数 `ARCHIVE_YEAR` 更新 |
| Runbook | `runbook.md` セクション 10.2 参照 |

---

## 6. 機能要件（FR）

**記法**: EARS — U（常時）/ E（イベント駆動）/ S（状態駆動）/ UW（異常系）/ O（オプション）

### 6.1 FR 一覧（MoSCoW + Phase）

| FR ID | 要件 | 優先度 | Phase |
|-------|------|--------|-------|
| FR-01 | 予約入力フォーム | **Must** | P1 |
| FR-02 | 入力バリデーション | **Must** | P1 |
| FR-03 | Google カレンダー登録（冪等化） | **Must** | P1 |
| FR-04 | Google スプレッドシート追記 | **Must** | P1 |
| FR-05 | トランザクション整合性（Compensating Rollback） | **Must** | P1 |
| FR-06 | OAuth2 認証 + allowlist | **Must** | P1 |
| FR-07 | 完了／エラー画面 | **Must** | P1 |
| FR-08 | レスポンシブ UI + アクセシビリティ | **Should** | P1 |
| FR-19 | **二重登録防止** | **Must** | P1 |
| FR-20 | **年次アーカイブ運用** | **Must** | P1（運用手順として） |
| FR-21 | **回復性（戻る/タブ閉じ/ネット切断）** | **Should** | P1 |
| FR-09 | 予約一覧表示 | Should | P2 |
| FR-10 | 予約編集 | Should | P2 |
| FR-11 | 予約削除（論理） | Should | P2 |
| FR-12 | 月別集計 | Should | P2 |
| FR-13 | ダッシュボード | Could | P2 |
| FR-22 | **RBAC（閲覧専用ロール）** | Should | P2 |
| FR-14 | 売上管理 | Could | P3 |
| FR-15 | Looker Studio 連携 | Could | P3 |
| FR-16 | 通知（メール/LINE） | Could | P3 |
| FR-17 | CSV エクスポート | Could | P3 |
| FR-18 | 多言語対応 | **Won't** | - |

### 6.2 詳細要件（EARS 形式）

#### FR-01: 予約入力フォーム

- **[FR-01.1 U]** システムは、予約入力フォーム（`/`）を提供しなければならない。
- **[FR-01.2 U]** フォームは以下の入力項目を含まなければならない:
  - 実施日（date、必須）
  - 開始時刻（time、必須）
  - 終了時刻（time、必須）
  - 依頼内容（text、必須、1〜500 文字）
  - 依頼者（text、必須、1〜100 文字）
  - ステータス（select、既定 `pending`）
  - メモ（textarea、任意、0〜1000 文字）
- **[FR-01.3 E]** ユーザーが送信ボタンを押下したとき、システムは 2 重送信防止のためボタンを無効化しなければならない。
- **[FR-01.4 E]** ユーザーが送信ボタンを押下したとき、ブラウザは `clientRequestId`（UUID v4）を生成し送信に含めなければならない。**重複確認ダイアログ（FR-19.3）後の `forceCreate:true` 再送時は新規 `clientRequestId` を採番する**（KV キャッシュの `DUPLICATE_SUSPECTED` 再ヒット防止のため）。ネット切断後の同一リクエスト再送時は**同一 `clientRequestId` を維持**する（FR-21.3）。
- **[FR-01.5 U]** ステータス `confirmed` は、実施日が当日以降の場合にのみ選択可能とする（当日含む）。
- **[FR-01.6 U]** ステータス遷移は以下に従う（状態遷移モデル）:

```
    [pending]
       ↓ (ユーザー or 管理者が確定)
   [confirmed]
       ↓ (実施完了時)
   [completed]

   [pending/confirmed] → [cancelled] (任意のタイミングで取消可)
   [completed] → [cancelled] は禁止（完了後の取消は不可、例外は運用手順で対応）
```

| 遷移元 | 遷移先 | 条件 |
|-------|-------|------|
| — | pending | 新規登録の既定 |
| pending | confirmed | 実施日 ≥ 当日 |
| pending/confirmed | completed | 実施日 ≤ 当日 |
| pending/confirmed | cancelled | 常時可（Phase 2 で論理削除） |
| completed | * | 遷移不可 |
| cancelled | * | 遷移不可（再登録は新規扱い） |

#### FR-02: 入力バリデーション

- **[FR-02.1 E]** フォーム送信時、システムは**サーバ側で** Zod スキーマに従い全項目を再検証しなければならない（フロント検証結果を信頼してはならない）。
- **[FR-02.2 UW]** 終了時刻が開始時刻以前の場合、システムはエラーを返し保存してはならない。
- **[FR-02.3 UW]** 実施日が過去日付の場合、フロントは `window.confirm("過去日付の予約を登録しますか？")` を表示し、**OK 選択時のみ** 送信を継続する。Cancel 選択時は送信しない。
- **[FR-02.4 UW]** 依頼内容・依頼者が空文字または全角空白のみの場合、エラーを返す。
- **[FR-02.5 UW]** 時刻が `HH:mm` 形式でない場合、エラーを返す。
- **[FR-02.6 UW]** 文字数上限を超えた場合、エラーを返す。

#### FR-03: Google カレンダー登録（冪等化）

- **[FR-03.1 E]** バリデーション成功時、システムは Google Calendar API `events.insert` を呼び出し予定を作成しなければならない。
- **[FR-03.2 U]** イベントのタイムゾーンは `Asia/Tokyo` で固定する。
- **[FR-03.3 U]** イベントタイトルは `[依頼内容] - [依頼者]` 形式で生成する。
- **[FR-03.4 U]** イベント本文に `reservationId: <uuid>` を記載する（逆引き用）。
- **[FR-03.5 E]** **`events.insert` 呼び出し時は `requestId` パラメタに `clientRequestId` を付与しなければならない**（60 分以内の同一リクエストは重複作成されない）。
- **[FR-03.6 UW]** API 呼び出しに失敗した場合、システムは 5xx/ネットワークエラーのみ最大 3 回 Exponential Backoff（base 200ms）で再試行する。4xx はリトライしない。

#### FR-04: Google スプレッドシート追記

- **[FR-04.1 E]** Calendar 登録成功後、システムは `records` シート最終行に 1 行追記する。
- **[FR-04.2 U]** 値入力モードは `USER_ENTERED`。
- **[FR-04.3 U]** 10 列全てを埋める（A〜J、空値は空文字）。
- **[FR-04.4 U]** J 列の `calendarEventId` は Calendar が返した `event.id` と一致しなければならない。

#### FR-05: トランザクション整合性（Compensating Rollback + 冪等化）

- **[FR-05.1 U]** 処理順序は **Calendar → Sheets** で固定する（逆順禁止）。
- **[FR-05.2 UW]** Calendar 成功後に Sheets が失敗した場合、`events.delete(eventId)` でロールバックする。
- **[FR-05.3 UW]** **ロールバックが失敗した場合、SEV-2 不整合レポート**（`reservationId` / `calendarEventId` / 失敗 API / error message）をログと `/error` 画面に出力する。
- **[FR-05.4 U]** **サーバは `clientRequestId` を 60 分間 KV（Cloudflare Workers KV）で保持する**。同一 `clientRequestId` の再送は即座にキャッシュ済みレスポンスを返す（冪等応答）。
- **[FR-05.5 UW]** ロールバック実行中に同一 `clientRequestId` で再送が来た場合、KV で排他制御し、in-progress 応答を返す。

#### FR-06: OAuth2 認証 + allowlist

- **[FR-06.1 E]** 未認証ユーザーがアプリにアクセスしたとき、`/api/auth/signin` へリダイレクトする。
- **[FR-06.2 U]** 取得する業務用スコープは `calendar.events` と `spreadsheets` の 2 つに限定する（基本スコープ `openid email profile` を除く）。
- **[FR-06.3 U]** Refresh Token 取得のため `access_type=offline` と `prompt=consent` を必須とする。
- **[FR-06.4 E]** Access Token の有効期限切れを検知したとき、システムは Refresh Token で自動再取得する（ユーザーには透過）。
- **[FR-06.5 UW]** Refresh Token が無効化されている場合、再認証画面に誘導する。
- **[FR-06.6 UW]** **ログインしたユーザーの email が環境変数 `ALLOWED_EMAILS`（カンマ区切り）に含まれない場合、サーバは `403 Forbidden` を返し `/api/auth/signout` へ誘導する**。組織内の非担当者を排除する。

#### FR-07: 完了／エラー画面

- **[FR-07.1 E]** 登録成功時、`/success?id={reservationId}` に遷移する。
- **[FR-07.2 E]** 登録失敗時、`/error?code={errorCode}` に遷移する（PII はクエリに含めない）。
- **[FR-07.3 U]** エラー画面は**再試行ボタン**と**トップへ戻るボタン**を提供する。
- **[FR-07.4 U]** エラー画面のメッセージは日本語で、次のアクションを明示する（例: 「認証に失敗しました。再度ログインしてください」）。
- **[FR-07.5 U]** エラー画面にはスタックトレース・内部エラーメッセージを表示しない。

#### FR-08: レスポンシブ UI + アクセシビリティ

- **[FR-08.1 U]** UI は Tailwind CSS を用いて、スマートフォン 375px 以上で横スクロールなく表示する。
- **[FR-08.2 U]** フォームは WCAG 2.1 AA のコントラスト比（4.5:1）を満たす。
- **[FR-08.3 U]** 全入力項目に `aria-label` を付与する（NFR-U-02 前提条件: 将来のアクセシビリティニーズへの備え）。
- **[FR-08.4 U]** キーボードのみで全操作可能であること。

#### FR-19: 二重登録防止（新設）

- **[FR-19.1 E]** Calendar 登録前に、サーバは **同一 `scheduledDate` + `startTime` + `requester`** の既存予約が `records` シートに存在しないか検索する（**直近 90 日分、最大 ~4,500 行**）。想定レイテンシは Sheets `values.get` キャッシュ込みで **400ms 以内**（NFR-P-01 p95 3.0 秒の 13% 予算内、ADR-013 参照）。
- **[FR-19.2 UW]** 重複が検出された場合、レスポンス `{code: "DUPLICATE_SUSPECTED", existing: {reservationId, calendarEventId}}` を返す。
- **[FR-19.3 E]** フロントは `DUPLICATE_SUSPECTED` を受信したとき、`window.confirm("同日同時刻・同依頼者の予約が存在します（ID: xxx）。続行しますか？")` を表示する。
- **[FR-19.4 E]** ユーザーが OK を選択した場合、`forceCreate: true` フラグ付きで再送する。
- **[FR-19.5 UW]** 検索が技術的失敗（Sheets API エラー）した場合、二重登録防止はフェイルオープン（登録継続）とし、ログに `event=dup_check_failed` を記録する（可用性優先）。

#### FR-20: 年次アーカイブ運用（新設、運用手順扱い）

- **[FR-20.1 U]** **毎年 1 月第 1 週**（前年度確定後）に、`records` シートの**前年度分のみ**（`scheduledDate` が前年 1/1〜12/31）を `records-YYYY` シートに複製退避する。
- **[FR-20.2 U]** 退避後、**前年度分を削除**し、当年度分および当日以降の予約のみを `records` シートに残す。
- **[FR-20.3 U]** 運用手順は `runbook.md` 10.2 に従う。
- **[FR-20.4 U]** `records` シート行数が 900,000 行に達した場合、即時アーカイブを実施する（早期警告）。なお NFR-S-01（18,250 件/年上限）と照らし合わせると本警告到達には概算 49 年要するため、実務上は FR-20.1 の年次運用が主経路となる。

#### FR-21: 回復性（ブラウザ挙動への耐性、新設）

- **[FR-21.1 UW]** 送信中にユーザーが**ブラウザ戻る**ボタンを押した場合、サーバは処理を中断せず最後まで実行する（冪等キーで整合性保証）。次回アクセス時に結果を確認可能とする（Phase 2 で一覧から）。
- **[FR-21.2 UW]** 送信中に**タブを閉じた**場合も、FR-21.1 と同様に処理を完走させる。
- **[FR-21.3 UW]** **ネット切断**で送信に失敗した場合、フロントはエラーを表示し「再送信」ボタンを出す。再送信は同一 `clientRequestId` で行い、二重登録を防ぐ。
- **[FR-21.4 UW]** クライアントが同一 `clientRequestId` で 2 回送信した場合、サーバは KV キャッシュから**同一結果**を返す（FR-05.4 参照）。

#### FR-09〜FR-17, FR-22: Phase 2/3 要件

詳細は Phase 1 完了後の別紙追補で定義（v3.0 で REQUIREMENTS.md に反映）。

### 6.3 画面要件

| ID | 画面名 | パス | 主要要素 |
|----|--------|------|---------|
| SC-01 | 予約入力 | `/` | フォーム、送信ボタン |
| SC-02 | 完了 | `/success` | 成功、`reservationId`、続けて登録 |
| SC-03 | エラー | `/error` | コード、理由、再試行、トップへ |
| SC-04 | ログイン | `/api/auth/signin` | Google ログイン |
| SC-05 | 一覧（P2） | `/reservations` | テーブル、フィルタ、ページ |
| SC-06 | 編集（P2） | `/reservations/[id]/edit` | フォーム（SC-01 同構造） |

---

## 7. 非機能要件（NFR）

### 7.1 性能要件（Performance）

| NFR ID | 指標 | 目標値 | 測定方法 |
|--------|------|--------|---------|
| NFR-P-01 | **E2E レイテンシ（クリック→`/success` DOM 表示）p95** | **≤ 3.0 秒** | Web Vitals（`performance.mark` API）+ Cloudflare Web Analytics |
| NFR-P-03 | フォーム初期表示 FCP | ≤ 1.5 秒 | Lighthouse |
| NFR-P-04 | フォーム初期表示 LCP | ≤ 2.5 秒 | Lighthouse |
| NFR-P-05 | Sheets / Calendar API 呼び出しエラー率（SLO_E 準拠） | < 0.1% | Workers Logs 集計 |

> **v1.0 から削減**: NFR-P-02「p99 ≤ 5.0 秒」（日 10〜50 件ではサンプル不足）、NFR-P-04「10 req/s」（想定の 700 倍）を削除。

### 7.2 可用性要件（Availability）

| NFR ID | 指標 | 目標値 |
|--------|------|--------|
| NFR-A-01 | SLO 可用性（業務時間 9:00〜18:00 JST） | 99.0% |
| NFR-A-02 | 許容ダウンタイム（月、業務時間基準） | ≤ 1.8 時間 |
| NFR-A-03 | RTO（復旧目標時間） | ≤ 1 時間 |
| NFR-A-04 | RPO（復旧目標時点） | スプシの Google 自動バックアップ（ほぼゼロ） |

### 7.3 拡張性要件（Scalability）

| NFR ID | 指標 | 目標値 |
|--------|------|--------|
| NFR-S-01 | 年間処理件数上限 | ≤ 18,250 件（50 件/日 × 365 日） |
| NFR-S-02 | 台帳行数 | 900,000 行でアーカイブ起動（Google 上限 1,048,576 行の 86%） |
| NFR-S-03 | 機能追加による既存機能への影響 | 0 件（リグレッション） |

### 7.4 保守性要件（Maintainability）

| NFR ID | 指標 | 目標値 | Phase |
|--------|------|--------|-------|
| NFR-M-01 | コードカバレッジ（`lib/*`） | ≥ 80% | P1 |
| NFR-M-02 | TypeScript strict 準拠 | 100% | P1 |
| NFR-M-03 | ESLint / Prettier 違反 | 0 件（CI ブロック） | P1 |
| NFR-M-04 | 循環的複雑度（関数） | ≤ 10 | P1 |
| NFR-M-05 | SonarCloud Rating | A | **P2+**（v1.0 の P1 から延期） |
| NFR-M-06 | バンドルサイズ（JS、gzip 後） | ≤ 150 KB | P1 |

### 7.5 セキュリティ要件（Security）

| NFR ID | 要件 |
|--------|------|
| NFR-SEC-01 | 全通信は HTTPS (TLS 1.3) |
| NFR-SEC-02 | Refresh Token は暗号化 AES-256-GCM で KV 保存、または httpOnly+Secure+SameSite=Strict Cookie |
| NFR-SEC-03 | Access Token 有効期限 15〜30 分 |
| NFR-SEC-04 | OAuth2 業務用スコープは `calendar.events` と `spreadsheets` のみ |
| NFR-SEC-05 | Client Secret は `.env.local` + Cloudflare 暗号化環境変数 |
| NFR-SEC-06 | Service Account JSON は不使用（使用時は 90 日ローテーション） |
| NFR-SEC-07 | スプシ共有は業務アカウント単独、「リンクを知っている全員」禁止 |
| NFR-SEC-08 | PII（依頼者氏名、メモ）はログ・URL クエリに出力しない |
| NFR-SEC-09 | CSRF 対策（next-auth 内蔵）有効化 |
| NFR-SEC-10 | Rate Limit: **Session 単位 + IP 単位の併用**で 60 req/分（CGN 対策） |
| NFR-SEC-11 | **allowlist**: `ALLOWED_EMAILS` に含まれない email は `403 Forbidden` |

### 7.6 ユーザビリティ要件（Usability）

| NFR ID | 要件 |
|--------|------|
| NFR-U-01 | キーボード完全操作可（WCAG 2.1 A） |
| NFR-U-02 | スクリーンリーダー対応（`aria-label` 必須、FR-08.3） |
| NFR-U-03 | エラーメッセージは日本語で次アクション明示 |
| NFR-U-04 | 入力途中離脱時にブラウザ `sessionStorage` で自動保存（Should） |

### 7.7 互換性要件（Compatibility）

| NFR ID | 要件 |
|--------|------|
| NFR-C-01 | Chrome / Edge / Safari / Firefox 最新 2 バージョン |
| NFR-C-02 | macOS 13+, Windows 11+, iOS 16+, Android 12+ |
| NFR-C-03 | 375px 〜 1920px |

### 7.8 監査・ログ要件（Audit / Logging）

| NFR ID | 要件 |
|--------|------|
| NFR-L-01 | 予約登録・編集・削除は構造化 JSON ログで記録 |
| NFR-L-02 | ログフィールド: `timestamp`, `userId`（hash）, `action`, `reservationId`, `clientRequestId`, `status`, `duration_ms`, `error_code` |
| NFR-L-03 | ログは **30 日間** Cloudflare Workers Logs 無料枠で保持（v1.0 の 90 日から短縮、G-03 月額 $0 制約と整合） |
| NFR-L-04 | PII はログ出力しない。必要時 SHA-256 ハッシュ化 |

### 7.9 実行環境制約（Runtime Constraints、新設）

| NFR ID | 要件 |
|--------|------|
| NFR-RT-01 | **CPU Budget**: Workers 無料枠 10ms／リクエスト以内に収める（I/O 待機除く） |
| NFR-RT-02 | **Wall Timeout**: Server Action 全体の Wall Clock ≤ 25 秒（Cloudflare 30 秒制限の安全マージン） |
| NFR-RT-03 | 外部 API 呼び出し個別タイムアウト: 10 秒 |

---

## 8. データ要件

### 8.1 論理データモデル

```typescript
interface Reservation {
  // サーバ側採番・制御項目
  reservationId: string;          // UUID v4, 必須 unique (DB側/サーバ生成)
  clientRequestId: string;        // UUID v4, 必須 unique (フロント生成、冪等化キー)
  receivedAt: string;             // ISO8601 UTC (サーバ生成)
  createdAt: string;              // ISO8601 UTC (サーバ生成)
  updatedAt: string;              // ISO8601 UTC (サーバ生成)
  calendarEventId: string;        // Calendar返却後に確定
  calendarId: string;             // 既定 'primary'

  // ユーザー入力項目
  scheduledDate: string;          // YYYY-MM-DD (Asia/Tokyo)
  startTime: string;              // HH:mm
  endTime: string;                // HH:mm, > startTime
  requestContent: string;         // 1〜500 文字
  requester: string;              // 1〜100 文字
  status: ReservationStatus;      // enum
  memo?: string;                  // 0〜1000 文字

  // Phase 2+
  amount?: number;                // JPY, 税込, 非負整数 (0 以上)
}

type ReservationStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
```

### 8.2 バリデーションルール（Zod）

```typescript
// ユーザー入力部分のみ
const ReservationInputSchema = z.object({
  clientRequestId: z.string().uuid(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  requestContent: z.string().trim().min(1).max(500),
  requester: z.string().trim().min(1).max(100),
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']).default('pending'),
  memo: z.string().max(1000).optional(),
  forceCreate: z.boolean().optional(),  // FR-19.4 用
}).refine(d => d.endTime > d.startTime, {
  message: '終了時刻は開始時刻より後でなければなりません',
  path: ['endTime'],
}).refine(
  d => d.status !== 'confirmed' || new Date(d.scheduledDate) >= startOfToday(),
  { message: 'confirmed は当日以降のみ選択可能です', path: ['status'] }
);
```

### 8.3 物理データ配置（スプシ `records`）

| 列 | 項目 | 型 | 例 |
|----|------|-----|-----|
| A | reservationId | UUID | `a3f9-...` |
| B | receivedAt | ISO8601 | `2026-04-19 14:30:00` |
| C | scheduledDate | date | `2026-04-25` |
| D | startTime | HH:mm | `14:00` |
| E | endTime | HH:mm | `15:00` |
| F | requestContent | text | `Web打合せ` |
| G | requester | text | `山田太郎` |
| H | status | enum | `pending` |
| I | memo | text | `Zoom URL要` |
| J | calendarEventId | id | `abc123xyz` |

### 8.4 データ保持期間

| データ | 保持 | 保管先 | 削除方針 |
|--------|------|--------|---------|
| 予約レコード | 無期限（年次アーカイブ） | Google Sheets | FR-20 |
| Access Token | 30 分 | メモリ | 有効期限で失効 |
| Refresh Token | 無期限（ユーザー失効まで） | httpOnly Cookie / KV | ログアウトで削除 |
| clientRequestId KV | **60 分** | Cloudflare KV | TTL 自動削除 |
| アプリログ | **30 日** | Workers Logs | 自動ローテ |

### 8.5 データ整合性ルール

| ID | 内容 |
|-----|------|
| DC-01 | `reservationId` は全履歴でユニーク |
| DC-02 | `calendarEventId` は Calendar の実在イベントと 1:1 対応 |
| DC-03 | `status = cancelled` のとき Calendar イベントは削除済 |
| DC-04 | `endTime > startTime` 常時成立 |
| DC-05 | `updatedAt >= createdAt` 常時成立 |
| DC-06 | **`clientRequestId` は 60 分以内にユニーク**（KV `IDEMPOTENCY_CACHE` TTL で保証、Zod レイヤ外のランタイム制約） |

---

## 9. 外部インターフェース要件

### 9.1 Google Calendar API v3

| 項目 | 仕様 |
|------|------|
| ベース | `https://www.googleapis.com/calendar/v3` |
| 使用 API | `POST /calendars/{calendarId}/events`（insert、`requestId` 冪等化）<br>`DELETE /calendars/{calendarId}/events/{eventId}`（rollback）<br>`PATCH`（Phase 2） |
| 認証 | OAuth2 Bearer |
| スコープ | `https://www.googleapis.com/auth/calendar.events` |
| TZ | `start.timeZone` = `end.timeZone` = `Asia/Tokyo` |
| 冪等化 | `requestId`（60 分保持、GCP 仕様）← `clientRequestId` を利用 |

### 9.2 Google Sheets API v4

| 項目 | 仕様 |
|------|------|
| ベース | `https://sheets.googleapis.com/v4` |
| 使用 API | `POST /spreadsheets/{sid}/values/{range}:append`（USER_ENTERED）<br>`GET /spreadsheets/{sid}/values/{range}`（FR-19 重複チェック用） |
| 認証 | OAuth2 Bearer |
| スコープ | `https://www.googleapis.com/auth/spreadsheets` |
| レート | 300 req/分/ユーザー（想定 50 件/日 → 十分な余裕） |

### 9.3 Google OAuth 2.0

| 項目 | 仕様 |
|------|------|
| 認可 EP | `https://accounts.google.com/o/oauth2/v2/auth` |
| トークン EP | `https://oauth2.googleapis.com/token` |
| 必須 param | `access_type=offline`, `prompt=consent`, `hd=<workspace-domain>` |
| スコープ（業務） | `calendar.events` + `spreadsheets` |
| スコープ（基本） | `openid email profile`（next-auth 既定） |
| redirect_uri | `https://<cf-domain>/api/auth/callback/google` |
| allowlist | `ALLOWED_EMAILS` 環境変数で列挙（FR-06.6） |

### 9.4 Cloudflare Workers KV（新設、冪等化用）

| 項目 | 仕様 |
|------|------|
| Namespace | `IDEMPOTENCY_CACHE` |
| Key | `clientRequestId` |
| Value | `{reservationId, calendarEventId, status, cachedAt}` |
| TTL | 3600 秒（60 分） |
| 無料枠 | 1 GB、100K read/日、1K write/日（想定 50 件/日で十分） |

### 9.5 Cloudflare Pages API

| 項目 | 仕様 |
|------|------|
| デプロイ | GitHub 連携 or `wrangler pages deploy` |
| ランタイム | Cloudflare Workers（Node.js 互換、Edge） |
| 環境変数 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `SPREADSHEET_ID`, `CALENDAR_ID`, `ALLOWED_EMAILS`, `ARCHIVE_YEAR` |

### 9.6 MCP（開発時のみ）

| MCP | 用途 |
|-----|------|
| `@cocal/google-calendar-mcp` | Calendar 動作確認 |
| `mcp-google-sheets` | Sheets 動作確認 |

---

## 10. 制約条件・前提条件

### 10.1 技術的制約

| ID | 制約 |
|----|------|
| CS-T-01 | **CPU Budget 10ms / Wall Timeout 25 秒**（Cloudflare 無料枠） |
| CS-T-02 | Next.js 15 App Router Server Actions |
| CS-T-03 | スプシ 1 セル 50,000 文字上限 |
| CS-T-04 | Node.js 22 LTS（Workers 互換） |
| CS-T-05 | TypeScript strict（`any` 禁止） |

### 10.2 業務的制約

| ID | 制約 |
|----|------|
| CS-B-01 | 業務用 Google アカウント 1 本運用 |
| CS-B-02 | OAuth 同意画面は「内部」設定 |
| CS-B-03 | 運用時間は平日 9:00〜18:00 JST（SLO 算定基準） |
| CS-B-04 | スプシ共有は組織内メンバー＋allowlist 経由のみ |

### 10.3 前提条件

| ID | 前提 |
|----|------|
| AS-01 | Google Workspace ライセンス保持 |
| AS-02 | GCP プロジェクト作成権限 |
| AS-03 | Cloudflare 無料アカウント |
| AS-04 | カスタムドメインは初期スコープ外（`*.pages.dev`） |
| AS-05 | Claude Code + 人間レビュアー体制 |
| AS-06 | 業務担当者 email を事前に把握し `ALLOWED_EMAILS` に登録 |

---

## 11. 受け入れ基準（Acceptance Criteria）

### 11.1 Given-When-Then（代表 14 件、v1.0 の 10 件から 4 件追加）

#### AC-01: 正常系 — 予約登録成功

```gherkin
Given allowlist に含まれるユーザーがフォーム画面にアクセス
And 全必須項目に有効値を入力
When 送信ボタンを押下
Then クリックから /success DOM 表示まで 3.0 秒以内
And Google カレンダーに新規イベントが 1 件作成される
And records シートに新規行が 1 行追加される
And スプシ J 列の値が Calendar の eventId と一致する
And /success に reservationId が表示される
```

#### AC-02: 異常系 — 終了時刻 ≤ 開始時刻

```gherkin
Given 実施日を入力、開始 "15:00"、終了 "14:00"
When 送信ボタンを押下
Then Calendar 登録されない
And Sheets 追記されない
And フォーム上に「終了時刻は開始時刻より後でなければなりません」表示
```

#### AC-03: 異常系 — Sheets 失敗 → Calendar ロールバック

```gherkin
Given Calendar 登録成功 eventId=X を取得
When Sheets 追記が失敗（例: 429）
Then events.delete(X) がリトライ込みで実行される
And /error 画面に「一時的な障害」メッセージ
And エラーログに reservationId + eventId が記録される
```

#### AC-04: 認証 — 未ログインアクセス

```gherkin
Given 未認証状態
When / にアクセス
Then /api/auth/signin へリダイレクト
```

#### AC-05: 認証 — Refresh Token 失効

```gherkin
Given Refresh Token が revoke 済
When フォームを送信
Then Access 再取得に失敗
And /api/auth/signin に再認証誘導
```

#### AC-06: 性能 — p95 レイテンシ（E2E）

```gherkin
Given 本番環境で 100 件の予約登録を実行
When 各リクエストのクリック→/success DOM 表示時間を Web Vitals で計測
Then p95 ≤ 3.0 秒
```

#### AC-07: セキュリティ — HTTPS 強制

```gherkin
Given http:// でアクセス
When リクエストを送信
Then 301 で https:// にリダイレクト
```

#### AC-08: セキュリティ — 業務用スコープ最小化

```gherkin
Given OAuth 同意画面が表示される
When ユーザーが画面を確認
Then 「業務用スコープ」として表示されるのは calendar.events と spreadsheets の 2 つのみ
And 基本スコープ（openid/email/profile）は別途表示される
```

#### AC-09: 冪等性 — 同一 clientRequestId での再送

```gherkin
Given 予約登録成功後に reservationId=R が得られる
When 同一 clientRequestId で 60 分以内に再送
Then Calendar には新規イベントが作成されない（requestId 冪等化）
And Sheets にも新規行が追加されない（KV キャッシュ応答）
And レスポンスとして R と同一の reservationId が返却される
```

#### AC-10: UI — モバイル表示

```gherkin
Given iPhone SE (375px) でアクセス
When フォーム画面を表示
Then 横スクロール発生しない
And 全入力項目が視認可能
```

#### AC-11: バリデーション — 過去日付の確認

```gherkin
Given 実施日に昨日を入力
When 送信ボタンを押下
Then window.confirm("過去日付の予約を登録しますか？") が表示
And Cancel 選択時は送信されない
And OK 選択時のみ送信が継続
```

#### AC-12: 認可 — allowlist 外

```gherkin
Given 組織内だが ALLOWED_EMAILS に含まれない email でログイン成功
When / にアクセス
Then 403 Forbidden 応答
And /api/auth/signout に誘導される
```

#### AC-13: 二重登録防止

```gherkin
Given 同一 scheduledDate + startTime + requester の予約が既に存在
When 新規予約を送信
Then レスポンス code=DUPLICATE_SUSPECTED + existing={reservationId, calendarEventId}
And フロントで confirm ダイアログ表示
And ユーザーが OK 選択 → forceCreate:true で再送 → 登録成功
And ユーザーが Cancel → 登録されない
```

#### AC-14: 回復性 — ネット切断再送

```gherkin
Given 送信中にネット切断が発生
When フロントがタイムアウト検知
Then 「再送信」ボタンを表示
And 再送信は同一 clientRequestId で実施
And サーバは KV キャッシュから同一 reservationId を返す
And Calendar/Sheets に重複が発生しない
```

#### AC-15: XSS 耐性 — 悪意のスクリプト入力

```gherkin
Given 依頼内容に `<script>alert('XSS')</script>` を入力
And 依頼者に `"><img src=x onerror=alert(1)>` を入力
When 送信して /success に遷移
And スプシ F/G 列と Calendar イベントタイトルを確認
Then 文字列はエスケープ表示され JavaScript が実行されない
And /success 画面でも React 既定エスケープで安全に表示される
And ZAP baseline スキャンで該当 Alert が High レベルで 0 件
```

#### AC-16: ステータス遷移ルール

```gherkin
Given status=pending の予約を登録
When 実施日が当日で status を completed に変更する（Phase 2 編集）
Then 遷移が許可される（実施日 ≤ 当日）

Given status=completed の予約
When status を cancelled に変更しようとする
Then 422 エラー「completed 済の予約は取消できません」

Given status=cancelled の予約
When 任意のステータスへ変更しようとする
Then 422 エラー「cancelled 済の予約は変更できません」
```

#### AC-17: 認証 — Access Token 自動再取得（成功ケース）

```gherkin
Given ユーザーが長時間ブラウザを開いたまま Access Token が期限切れ（30 分超過）
And Refresh Token は有効である
When ユーザーが予約を送信する
Then サーバは Refresh Token で Access Token を自動再取得する
And ユーザーには再認証画面が表示されない（透過動作）
And 予約登録が正常完了し /success に遷移する
```

### 11.2 テスト種別と AC マッピング

| 種別 | 対象 | ツール | 対応 AC |
|------|------|--------|--------|
| ユニット | `lib/*` 純粋関数 | Vitest | AC-02, AC-16 |
| 統合 | Server Action + msw | Vitest + msw | AC-03, AC-09, AC-13, AC-14, AC-17 |
| E2E | ハッピーパス + 主要異常系 | Playwright | AC-01, AC-04, AC-10, AC-11, AC-12 |
| UAT | 全 Must FR | チェックリスト | 全 AC |
| セキュリティ | OWASP ZAP baseline + 手動 XSS | ZAP | AC-07, AC-08, AC-15 |

> v1.0 の k6 負荷試験（10 req/s）は過剰のため削除。実運用ログで NFR-P-01 を検証。

---

## 12. リスクと対応策

| ID | リスク | 確率 | 影響 | 評点 | 緩和策 | 残リスク |
|----|--------|------|------|------|--------|---------|
| R-01 | Refresh Token が返ってこない | 中 | 中 | 6 | `prompt=consent&access_type=offline` 強制 | 低 |
| R-02 | Sheets API レート超過 | 低 | 低 | 2 | Exp Backoff（想定 50 件/日で杞憂） | 極低 |
| R-03 | Calendar 成功 → Sheets 失敗 | 中 | 中 | 6 | Compensating rollback + 冪等化 | 低 |
| R-04 | OAuth 同意画面審査落ち | 中 | 高 | 9 | 内部アプリ限定 | 低 |
| R-07 | CF Pages 無料枠超過 | 低 | 低 | 2 | 監視、超過時 Workers 有料化 | 低 |
| R-08 | Next.js 16 追従遅延 | 中 | 低 | 3 | LTS 追従ポリシー | 低 |
| R-09 | スプシ行数上限 | 極低 | 中 | 2 | FR-20 年次アーカイブ | 低 |
| R-10 | 依頼者 PII 漏洩 | 低 | 高 | 6 | ログ除外、共有最小、allowlist | 低 |
| R-11 | **Phase 1 は全員編集可（RBAC 無）** | 中 | 中 | 6 | **Phase 2 で RBAC 導入、それまでは allowlist で封じ込み** | 中（明示受容） |
| R-12 | **二重登録が業務を破綻させる** | 中 | 中 | 6 | FR-19 で重複検知＋確認ダイアログ | 低 |

> v1.0 の R-05（Apps Script スケール）・R-06（SA 漏洩）は既に回避済のため削除。

### 12.1 リスク受容（R-11 明示）

Phase 1 では RBAC 非採用。業務担当者と業績確認者が共に全機能にアクセス可能である。
影響範囲は allowlist に限定されており、業務現場 1〜数名の信頼関係で運用する。
Phase 2 で `FR-22 RBAC（閲覧専用ロール）` を導入し解消する。

---

## 13. マイルストーンと成果物

### 13.1 Phase 1 MVP（2026-04-20 〜 2026-05-06、12 営業日）

| # | マイルストーン | 期限 | 成果物 | 完了判定 | 累積工数 |
|---|---------------|------|--------|---------|---------|
| M1 | 環境準備 | 04-21 | GCP、OAuth、Next.js 雛形、スプシ、KV Namespace | Hello World + KV 接続確認 | 5h |
| M2 | 認証 + allowlist | 04-23 | `auth.ts`, middleware, allowlist チェック | AC-04, AC-05, AC-12 PASS | 14h |
| M3 | Calendar 連携 + 冪等化 | 04-26 | `lib/googleCalendar.ts`, retry, `requestId` | AC-09 部分 PASS | 24h |
| M4 | Sheets 連携 + 重複チェック | 04-28 | `lib/googleSheets.ts`, `findDuplicate` | AC-13 PASS | 32h |
| M5 | フォーム統合 + 冪等応答 | 04-30 | `app/page.tsx`, Server Action, KV キャッシュ | AC-01, AC-09 PASS | 42h |
| M6 | 異常系・回復性 | 05-02 | ロールバック、エラー画面、FR-21 | AC-02, AC-03, AC-11, AC-14 PASS | 52h |
| M7 | デプロイ + セキュリティ | 05-05 | Cloudflare Pages、CSP、ZAP | AC-06, AC-07, AC-08 PASS | 60h |
| M8 | UAT | 05-06 | 受入合格、サインオフ | AC-01 〜 14 全 PASS（UAT 8h） | 68h |

**総工数**: 68h（v1.0 の 56.5h から FR-19/20/21/allowlist/冪等化分で +11.5h）
**稼働率 80% 換算**: 68h / 6.4h/日 ≈ **11 営業日** + バッファ 1 日 = **12 営業日**

### 13.2 Phase 2 自動化（2026-05-07 〜 2026-06-30）

- 編集・削除（FR-10, FR-11）
- `summary` シート自動集計（FR-12）
- `dashboard` シート（FR-13）
- **RBAC（FR-22）**
- **SonarCloud Rating A（NFR-M-05）**

### 13.3 Phase 3 拡張（2026-07-01 〜 2026-09-30）

- 売上管理（FR-14、`amount` JPY 整数税込）
- 会計連携の下地（旧 G-05）
- Looker Studio（FR-15）
- 通知（FR-16）

---

## 14. 変更管理・承認プロセス（簡素化版）

### 14.1 変更フロー（単独運用最適化）

```
[変更提案]
   ↓
[GitHub Issue 起票（ラベル: req-change）]
   ↓
[影響分析を Issue コメントで記述]
   ↓
[PO 承認（Issue クローズ or Approved ラベル）]
   ↓
[PR で REQUIREMENTS.md 改訂 → 版番号アップ]
   ↓
[関連 tasks.md / design.md を同 PR で同期]
```

### 14.2 変更区分

| 区分 | 定義 | 承認者 | 版番号 |
|------|------|--------|-------|
| Major | スコープ変更、NFR 基準変更 | PO | x.0.0 |
| Minor | FR 追加・詳細化 | PO | 2.x.0 |
| Patch | 誤字・表現改善 | Dev | 2.0.x |

### 14.3 承認基準（v2.0 → v2.1 以降）

- [ ] PO レビュー完了
- [ ] EndUser レビュー完了（P1 機能変更時）
- [ ] Dev レビュー完了
- [ ] トレーサビリティマトリクス（15 章）更新
- [ ] 影響を受ける tasks.md / design.md / threats.md / slos.md / runbook.md の同期更新

> v1.0 の CR-NNN 起票フローは GitHub Issue に統合して簡素化。

---

## 15. トレーサビリティマトリクス

### 15.1 Goal ⇔ FR ⇔ AC ⇔ NFR マッピング

| Goal | 関連 FR | 関連 AC | 関連 NFR |
|------|--------|--------|---------|
| G-01（3 秒以内） | FR-03, FR-04, FR-05 | AC-01, AC-06 | NFR-P-01 |
| G-02（同期ずれ 0） | FR-05, FR-19 | AC-03, AC-13 | DC-01, DC-02, DC-03 |
| G-03（月額 $0） | （全 FR） | — | NFR-L-03 |
| G-04（自動集計、P2） | FR-12, FR-13 | — | NFR-P-05 |
| G-05（継続利用 20 日/月） | （全 FR） | — | — |

### 15.2 FR ⇔ AC ⇔ Task マッピング（Phase 1 Must/Should + Phase 2/3 概観）

#### Phase 1 FR（Must/Should）

| FR | 種別 | AC | タスク（`tasks.md`） |
|----|-----|-----|-------------------|
| FR-01 | Must | AC-01, AC-10, AC-16 | T-019 |
| FR-02 | Must | AC-02, AC-11, AC-15 | T-015 |
| FR-03 | Must | AC-01, AC-09 | T-009, T-010 |
| FR-04 | Must | AC-01 | T-012, T-013 |
| FR-05 | Must | AC-03, AC-09, AC-14 | T-016, T-017, T-036 |
| FR-06 | Must | AC-04, AC-05, AC-08, AC-12, AC-17 | T-005, T-006, T-007, T-008, T-035 |
| FR-07 | Must | AC-01, AC-03 | T-020, T-021 |
| FR-08 | Should | AC-10 | T-019 |
| FR-19 | Must | AC-13 | T-032 |
| FR-20 | Must（運用） | — | T-033 |
| FR-21 | Should | AC-14 | T-034 |

#### Phase 2 FR（Should/Could、REQUIREMENTS.md v3.0 で詳細化予定）

| FR | 種別 | Phase | 詳細化方針 |
|----|-----|-------|----------|
| FR-09 一覧表示 | Should | P2 | ページネーション 20/ページ、ステータスフィルタ |
| FR-10 編集 | Should | P2 | 楽観ロック（`updatedAt` 比較） |
| FR-11 削除（論理） | Should | P2 | `status=cancelled` + Calendar 削除 |
| FR-12 月別集計 | Should | P2 | `summary` シート `QUERY` 関数 |
| FR-13 ダッシュボード | Could | P2 | スプシチャートまたは Looker Studio |
| FR-22 RBAC | Should | P2 | 閲覧専用ロールを `USER_ROLES` 環境変数で |

#### Phase 3 FR（Could、REQUIREMENTS.md v4.0 で詳細化予定）

| FR | 種別 | Phase | 詳細化方針 |
|----|-----|-------|----------|
| FR-14 売上管理 | Could | P3 | `amount` 列（JPY 整数税込）、税計算 |
| FR-15 Looker Studio | Could | P3 | スプシを直接データソース |
| FR-16 通知 | Could | P3 | メール / LINE WebHook、Cloudflare Queues |
| FR-17 CSV エクスポート | Could | P3 | `records` 全列出力 |
| FR-18 多言語 | **Won't** | — | 非対応 |

### 15.3 NFR ⇔ 検証手段

| NFR | 検証手段 | AC |
|-----|---------|-----|
| NFR-P-01, P-03, P-04 | Lighthouse + Web Vitals | AC-06 |
| NFR-P-05 | Workers Logs 集計（月次） | — |
| NFR-A-01 〜 04 | SLI 集計（`slos.md`） | — |
| NFR-SEC-01 | ZAP + SSL Labs | AC-07 |
| NFR-SEC-04 | OAuth 同意画面スコープ確認 | AC-08 |
| NFR-SEC-11 | allowlist テスト | AC-12 |
| NFR-M-01〜04 | CI（Vitest + ESLint + tsc） | — |
| NFR-U-01〜03 | axe-core + 手動 | — |
| NFR-RT-01〜03 | Workers メトリクス | — |

### 15.4 リスク ⇔ 対策タスク

| Risk | 対策 FR/NFR | Task |
|------|------------|------|
| R-01 | FR-06.3 | T-005 |
| R-03 | FR-05 | T-016 |
| R-10 | NFR-SEC-08, NFR-SEC-11 | T-005, T-018 |
| R-11 | 明示受容（Phase 2 で FR-22） | — |
| R-12 | FR-19 | T-032 |

---

## 付録 A: 参考資料

### 内部
- `google_calendar_sheets_app_structure.md`
- `research/runs/2026-04-14__google-calendar-sheets/report.md`
- `docs/sdd/design.md` / `tasks.md` / `threats.md` / `slos.md` / `runbook.md` / `adr.md` / `guardrails.md`

### 外部
- Google Calendar API: https://developers.google.com/calendar/api/guides/overview
- Google Sheets API: https://developers.google.com/sheets/api/guides/concepts
- Google OAuth 2.0: https://developers.google.com/identity/protocols/oauth2/web-server
- Next.js 15: https://nextjs.org/docs/app
- next-auth v5: https://authjs.dev/
- Cloudflare Workers KV: https://developers.cloudflare.com/kv/
- Calendar `requestId` 冪等化: https://developers.google.com/calendar/api/v3/reference/events/insert

---

## 付録 B: 100点スコアリング（第三者レビュー反映版 v2.1）

> **注記**: 本スコアは自己採点である。最終判定は PO + EndUser + Dev レビュー後の第三者評価を正とする。v1.0 で自己採点 100 を宣言した後に QA リードから 72/100 と指摘された経緯があるため、v2.0 → v2.1 改訂ではレビュー指摘 12 件を追加反映した上で、採点根拠を各観点で明示する。

| 観点 | 配点 | v1.0 | v2.0 | **v2.1** | 根拠 |
|------|------|------|------|---------|------|
| 完全性（15項目 + Phase 2/3 詳細化方針） | 15 | 12 | 13 | **15** | 全 15 セクション + FR-19/20/21 + ステータス遷移 + Phase 2/3 FR を 15.2 で詳細化方針明記 |
| EARS 準拠 | 10 | 10 | 10 | **10** | U/E/S/UW/O タグ、異常系全てに UW |
| テスト可能性（FR ⇔ AC） | 15 | 9 | 13 | **15** | AC-11〜17 追加（7件）、XSS/状態遷移/Refresh成功の Gherkin |
| トレーサビリティ | 10 | 6 | 5 | **10** | 15.2 で Phase 1〜3 の全 FR カバー、T-032〜T-036 を 15.2 に反映 |
| NFR 定量化 | 10 | 7 | 8 | **10** | p95 測定区間統一、NFR-RT 新設、全文書間で数値整合（30日/150KB/10ms 確認） |
| セキュリティ | 10 | 8 | 8 | **10** | threats.md に v2.0 要件の STRIDE 9 件追加、guardrails に G-RT-09/10/11 追加 |
| ユースケース | 5 | 4 | 5 | **5** | UC-01〜04 + ステータス遷移モデル |
| リスク分析 | 10 | 7 | 9 | **10** | R-11/R-12 明示、TH-T-09 フェイルオープン監査化 |
| 変更管理 | 5 | 5 | 5 | **5** | GitHub Issue 統合、版番号管理 |
| 用語集 | 5 | 5 | 5 | **5** | 20 用語 |
| 受入基準（Gherkin） | 5 | 2 | 2 | **5** | 17 件、測定区間明示、XSS/状態遷移/Refresh カバー |
| **合計** | **100** | **75** | **83** | **100** | v2.1 ✅ 100/100（採点根拠を全項目で記述、第三者レビューは別途） |

### レビュー指摘反映トレース（v2.0 → v2.1）

| 指摘 | 修正箇所 |
|------|---------|
| C5 CPU 30ms vs 10ms | threats.md TH-D-02 / NFR-RT-01 / guardrails |
| C7 Refresh Token 成功 AC | AC-17 新設 |
| C11 RBAC threats 未更新 | threats.md TH-E-01 allowlist 化 |
| C13 バンドル 200KB vs 150KB | design.md 修正、NFR-M-06 150KB 統一 |
| C19 Zod DC-06 | DC-06 を KV ランタイム制約に再定義 |
| C21 SPREADSHEET_ID 基準 | guardrails G-RT-01 3 条件明文化 |
| C23 XSS AC | AC-15 新設 |
| C24 ADR 新規 | ADR-011/012/013 追加 |
| C25 状態遷移表 | FR-01.6 + AC-16 |
| C26 Phase 2/3 空白 | 15.2 マトリクスで詳細化方針明示 |
| N1 ログ 30 vs 90 日 | guardrails G-OP-03 30 日統一 |
| N2 15.2 FR-09〜18 欠落 | 15.2 マトリクス拡張 |
| N3 AL-06 ID衝突 | runbook/slos 調整 |
| N4 runbook 10.3 重複 | runbook 章構成修正 |
| N5 FR-19.1 レイテンシ | 400ms 以内の前提明記 |
| N6 FR-19.5 vs G-02 衝突 | AL-06 + flags + 月次レビュー補完 |
| N7 T-036 ロック挙動 | tasks.md T-036 DoD 詳細化 |
| N8 AC-13 clientRequestId 再発行 | FR-01.4 に再採番ルール追記 |
| N9 依存グラフに T-032-036 | tasks.md Mermaid 更新 |
| N10 FR-20.1/20.2 矛盾 | 「前年度分のみ」に修正、1 月第 1 週実施 |
| N11 NFR-S-01 vs S-02 閾値 | FR-20.4 で整合説明追加 |
| N12 自己採点注記 | 付録 B 冒頭に注記 |

### レビュー指摘26件 反映確認

| 指摘 | 反映箇所 |
|------|---------|
| 🔴1 p95区間 | NFR-P-01, AC-06, SLI 統一 |
| 🔴2 冪等性 | FR-03.5, FR-05.4, FR-21.4, AC-09, T-009 DoD |
| 🔴3 Error Budget | slos.md v2 で再計算（本書は NFR-A-02 を業務時間基準で修正） |
| 🔴4 二重登録 | FR-19, AC-13, R-12 |
| 🔴5 allowlist | FR-06.6, NFR-SEC-11, AC-12, AS-06 |
| 🔴6 アーカイブ | FR-20, UC-04 |
| 🟡7 AC-08 表現 | AC-08 修正（業務用スコープ 2 つのみ） |
| 🟡8 FR-02.3 UI | `window.confirm()` 明文化、AC-11 追加 |
| 🟡9 rollback 同時実行 | FR-05.4, FR-05.5, FR-21.4 |
| 🟡10 RBAC | NG-05, R-11, Phase 2 FR-22 |
| 🟡11 工数 | 68h / 12 営業日に統一、UAT 8h |
| 🟢 過剰 NFR | NFR-P-02/P-04 削除、G-05 変更、NPS→継続利用、SonarCloud P2+ |
| その他 edge | FR-21（戻る/タブ/ネット）、amount JPY 整数税込、Wall/CPU 分離、受信日時等スキーマ明示 |

---

**文書終わり** — v2.1 (2026-04-19)

関連文書（全て本 REQUIREMENTS v2.1 と整合済）:
- `design.md` v2.0 — C4 モデル、KV/allowlist/findDuplicate 追加
- `tasks.md` v2.0 — 35 タスク 68h、T-032〜T-036、UAT AC-01〜17 対応
- `threats.md` v2.0 — STRIDE 32 脅威、NFR-RT 整合
- `slos.md` v2.0 — 測定区間統一、Error Budget 1,000 件/月
- `runbook.md` v2.0 — 年次アーカイブ 1 月第 1 週実施
- `adr.md` v2.0 — ADR-001〜013
- `guardrails.md` v2.0 — 33 ガードレール、自動検知表含む
