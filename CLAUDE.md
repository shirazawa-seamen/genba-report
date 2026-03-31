# 現場報告システム

## 技術スタック
- Next.js (App Router) + TypeScript
- Supabase (PostgreSQL, Auth, Storage, RLS)
- Tailwind CSS

## 開発フロー（必須）

1. **Notionタスクボード確認**: https://www.notion.so/seameninc/32bf9a30024d80b2af11c84917d9cbe2?v=32bf9a30024d813bb008000c6a0a244f
   - タスクDB: `collection://32bf9a30-024d-8179-8553-000ba02f760f`
2. **優先順位確認**: 順番（大きい順に優先）とステータスを確認
3. **開発**: ステータスを「進行中」に変更して開発
4. **確認依頼**: 実装完了後「確認中」に変更しユーザーに確認依頼
5. **FB対応**: FBがあれば「再修正」→修正→再度「確認中」
6. **完了**: ユーザーOKで「完了」に変更
7. **デプロイ後**: 更新履歴DBに次verで更新内容をまとめる（ユーザー向け、技術記述不要）
   - 更新履歴DB: `collection://32df9a30-024d-80aa-8485-000be25c6fd4`（現在 ver 0.01）
8. **問題点メモ**: 開発中に発見した問題点はメモDBに追加
   - メモDB: `collection://32bf9a30-024d-8013-9db8-000b07788ffb`

### ステータス遷移
未着手 → 調査中 → 進行中 → 確認中 → 完了（再修正もあり）

### 重要: デプロイ制限
- **git pushは絶対にユーザーの明示的な指示があるまで行わない**
- 開発・確認はローカル（localhost:3333）で行う

## Supabase ルール（必須）

詳細は `~/.claude/skills/supabase-postgres-best-practices/` を参照。

### RLS
- `auth.uid()` を直接使わない → 必ず `(select auth.uid())`
- RLSポリシーで使うカラムにはインデックスを張る

### クエリ
- WHERE/JOINに使うカラムにはインデックス
- N+1回避、バッチ取得/JOIN活用
- ページネーションはカーソルベース（OFFSETでなく）

### マイグレーション
- `CREATE POLICY` の前に `DROP POLICY IF EXISTS`（冪等性）
- `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`
- 命名: `app/supabase/migration_vN_説明.sql`
