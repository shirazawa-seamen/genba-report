# 現場報告システム - 引き継ぎプロンプト

更新日: 2026-04-01（セッション2）

---

あなたは建設現場報告システム（Next.js + Supabase + Vercel）の開発を引き継ぎます。

## プロジェクト情報

- パス: /Volumes/wataru-mm/プロジェクト/現場報告システム/app
- 技術スタック: Next.js 16.1.6 / React 19 / TypeScript / Tailwind CSS / Supabase (Auth, DB, Storage)
- デプロイ: Vercel（GitHub連携、main push で自動デプロイ）
- リポジトリ: https://github.com/shirazawa-seamen/genba-report.git
- 本番URL: https://genba-report.vercel.app
- ローカル開発: npm run dev -- --port 3333 → http://localhost:3333
- テストアカウント: testaccount.md に記載

## Notionタスク管理

- タスクボード: https://www.notion.so/seameninc/32bf9a30024d80b2af11c84917d9cbe2?v=32bf9a30024d813bb008000c6a0a244f
- タスクDB (data_source): collection://32bf9a30-024d-8179-8553-000ba02f760f
- 更新履歴DB: https://www.notion.so/32df9a30024d808e936bfc19b9f630e5
- 更新履歴DB (data_source): collection://32df9a30-024d-80aa-8485-000be25c6fd4
- メモDB（問題点・気になるところ）: https://www.notion.so/seameninc/32bf9a30024d80809cf4c9e7c2eafb37?v=32bf9a30024d809da404000ce754efaa
- メモDB (data_source): collection://32bf9a30-024d-8013-9db8-000b07788ffb
- Notion MCPでタスクの取得・ステータス更新を行う
- ステータス: 未着手→調査中→進行中→確認中→完了（再修正もあり）
- 「確認中」はユーザーに確認を依頼する時のステータス。自分が作業中は「進行中」

## 重要な開発ルール

1. 修正前に必ず影響範囲を全ファイル調査してから着手する
2. 関連画面・エラーメッセージ・revalidatePath等もまとめて修正（バラバラに出さない）
3. TypeScript型チェック（npx tsc --noEmit）を必ず通すこと
4. Notionのステータスを随時変更（いちいち確認は不要）
5. 調査結果や修正内容をNotionタスクページに記載
6. git pushはユーザーの明示的な指示があるまで行わない

## 名称ルール

- 1次報告 = マネージャー→クライアント（client_report_summaries テーブル）
- 2次報告 = ワーカー→マネージャー（daily_reports テーブル）
- 「サマリー」という表記はUI上で廃止済み（コメント内に残存あり）

## 主要ファイル構成

- src/app/(dashboard)/ - ページ
  - page.tsx - ホーム
  - manager/reports/ - 1次報告管理（メイン画面）
    - day-reports-modal.tsx - 統合モーダル（承認・報告生成・写真管理）
  - reports/ - 2次報告一覧・詳細・新規作成
  - client/ - クライアント確認画面
  - sites/[siteId]/ - 現場詳細
  - admin/ - 管理画面（工程マスタ、ユーザー等）
- src/components/ - UIコンポーネント
  - reports/DailyReportForm.tsx - 2次報告フォーム（1画面化済み）
  - sites/ProcessManager.tsx - 工程管理（チェックリスト付き）
  - sites/DocumentManager.tsx - ストレージUI（フォルダナビ付き）
  - storage/StorageBrowserModal.tsx - ストレージ写真選択モーダル
  - admin/ProcessTemplateManager.tsx - 工程マスタ管理
- src/lib/ - 共通ロジック
- src/app/(dashboard)/sites/actions.ts - 現場関連サーバーアクション
- supabase/ - マイグレーションSQL

---

## 現在進行中のタスク: TSK-19 ストレージ機能

### ブランチ: `feature/storage`

**重要: このブランチには暫定実装が入っているが、要件定義書と大きく乖離しているため、ほぼ作り直しが必要。**

### 要件定義書
- ファイル: `/Volumes/wataru-mm/プロジェクト/現場報告システム/storage_requirements.md`
- Google Drive/Dropbox的なワークスペースレベルのクラウドストレージ
- 現場作成・報告写真アップロードをトリガーにフォルダ自動生成

### 影響範囲分析
- ファイル: `/Users/rego/.claude/plans/joyful-doodling-sprout.md`
- 全9項目の影響範囲を詳細分析済み

