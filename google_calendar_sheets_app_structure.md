# Googleカレンダー × スプレッドシート連携アプリ構造メモ

## 目的
Webアプリで入力した予定情報を、業務用Googleカレンダーへ登録し、同時にGoogleスプレッドシートへ記録する。  
その後、スプレッドシート上で月別件数や依頼内容ごとの集計を行い、視覚的に管理できるようにする。

---

## 全体構造
```text
[利用者]
  ↓ 入力
[Webアプリ]
  ↓ 登録処理
[Googleカレンダー]
  └─ 実際の予定を管理

[Googleスプレッドシート]
  └─ 台帳・集計・可視化
```

---

## 基本フロー
1. 利用者がWebアプリのフォームに予定情報を入力する
2. 登録処理で入力内容をバリデーションする
3. Googleカレンダーに予定を作成する
4. Googleスプレッドシートに1行追加する
5. 成功または失敗の結果を画面に返す

---

## おすすめ構成
### 1. 入力層
役割:
- 予定情報の入力
- 必須項目チェック
- 二重送信防止

入力項目例:
- 実施日
- 開始時刻
- 終了時刻
- 依頼内容
- 依頼者
- メモ
- ステータス

---

### 2. 処理層
役割:
- バリデーション
- Googleカレンダーへの登録
- Googleスプレッドシートへの追記
- エラーハンドリング

処理順:
1. validateInput()
2. createCalendarEvent()
3. appendSpreadsheetRow()
4. return response

※ 先にカレンダー登録、その後にスプシ保存の順がおすすめ

---

### 3. 保存層
#### Googleカレンダー
役割:
- 実際の予定管理
- 日・週・月単位での確認

#### Googleスプレッドシート
役割:
- 1行1依頼の管理台帳
- 集計・分析
- グラフ化

---

## スプレッドシートの推奨列
```text
A: 受付ID
B: 受付日
C: 実施日
D: 開始時刻
E: 終了時刻
F: 依頼内容
G: 依頼者
H: ステータス
I: メモ
J: calendarEventId
```

### 特に重要な列
- 受付ID
- calendarEventId

この2つを持たせることで、後から予定修正や照合がしやすくなる。

---

## 画面構成
最低限の3画面で開始可能。

1. 入力画面
2. 完了画面
3. エラー画面

---

## シート構成
最低限の3シートで開始可能。

1. `records`  
   台帳データ保存用

2. `summary`  
   月別件数、依頼種別別件数などの集計用

3. `dashboard`  
   グラフや可視化用

---

## 最小機能
最初は以下の4機能に絞る。

1. 新規登録
2. Googleカレンダー反映
3. Googleスプレッドシート記録
4. 月別集計

---

## 実装パターン
### A. 最小構成
Apps Script 単体

構成:
- フォーム画面
- Googleカレンダー登録
- Googleスプレッドシート追記
- 集計

向いているケース:
- まず最短で動かしたい
- 1人運用
- Google環境中心

---

### B. 実用構成
Next.js などのWebアプリ + Google API

構成:
- フロントエンド
- APIルート
- Google Calendar API
- Google Sheets API

向いているケース:
- UIを整えたい
- 将来機能追加したい
- Claude Codeで継続開発したい

---

### C. 本格構成
Webアプリ + DB + Google連携

構成:
- フォーム送信内容をDBに保存
- DBからGoogleカレンダーへ同期
- 分析用にスプシ出力

向いているケース:
- 将来ユーザー追加の可能性がある
- 大規模化を見据えている

※ 現時点ではやりすぎなので不要

---

## 今回のおすすめ
現状の前提では、次のどちらかが現実的。

### 第一候補
Apps Script ベース

### 第二候補
Next.js + Google API ベース

Claude Code を使って作るなら、保守性の観点では  
**Next.js + Google Calendar API + Google Sheets API** が扱いやすい。

---

## 推奨ファイル構成例
```text
project-root/
├─ app/
│  ├─ page.tsx
│  ├─ success/page.tsx
│  └─ error/page.tsx
├─ app/api/
│  └─ reservations/route.ts
├─ lib/
│  ├─ googleCalendar.ts
│  ├─ googleSheets.ts
│  ├─ validation.ts
│  └─ config.ts
├─ types/
│  └─ reservation.ts
├─ .env.local
└─ README.md
```

---

## 想定する主な関数
```ts
validateInput(data)
createCalendarEvent(data)
appendSpreadsheetRow(data, eventId)
createReservation(data)
```

### 役割
- `validateInput`: 入力チェック
- `createCalendarEvent`: Googleカレンダーに予定作成
- `appendSpreadsheetRow`: スプレッドシートへ追記
- `createReservation`: 一連の処理をまとめる

---

## セキュリティ設計の基本
- 業務用Googleアカウントを1本に寄せる
- 個人用Googleアカウントと分ける
- 権限は必要最小限にする
- フロント側に秘密情報を置かない
- スプレッドシートの共有設定を最小限にする
- ログを残して追跡できるようにする

---

## 開発のおすすめ順
1. スプレッドシート台帳を作る
2. Googleカレンダー登録処理を作る
3. Webフォームを作る
4. スプレッドシート自動追記を作る
5. summary シートを作る
6. dashboard シートを作る

---

## 最後に
最初から高機能にしすぎず、  
**「入力 → カレンダー登録 → スプシ記録」**  
の最小ループを先に完成させるのがよい。

その後に、
- 編集機能
- 削除機能
- 売上管理
- フィルタ検索
- 月別ダッシュボード
を追加していく流れが安全。
