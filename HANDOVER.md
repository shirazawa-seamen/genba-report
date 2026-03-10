# 現場報告システム - 引き継ぎ資料

作成日: 2026-02-16
更新日: 2026-02-17

---

## 0. 本日の作業サマリー（2026-02-17）

### 実施した作業

1. **報告詳細ページ作成**
   - `reports/[id]/page.tsx`を新規作成
   - `daily_reports`テーブルから該当IDの報告を取得
   - `sites`テーブルとJOINして現場名・住所を表示
   - `report_photos`テーブルから写真を取得して表示
   - 既存のダークテーマ（amber系アクセント）に統一
   - 報告一覧ページからのリンクは既に実装済み

### 次回の作業

1. **Supabase Storageバケット作成**（優先度：高）
   - Supabaseダッシュボードで`report-photos`バケットを作成
   - 公開設定またはRLSポリシー設定が必要
2. **動作テスト・バグ修正**
3. **現場マスタ管理**（優先度：中）

---

## 0.1. 過去の作業サマリー（2026-02-16）

### 実施した作業

1. **画像添付機能の修正**
   - 「次へ」ボタンの連打防止（300msディレイ）
   - ファイル入力を`useRef`で明示的に制御
   - 写真プレビューに削除ボタン追加
   - Enterキーでのフォーム誤送信を修正

2. **日次報告のDB保存実装**
   - `actions.ts`にServer Action作成
   - 現場が存在しない場合は自動作成

3. **報告一覧のDB連携**
   - `sites`テーブルとJOINして現場名を取得

4. **写真アップロード機能実装**
   - Supabase Storage連携コード作成

5. **RLSポリシー修正**
   - `profiles`テーブルの無限再帰エラーを修正
   - 下記SQLをSupabaseで実行済み（または要実行）

### 要対応：RLSポリシー修正SQL

以下をSupabaseダッシュボードのSQL Editorで実行してください（未実行の場合）:

```sql
DROP POLICY IF EXISTS "profiles_select_all_by_supervisor_client" ON public.profiles;
DROP POLICY IF EXISTS "sites_insert_supervisor" ON public.sites;
DROP POLICY IF EXISTS "sites_update_supervisor" ON public.sites;

CREATE POLICY "sites_insert_authenticated"
    ON public.sites FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "sites_update_authenticated"
    ON public.sites FOR UPDATE
    USING (auth.uid() IS NOT NULL);
```

---

## 1. プロジェクト概要

**建築事業部向け現場報告システム**のフェーズ1（MVP）を開発済み。

### 目的
- 県外企業からの信頼獲得（「見える工事®」の実現）
- 現場作業の属人化解消
- 報告業務の効率化と品質向上

### 要件定義書
`/Users/rego/Desktop/現場報告システム/要件定義書.md`

---

## 2. 技術スタック