### 現在の暫定実装（feature/storageブランチ）の状態

以下はmainにマージ前の暫定コード。要件定義書に合わせて作り直す必要がある:

1. **migration_v33_storage_folders.sql** — site_documentsにfolder_path/process_id/photo_type追加、RLS更新（**適用済み**）
2. **DocumentManager.tsx** — 「ドキュメント管理」→「ストレージ」に名称変更、フォルダナビ追加、書類/工程写真2モードアップロード、アップロード者タグ表示
3. **StorageBrowserModal.tsx** — 1次報告からストレージ写真を選択するモーダル
4. **sites/actions.ts** — getSiteDocumentsにprofiles JOIN（アップロード者名取得）、getUploadUrlに工程写真パス対応、createSiteDocumentにfolderPath等追加
5. **types.ts** — SiteDocumentにfolder_path/process_id/photo_type/uploader_name追加
6. **day-reports-modal.tsx** — 「ストレージから選択」ボタン追加、StorageBrowserModal連携
7. **sites/[siteId]/page.tsx** — canEditStorage（worker含む）とcanDelete（admin/managerのみ）の分離

### 作り直しで必要なこと（要件定義書ベース）

**Phase A（MVP）: ストレージ基盤 + フォルダUI**
- 新テーブル: `storage_folders`（実体フォルダ、公開設定・メタデータ対応）
- `site_documents` → `storage_files` への拡張 or 新テーブル
- フォルダCRUD + `/storage` ページ（ワークスペースルート）
- 現場作成時の自動フォルダ生成（createSiteアクション内）
- サイドバーに「ストレージ」ナビ追加

**Phase B: 報告連携 + 自動格納**
- 報告写真アップ時にストレージへ自動反映
- 工程フォルダ自動生成
- 二重管理問題の解決（report_photosとの関係）

**Phase C: 権限 + 公開設定**
- フォルダ単位の公開設定（社内のみ / 現場関係者全員）
- ロール別アクセス制御（マネージャー全権限、ワーカー担当現場のみ、クライアント/パートナー公開フォルダのみ閲覧）

**Phase D: ゴミ箱 + バージョン管理**
- soft delete + 30日自動消去
- バージョン履歴 + 復元

### 注意事項
- migration_v33はSupabaseに適用済み（folder_path, process_id, photo_typeカラムが存在する）
- 新設計では`storage_folders`テーブルが必要。バーチャルフォルダ（folder_pathカラム）では公開設定やメタデータに対応できない
- `site_documents`を`storage_files`に置き換えるか拡張するか未決定

---

## 直近の開発状況（ver 0.02）

### mainブランチ（デプロイ済み）
- **TSK-54**: 送信前プレビュー・確認機能（2次報告・1次報告・下書き）
- **TSK-57**: 現場住所タップでGoogleMapを開く
- **TSK-60**: 工程管理改善（親子一括移動・マスタUI改善）
- **TSK-61**: ドキュメント複数アップロード時に個別種別選択
- **TSK-62**: マイページのデフォルトタブを報告一覧に変更
- **カレンダー**: 月表示をJST基準に修正
- **セットアップチェック**: 契約書・現調写真を追加
- 2次報告プレビューを別画面方式に変更

### 更新履歴
- Notionの更新履歴DBにver 0.02（2026-04-01）を登録済み

## 適用済みDBマイグレーション

- v26〜v31: 既存（チェックリスト、Storage RLS、トリガー修正、RLS最適化等）
- **v32**: ドキュメント種別追加（契約書・現調写真）+ sites.has_contract/has_site_survey_photo
- **v33**: ストレージフォルダ対応（site_documents.folder_path/process_id/photo_type追加、worker INSERT権限追加、summary_photos.source_document_id追加）

## テストアカウント

- manager@seamen.co.jp / worker@seamen.co.jp / client@seamen.co.jp / partner@seamen.co.jp
- PW: wataru1219
- worker@seamen.co.jpは「現場テスト：1」に招待済み

## 重要な設計原則

### 保存ボタン確定方式
写真やデータの変更は「保存」ボタンを押すまでサーバーに反映しない。
ローカルステートで変更を管理し、フォーム全体の保存/提出時にまとめてコミットする。

## 開発フロー

- 開発・確認はローカル（localhost:3333）で行う
- 本番デプロイはユーザーの指示があるまでgit pushしない
- DBマイグレーションが必要な場合はデスクトップにSQLを書き出してユーザーにSupabase実行を依頼
