// ---------------------------------------------------------------------------
// ユーザーロール（新ロール体系）
// ---------------------------------------------------------------------------
export type UserRole =
  | 'admin'            // 管理者
  | 'manager'          // マネージャー
  | 'worker_internal'  // ワーカー
  | 'worker_external'  // パートナー
  | 'client';          // クライアント

// ---------------------------------------------------------------------------
// 承認ステータス
// ---------------------------------------------------------------------------
export type ApprovalStatus =
  | 'draft'               // 下書き
  | 'submitted'           // 提出済み（承認待ち）
  | 'approved'            // 承認済み（manager or admin）
  | 'client_confirmed'    // クライアント確認済み
  | 'rejected';           // 差戻し

// ---------------------------------------------------------------------------
// ユーザープロフィール
// ---------------------------------------------------------------------------
export interface Profile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  company_id?: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// マスターデータ
// ---------------------------------------------------------------------------
export interface Process {
  id: string;
  site_id: string;
  category: string;
  name: string;
  order_index: number;
  progress_rate: number;
  status: 'in_progress' | 'completed';
  created_at: string;
  parent_process_id?: string | null;
}

export interface Site {
  id: string;
  name: string;
  site_number: string | null;
  address: string;
  company_id?: string | null;
  client_name: string | null;
  site_color?: string | null;
  start_date: string | null;
  end_date: string | null;
  has_blueprint: boolean;
  has_specification: boolean;
  has_purchase_order: boolean;
  has_schedule: boolean;
  has_contract?: boolean;
  has_site_survey_photo?: boolean;
  is_monitor: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// ドキュメント種別
// ---------------------------------------------------------------------------
export type DocumentType =
  | 'blueprint'          // 図面
  | 'specification'      // 仕様書
  | 'purchase_order'     // 発注書
  | 'schedule'           // 工程表
  | 'contract'           // 契約書
  | 'site_survey_photo'  // 現調写真
  | 'other';             // その他

// ---------------------------------------------------------------------------
// 現場ドキュメント
// ---------------------------------------------------------------------------
export type PhotoType = 'before' | 'during' | 'after';

export interface SiteDocument {
  id: string;
  site_id: string | null;
  document_type: DocumentType;
  title: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  version: number;
  uploaded_by: string;
  created_at: string;
  folder_path: string | null;
  process_id: string | null;
  photo_type: PhotoType | null;
  uploader_name?: string | null;
  folder_id?: string | null;
}

// ---------------------------------------------------------------------------
// ストレージフォルダ
// ---------------------------------------------------------------------------
export type FolderVisibility = 'internal' | 'all';
export type FolderType = 'company' | 'site_root' | 'document' | 'process' | 'phase' | 'custom';

export interface StorageFolder {
  id: string;
  workspace_id: string | null;
  site_id: string | null;
  parent_folder_id: string | null;
  name: string;
  path: string;
  visibility: FolderVisibility;
  folder_type: FolderType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ---------------------------------------------------------------------------
// アクティビティログ
// ---------------------------------------------------------------------------
export type ActivityEntityType = 'daily_report' | 'client_report_summary' | 'site_document' | 'storage_folder';
export type ActivityAction =
  | 'created' | 'submitted' | 'approved' | 'rejected' | 'resubmitted'
  | 'revision_requested' | 'client_confirmed'
  | 'edited' | 'deleted' | 'restored'
  | 'uploaded' | 'renamed' | 'moved';

export interface ActivityLog {
  id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  site_id: string | null;
  action: ActivityAction;
  actor_id: string;
  detail: Record<string, unknown> | null;
  created_at: string;
  // UI用（JOINで取得）
  actor_name?: string;
}

// ---------------------------------------------------------------------------
// 検査フェーズ
// ---------------------------------------------------------------------------
export type InspectionPhase =
  | 'acceptance' // 受入検査
  | 'during'     // 中間検査
  | 'post';      // 完了検査

// ---------------------------------------------------------------------------
// 工程チェックリスト
// ---------------------------------------------------------------------------
export interface ProcessChecklist {
  id: string;
  process_id: string;
  item_text: string;
  is_checked: boolean;
  checked_at: string | null;
  checked_by: string | null;
  photo_id: string | null;
  note: string | null;
  inspection_phase: InspectionPhase;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 使用材料（フォーム入力用 — レガシー：報告単位）
// ---------------------------------------------------------------------------
export interface ReportMaterialInput {
  material_name: string;
  product_number: string;
  quantity: string;
  unit: string;
  supplier: string;
  note: string;
}

// ---------------------------------------------------------------------------
// 使用材料（現場単位マスター管理）
// ---------------------------------------------------------------------------
export interface SiteMaterial {
  id: string;
  site_id: string;
  material_name: string;
  product_number: string | null;
  quantity: number | null;
  unit: string | null;
  supplier: string | null;
  note: string | null;
  created_at: string;
}
