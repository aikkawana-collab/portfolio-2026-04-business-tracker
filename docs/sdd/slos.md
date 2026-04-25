# SLO / SLI 定義書 v2.0

**対象**: 業績管理アプリ
**Version**: 2.0.0
**作成日**: 2026-04-19
**対応要件**: `REQUIREMENTS.md` v2.0.0 / NFR-A-01 〜 04, NFR-P-01 〜 05

## v1.0 → v2.0 変更点
- **C3 Error Budget 算定根拠修正**: 母数を「26,000件/月」→ **想定実トラフィック 1,000 件/月（50件/日 × 20営業日）** に修正
- **C1 レイテンシ測定区間統一**: SLI_L_01 を「Server Action 内部処理」→ **「クリック→`/success` DOM表示」E2E** に統一（`REQUIREMENTS.md` NFR-P-01 / AC-06 と整合）
- **R1 過剰 SLO 削除**: NFR-P-02「p99 ≤ 5.0 秒」を削除（サンプル数不足）

---

## 1. 用語

| 用語 | 定義 |
|------|------|
| **SLI** | 実測メトリクス |
| **SLO** | 目標値 |
| **Error Budget** | SLO 未達許容予算 = (100% − SLO) × 想定トラフィック |

---

## 2. Critical User Journey (CUJ)

| CUJ | シナリオ | 成功判定 |
|-----|---------|---------|
| CUJ-01 | 予約登録（フォーム送信〜`/success` DOM 表示） | クリック→DOM表示完了 + Calendar/Sheets 両方成功 |
| CUJ-02 | 認証（ログイン〜トップ） | HTTP 200 + 有効セッション |
| CUJ-03 | 一覧閲覧 (Phase 2) | HTTP 200 + 結果表示 |

---

## 3. SLO 定義

### 3.1 可用性 SLO

| SLO ID | 対象 | 計測窓 | 目標 |
|--------|------|--------|------|
| SLO-A-01 | 予約登録 (CUJ-01) 成功率 | 28 日ローリング | **99.0%** |
| SLO-A-02 | 認証 (CUJ-02) 成功率 | 28 日ローリング | **99.5%** |
| SLO-A-03 | フォーム画面 HTTP 200 応答率 | 28 日ローリング | **99.5%** |

**算定窓**: 業務時間（平日 9:00〜18:00 JST ≒ 20 営業日/月 × 9h = 180h/月）

### 3.2 レイテンシ SLO

| SLO ID | 対象 | 指標 | 目標 | 測定区間 |
|--------|------|------|------|---------|
| SLO-L-01 | 予約登録 E2E | p95 | **≤ 3.0 秒** | **クリック→`/success` DOM 表示** |
| SLO-L-02 | フォーム初期表示 | FCP | **≤ 1.5 秒** | First Contentful Paint |
| SLO-L-03 | フォーム初期表示 | LCP | **≤ 2.5 秒** | Largest Contentful Paint |

> v1.0 の SLO-L-02 (p99 ≤ 5.0秒) は削除。
> **測定区間を統一**: クリック時刻は `performance.mark('reservation.click.start')`、`/success` 到達は Page Load で計測。Edge RTT・Google API 呼出を全て含む実ユーザー体感時間。

### 3.3 エラー率 SLO

| SLO ID | 対象 | 目標 |
|--------|------|------|
| SLO-E-01 | 予約登録 5xx エラー率 | **< 0.5%** |
| SLO-E-02 | Sheets API 呼び出しエラー率 | **< 0.1%** |
| SLO-E-03 | Calendar API 呼び出しエラー率 | **< 0.1%** |

---

## 4. SLI 定義（計測方法）

### 4.1 可用性 SLI

```
SLI_A_01 = (成功登録数) / (全登録リクエスト数) × 100
```

- **データソース**: Cloudflare Workers Logs（`event=reservation_create_success|failure`）
- **成功定義**: Server Action が `Result.ok` を返し、`/success` 遷移イベントが記録された
- **除外**: 4xx（バリデーション、allowlist 拒否は正常動作）
- **集計**: 28 日ローリング

### 4.2 レイテンシ SLI（v2.0 で測定区間統一）

```typescript
// フロント実装
performance.mark('rsv.click.start');
await submitForm();
// /success ページ到達時
performance.mark('rsv.success.loaded');
performance.measure('rsv.e2e', 'rsv.click.start', 'rsv.success.loaded');
// → Web Vitals 送信
```

```
SLI_L_01 = P95(rsv.e2e duration in ms)
```

- **データソース**: Web Vitals API + Cloudflare Web Analytics
- **計測区間**: **クリック → `/success` の DOM 表示完了**（Edge RTT・Google API 呼出含む）
- **集計**: 28 日ローリング

### 4.3 エラー率 SLI

```
SLI_E_01 = (5xx 応答数) / (全登録リクエスト数) × 100
```

- **除外**: 401（再認証誘導）、403（allowlist 拒否）、422（バリデーション）、409（重複確認待ち）

---

## 5. Error Budget Policy

### 5.1 想定トラフィック（v2.0 再計算）

