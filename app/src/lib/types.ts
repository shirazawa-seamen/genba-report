// ---------------------------------------------------------------------------
// ユーザーロール（新ロール体系）
// ---------------------------------------------------------------------------
export type UserRole =
  | 'worker_internal'  // 社内作業員
  | 'worker_external'  // 協力会社作業員
  | 'admin'            // 管理者
  | 'orderer';         // 発注者

// ---------------------------------------------------------------------------
// 承認ステータス
// ---------------------------------------------------------------------------
export type ApprovalStatus =
  | 'draft'               // 下書き
  | 'submitted'           // 提出済み（承認待ち）
  | 'admin_approved'      // 管理者承認済み
  | 'orderer_confirmed'   // 元請け確認済み
  | 'rejected';           // 差戻し

// ---------------------------------------------------------------------------
// ユーザープロフィール
// ---------------------------------------------------------------------------
export interface Profile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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
  progress_rate: number;
  status: 'in_progress' | 'completed';
  created_at: string;
}

export interface Site {
  id: string;
  name: string;
  address: string;
  start_date: string | null;
  end_date: string | null;
  has_blueprint: boolean;
  has_specification: boolean;
  has_purchase_order: boolean;
  has_schedule: boolean;
  is_monitor: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// ドキュメント種別
// ---------------------------------------------------------------------------
export type DocumentType =
  | 'blueprint'      // 図面
  | 'specification'  // 仕様書
  | 'purchase_order' // 発注書
  | 'schedule'       // 工程表
  | 'other';         // その他

// ---------------------------------------------------------------------------
// 現場ドキュメント
// ---------------------------------------------------------------------------
export interface SiteDocument {
  id: string;
  site_id: string;
  document_type: DocumentType;
  title: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  version: number;
  uploaded_by: string;
  created_at: string;
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
