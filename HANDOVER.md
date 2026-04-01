# 現場報告システム - 引き継ぎプロンプト

更新日: 2026-04-01

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
  - sites/DocumentManager.tsx - ドキュメント管理
  - admin/ProcessTemplateManager.tsx - 工程マスタ管理
- src/lib/ - 共通ロジック
- src/app/(dashboard)/sites/actions.ts - 現場関連サーバーアクション
- supabase/ - マイグレーションSQL

## 直近の開発状況（ver 0.01〜）

### 既存機能
- 1次/2次報告の名称統一、全UI反映済み
- 1次報告ページに統合モーダル（承認・1次報告生成・テキスト編集・写真管理・提出を1画面で完結）
- 工程の親子階層表示 + チェックリスト（孫工程）機能
- 報告フォームにチェックリスト方式の進捗入力 + 工程別写真添付
- 画像自動圧縮（最大1920px、JPEG品質80%）
- 写真アップロード失敗時は報告を自動削除してロールバック
- 承認時にprocesses.progress_rateを更新（翌日の報告に引き継ぎ）
- 1次報告でマネージャーが進捗率・天気・時間を編集可能
- クライアント確認ページ・印刷ページに天気・時間・作業者を表示
- 検索・サイトフィルター機能
- ローディング画面を中央スピナーに統一

### 前回セッションで完了した修正
- **TSK-49**: RLSポリシー無限再帰エラー(42P17) → `get_user_role()` SECURITY DEFINER関数で解決
- **TSK-36**: 2次報告の進捗率・写真入力制限（親工程のみ選択不可）
- **TSK-52**: 画像添付上限を20→50枚に変更
- **TSK-51**: 1次報告モーダルで2次報告写真の統合表示

### 今回のセッション（2026-04-01）で完了した修正
- **TSK-54**: 送信前プレビュー・確認機能
  - 2次報告送信前に入力内容のプレビュー確認画面を表示
  - 1次報告のクライアント提出前に確認ダイアログ表示
  - 下書き提出前に確認ダイアログ表示
- **TSK-57**: 現場住所タップでGoogleMapを開くリンクに変更
- **TSK-60**: 工程管理改善
  - 親工程の並び替え時に子工程・孫工程も一緒に移動
  - 工程マスタの子工程追加時にフォームへ自動フォーカス
- **TSK-61**: ドキュメント複数アップロード時に各ファイルごとに種別を選択可能に
- **TSK-62**: マイページのデフォルトタブを報告一覧に変更
- **カレンダー**: 月表示をJST基準に修正（UTC→JST）
- **セットアップチェック**: 「契約書」「現調写真」を追加

### 前回セッション（2026-03-31）で完了した修正
- **TSK-50**: 2次報告の下書き保存機能
- **TSK-31**: 報告編集時の画像追加削除・リネーム
- **TSK-48**: 職人さんマイページ
- **TSK-39/40**: 工程管理（カスタム工程追加 + 一括保存UX）
- **TSK-37/38/45**: ドキュメント管理改善（種別追加 + 複数一括アップロード）
- **写真管理UX修正**: 編集ページ・1次報告モーダルの写真操作をローカルステート方式に変更（保存ボタンで確定）

### それ以前のセッションで完了した修正
- **TSK-47（一部）**: 写真プレビュー・ドキュメントプレビュー修正
- **TSK-49**: RLSポリシー無限再帰エラー修正
- **TSK-36**: 2次報告の進捗率・写真入力制限（親工程のみ選択不可）
- **TSK-52**: 画像添付上限を20→50枚に変更
- **TSK-51**: 1次報告モーダルで2次報告写真の統合表示

## 適用済みDBマイグレーション

- v26: チェックリストテーブル（process_checklist_items, process_checklist_templates）
- v28: Storage RLSポリシー（report-photos, site-documents バケット）
- v29: トリガーバグ修正 + report_photos.process_id追加
- v30: client_report_summariesに天気・時間カラム追加
- v31: RLSパフォーマンス最適化 + get_user_role()関数（修正版適用済み）

## 未適用DBマイグレーション（要Supabase実行）

- **v32**: ドキュメント種別追加（契約書・現調写真） + sitesテーブルにhas_contract/has_site_survey_photoカラム追加
  - ファイル: `app/supabase/migration_v32_document_types.sql`

## 動作確認チェックリスト（本番: https://genba-report.vercel.app）

### テストアカウント
- manager@seamen.co.jp / manager2@seamen.co.jp
- worker@seamen.co.jp / worker2@seamen.co.jp
- client@seamen.jp / client2@seamen.jp
- partner@seamen.co.jp / partner2@seamen.co.jp
- PW: wataru1219

### manager でログイン
- [ ] カレンダー: 4月が表示されるか（3月ではなく）
- [ ] 1次報告: 提出ボタン → 確認ダイアログが出るか
- [ ] 1次報告: 写真追加 → キャンセルしても写真が残らないか
- [ ] 現場詳細: 住所タップ → GoogleMapが開くか
- [ ] 現場詳細 > 工程管理: 「追加する」→「カスタム工程」タブが表示されるか
- [ ] 現場詳細 > 工程管理: 複数キューに追加 → 一括保存が動くか
- [ ] 現場詳細 > 工程管理: 親工程のドラッグ → 子工程も一緒に動くか
- [ ] 現場詳細 > ドキュメント: 複数ファイルアップロード → 個別に種別選択できるか
- [ ] 現場詳細 > セットアップチェック: 「契約書」「現調写真」が表示されるか（v32マイグレーション適用後）

### worker でログイン
- [ ] 新規報告: 送信ボタン → プレビュー確認画面が出るか
- [ ] 新規報告: 「下書き保存」ボタンが表示されるか
- [ ] 報告一覧: 「下書き」タブが表示されるか
- [ ] マイページ: ナビに「マイページ」が表示され、デフォルトが報告一覧タブか
- [ ] 報告詳細（下書き）: 「提出する」→ 確認ダイアログが出るか
- [ ] 報告編集: 写真の追加・削除 → 保存ボタンを押すまで確定しないか

### client でログイン
- [ ] 確認ページが正常に表示されるか

## 残りの未着手タスク

Notionタスクボードを参照: https://www.notion.so/seameninc/32bf9a30024d80b2af11c84917d9cbe2?v=32bf9a30024d813bb008000c6a0a244f

主要な未着手:
- TSK-19: ストレージ機能（フォルダ分け・名称変更） - 大規模
- TSK-20: PDF出力
- TSK-17: グループチャット

## 重要な設計原則

### 保存ボタン確定方式
写真やデータの変更は「保存」ボタンを押すまでサーバーに反映しない。
ローカルステートで変更を管理し、フォーム全体の保存/提出時にまとめてコミットする。
（詳細: memory/feedback_save_on_submit.md）

## TSK-47 残課題

- スマホで写真プレビューが拡大されすぎる問題 → 実機テストで確認が必要
- 報告フォーム（DailyReportForm.tsx）のプレビューは未対応（ローカルファイル表示のため別対応が必要）

## TSK-49 残課題

42P17（無限再帰）は解決済み。workerアカウントでのINSERTエラーは要再テスト。

## 開発フロー

- 開発・確認はローカル（localhost:3333）で行う
- 本番デプロイはユーザーの指示があるまでgit pushしない
- DBマイグレーションが必要な場合はデスクトップにSQLを書き出してユーザーにSupabase実行を依頼