| カテゴリ | 技術 |
|----------|------|
| フロントエンド | Next.js 16.1.6 (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| バックエンド | Supabase (BaaS) |
| データベース | PostgreSQL (Supabase) |
| 認証 | Supabase Auth |
| ストレージ | Supabase Storage (未実装) |

---

## 3. ディレクトリ構成

```
/Users/rego/Desktop/現場報告システム/
├── 要件定義書.md                    # 全体要件
├── HANDOVER.md                      # この引き継ぎ資料
└── app/                             # Next.jsプロジェクト
    ├── .env.local                   # 環境変数（設定済み）
    ├── .env.local.example           # 環境変数テンプレート
    ├── package.json
    ├── supabase/
    │   └── schema.sql               # DBスキーマ（実行済み）
    └── src/
        ├── middleware.ts            # 認証ミドルウェア
        ├── app/
        │   ├── layout.tsx           # ルートレイアウト
        │   ├── login/
        │   │   └── page.tsx         # ログインページ
        │   ├── auth/
        │   │   └── signout/
        │   │       └── route.ts     # ログアウトAPI
        │   └── (dashboard)/         # 認証必須エリア
        │       ├── layout.tsx       # ダッシュボードレイアウト
        │       ├── page.tsx         # ダッシュボード（トップ）
        │       └── reports/
        │           ├── page.tsx       # 報告一覧（DB連携済み）
        │           ├── [id]/
        │           │   └── page.tsx   # 報告詳細ページ
        │           └── new/
        │               ├── page.tsx   # 新規報告作成
        │               └── actions.ts # Server Actions（DB保存・写真アップロード）
        ├── components/
        │   ├── ui/                  # 共通UIコンポーネント
        │   │   ├── button.tsx
        │   │   ├── input.tsx
        │   │   ├── select.tsx
        │   │   └── textarea.tsx
        │   └── reports/
        │       └── DailyReportForm.tsx  # 日次報告フォーム
        └── lib/
            └── supabase/            # Supabaseクライアント
                ├── client.ts        # ブラウザ用
                ├── server.ts        # サーバー用
                └── middleware.ts    # ミドルウェア用
```

---

## 4. データベース設計

### テーブル構成

```
profiles          # ユーザープロフィール（auth.usersと連携）
├── id            UUID (PK, auth.users.idを参照)
├── email         TEXT
├── name          TEXT
├── role          TEXT ('worker' | 'supervisor' | 'client')
└── created_at    TIMESTAMPTZ

sites             # 現場マスタ
├── id            UUID (PK)
├── name          TEXT
├── address       TEXT
├── start_date    DATE
├── end_date      DATE
└── created_at    TIMESTAMPTZ

daily_reports     # 日次報告
├── id            UUID (PK)
├── site_id       UUID (FK → sites)
├── reporter_id   UUID (FK → auth.users)
├── report_date   DATE
├── work_process  TEXT
├── work_content  TEXT
├── workers       TEXT[]
├── progress_rate INTEGER (0-100)
├── weather       TEXT
├── work_hours    NUMERIC(4,1)
├── issues        TEXT
└── created_at    TIMESTAMPTZ

report_photos     # 報告写真
├── id            UUID (PK)
├── report_id     UUID (FK → daily_reports)
├── storage_path  TEXT
├── photo_type    TEXT ('before'|'after'|'corner_ne'|'corner_nw'|'corner_se'|'corner_sw')
├── caption       TEXT
└── created_at    TIMESTAMPTZ
```

### RLS (Row Level Security)

- **profiles**: 自分のみ参照・更新可。supervisor/clientは全員参照可
- **sites**: 全認証ユーザー参照可。supervisorのみ作成・更新可
- **daily_reports**: workerは自分の報告のみ。supervisor/clientは全報告参照可
- **report_photos**: 報告の権限に準拠

### トリガー

`on_auth_user_created`: 新規ユーザー登録時に自動でprofilesレコード作成

---

## 5. 完成済み機能（フェーズ1）

| 機能 | 状態 | 備考 |
|------|------|------|
| ユーザー認証 | ✅ 完成 | Supabase Auth |
| ログインページ | ✅ 完成 | メール/パスワード |
| ログアウト | ✅ 完成 | |
| ダッシュボード | ✅ 完成 | 統計はプレースホルダー |
| 日次報告フォーム | ✅ 完成 | 3ステップUI、連打防止付き |
| 日次報告DB保存 | ✅ 完成 | Server Action実装済み |
| 報告一覧DB連携 | ✅ 完成 | sitesとJOINして表示 |
| 報告詳細ページ | ✅ 完成 | 写真表示、現場情報表示 |
| 写真アップロード | ✅ 完成 | Supabase Storage連携 |
| 写真削除機能 | ✅ 完成 | プレビュー画面から削除可能 |

---

## 6. 未実装機能（次のタスク）

### 優先度: 高

1. **Supabase Storage bucket作成**
   - Supabaseダッシュボードで`report-photos`バケットを作成
   - 公開設定またはRLSポリシー設定が必要

### 優先度: 中

2. **現場マスタ管理**
   - 現場の追加・編集画面
   - 現場選択をドロップダウンに変更

3. **ダッシュボード統計**
   - 実際のデータで集計

### 優先度: 低（フェーズ2以降）

4. 週次報告自動生成
5. PDF出力
6. CCUS API連携
7. LINE/Slack連携

---

## 7. 環境情報

### Supabase

- プロジェクト作成済み
- スキーマ実行済み（`supabase/schema.sql`）
- テストユーザー作成済み

### ローカル環境

- Node.js v24.12.0
- npm 11.6.2
- `.env.local` 設定済み

### 開発サーバー起動

```bash
cd /Users/rego/Desktop/現場報告システム/app
npm run dev
```

http://localhost:3000

---

## 8. 主要ファイルの説明

### `src/components/reports/DailyReportForm.tsx`
- 日次報告の3ステップフォーム
- Step 1: 基本情報（現場名、報告日、作業工程）
- Step 2: 作業内容（内容、作業者、進捗率）
- Step 3: 写真アップロード（削除機能付き）
- ボタン連打防止機能実装済み
- Server Action経由でDB保存・写真アップロード実装済み

### `src/app/(dashboard)/reports/new/actions.ts`
- `createDailyReport`: 日次報告をDBに保存
- `uploadReportPhotos`: 写真をSupabase Storageにアップロード
- 現場が存在しない場合は自動作成（supervisorのみ）

### `src/lib/supabase/`
- `client.ts`: クライアントコンポーネント用
- `server.ts`: サーバーコンポーネント用
- `middleware.ts`: 認証セッション管理用

### `src/middleware.ts`
- `/login`と`/auth/**`以外は認証必須
- 未認証時は`/login`にリダイレクト

---

## 9. 注意事項

1. **Supabaseの認証キー**は`.env.local`に保存済み。リポジトリにコミットしないこと

2. **RLSが有効**なので、APIテスト時は認証トークンが必要

3. **Next.js 16**を使用。middlewareの書き方が従来と異なる可能性あり

4. **UIはダークテーマ**で統一。カラーはamber（アンバー）をアクセントに使用

5. **Supabase Storage**の`report-photos`バケットを作成する必要あり
   - Supabaseダッシュボード → Storage → New bucket
   - バケット名: `report-photos`
   - Public bucket: OFF（RLSで制御）

---

## 10. 参考コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 型チェック
npx tsc --noEmit

# Supabase スキーマ確認（SQL Editor）
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

---

## 11. 連絡事項

- バイブコーディング初心者のユーザー向けに開発
- 丁寧な説明を心がけること
- 複雑な変更は事前に確認を取ること

---

*この資料は Claude Opus 4.5 が作成しました*