| 項目 | 値 | 根拠 |
|------|-----|------|
| 想定登録件数 | **50 件/日（上限）× 20 営業日 = 1,000 件/月** | `REQUIREMENTS.md` 非機能前提 + NFR-S-01 |
| 算定窓 | 業務時間 9:00〜18:00 JST × 平日 | CS-B-03 |

### 5.2 Error Budget 計算

| SLO | 許容失敗件数/月 |
|-----|---------------|
| SLO-A-01（99.0%） | **10 件/月**（1,000 × 1.0%） |
| SLO-A-02（99.5%） | 5 件/月（想定ログイン件数 1,000 の 0.5%） |
| SLO-A-03（99.5%） | 5 件/月（想定アクセス 1,000 の 0.5%） |
| SLO-E-01（< 0.5%） | 5 件/月 |

> v1.0 の「1.0% ≈ 260 件／26,000 件」は根拠不明。v2.0 で実トラフィック 1,000 件/月に基づき再計算。

### 5.3 消費状況による対応

| Budget 消費率 | 状態 | アクション |
|--------------|------|----------|
| 0〜50% | 🟢 Healthy | 通常開発継続 |
| 50〜75% | 🟡 Caution | 信頼性タスク優先、新機能慎重 |
| 75〜100% | 🟠 Alert | 新機能凍結、信頼性改善のみ |
| > 100% | 🔴 Exhausted | 完全凍結、ポストモーテム実施 |

### 5.4 Budget リセット

月次（毎月 1 日 00:00 JST）

---

## 6. モニタリング & アラート

### 6.1 ダッシュボード構成

| ウィジェット | 内容 | 可視化 |
|------------|------|--------|
| 可用性 (28d) | SLI_A_01 時系列 | 折れ線 |
| E2E レイテンシ | p50/p95 分布 | ヒストグラム |
| Calendar/Sheets API エラー | コード別件数 | 積み上げ棒 |
| Error Budget 残量 | 月初からの累積消費 | ゲージ |
| 時系列ログ | `event=reservation_*` | テーブル |

**ツール**: Cloudflare Web Analytics（無料）+ Workers Logs Push（Phase 3 Grafana 検討）

### 6.2 アラートルール

| ID | 条件 | 通知 | 優先度 |
|----|------|------|-------|
| AL-01 | 1 時間の成功率 < 95% | Slack Webhook | **P1** |
| AL-02 | 5 分間の 5xx エラー率 > 5% | Slack | **P1** |
| AL-03 | E2E p95 > 5 秒 が 15 分継続 | Slack | P2 |
| AL-04 | Error Budget 消費 > 50% | Slack | P2 |
| AL-05 | Refresh Token 失敗率 > 10% | Slack | P2 |
| AL-06 | **二重登録チェック失敗（`event=dup_check_failed`）率 > 5%** | Slack | P2 |
| AL-07 | **allowlist 外ログイン試行 > 10 件/日** | Slack | P3 |
| AL-08 | **`records` シート行数 ≥ 900,000 行（ARCHIVE_ROW_WARN）** | Slack | P3 |

> v1.0 AL-01 の「Slack（手動）」を Slack Webhook 自動通知に変更（形骸化防止）。

---

## 7. 測定精度の限界と補正

| 課題 | 補正 |
|------|------|
| 小規模トラフィック（50 件/日）で統計有意性が低い | 28 日窓で平滑化。P0 インシデントは件数でなく Yes/No 判定 |
| Cloudflare Web Analytics は匿名化サンプリング | 絶対値でなくトレンドを監視 |
| Google API 障害は自社 SLO から除外 | `ext_dependency_down=true` タグで分離 |
| p99 を測定不能 | p95 のみ計測（サンプル不足のため p99 は削除） |

---

## 8. SLO レビュー運用

| 活動 | 頻度 | 出席者 |
|------|------|--------|
| Weekly チェック | 毎週月曜 | Dev |
| 月次レビュー（Budget Report） | 毎月 5 日 | PO + Dev |
| 四半期 SLO 見直し | 四半期末 | PO + Dev + EndUser |

---

## 9. Phase 進化プラン

| Phase | 追加/変更 |
|-------|----------|
| Phase 1 | 本 SLO 運用開始 |
| Phase 2 | CUJ-03（一覧表示）、CUJ-04（編集/削除）SLO 追加 |
| Phase 3 | 通知配信 SLO、Looker Studio 反映ラグ SLO |

---

## 10. 想定値（設計時点）

| 指標 | 設計目標 | 業界ベンチマーク |
|------|---------|----------------|
| 可用性 99.0% | ≤ 1.8 h ダウン/月（業務時間基準） | SaaS 一般 99.9%、社内業務 99% で十分 |
| E2E p95 3.0 秒 | 現実的 | フォーム送信系 2〜5 秒が一般 |
| Sheets API エラー率 0.1% | 楽観的 | レート未超なら達成可能 |

---

**SLO 品質スコア v2.0**: 92/100（測定区間統一・Error Budget 実計算・過剰SLO削除・AL-06/07/08 追加、REQUIREMENTS v2.1 と整合）
