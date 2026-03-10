// ---------------------------------------------------------------------------
// ユーザーロールラベル
// ---------------------------------------------------------------------------
export const ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  orderer: "発注者（元請け）",
  worker_internal: "現場員（自社）",
  worker_external: "現場員（外注）",
};

// ---------------------------------------------------------------------------
// 承認ステータスラベル
// ---------------------------------------------------------------------------
export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  submitted: "提出済み",
  admin_approved: "管理者承認",
  orderer_confirmed: "元請け確認済み",
  rejected: "差戻し",
};

// ---------------------------------------------------------------------------
// 承認ステータスに応じた色を返す
// ---------------------------------------------------------------------------
export function getApprovalStatusColor(status: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case "admin_approved":
      return {
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        border: "border-emerald-500/20",
      };
    case "orderer_confirmed":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        border: "border-amber-500/20",
      };
    case "submitted":
      return {
        bg: "bg-blue-500/10",
        text: "text-blue-400",
        border: "border-blue-500/20",
      };
    case "rejected":
      return {
        bg: "bg-red-500/10",
        text: "text-red-400",
        border: "border-red-500/20",
      };
    case "draft":
    default:
      return {
        bg: "bg-gray-500/10",
        text: "text-gray-400",
        border: "border-gray-500/20",
      };
  }
}

// ---------------------------------------------------------------------------
// 作業工程のカテゴリ定義
// ---------------------------------------------------------------------------
export const WORK_PROCESS_CATEGORIES = {
  foundation: "基礎工事",
  framing: "躯体工事",
  exterior: "外装工事",
  interior: "内装工事",
  electrical: "電気工事",
  plumbing: "配管工事",
  finishing: "仕上げ工事",
  cleanup: "清掃・片付け",
} as const;

// Record形式のラベル（表示用）
export const WORK_PROCESS_LABELS: Record<string, string> = WORK_PROCESS_CATEGORIES;

// Select用のオプション配列
export const WORK_PROCESS_OPTIONS = Object.entries(WORK_PROCESS_CATEGORIES).map(
  ([value, label]) => ({ value, label })
);

// 進捗率に応じた色を返す
export function getProgressColor(rate: number): string {
  if (rate >= 80) return "emerald";
  if (rate >= 50) return "amber";
  return "red";
}

// 進捗率に応じたTailwindクラスを返す
export function getProgressColorClasses(rate: number): { bg: string; text: string } {
  if (rate >= 80) return { bg: "bg-emerald-500", text: "text-emerald-400" };
  if (rate >= 50) return { bg: "bg-amber-500", text: "text-amber-400" };
  return { bg: "bg-red-500", text: "text-red-400" };
}

// 写真タイプのラベル
export const PHOTO_TYPE_LABELS: Record<string, string> = {
  before: "施工前",
  during: "施工中",
  after: "施工後",
  corner_ne: "四隅（北東）",
  corner_nw: "四隅（北西）",
  corner_se: "四隅（南東）",
  corner_sw: "四隅（南西）",
};

// 写真タイプのSelect用オプション（アップロード時に使用）
export const PHOTO_TYPE_OPTIONS = [
  { value: "before", label: "施工前" },
  { value: "during", label: "施工中" },
  { value: "after", label: "施工後" },
];

// ---------------------------------------------------------------------------
// ドキュメント種別ラベル
// ---------------------------------------------------------------------------
export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  blueprint: "図面",
  specification: "仕様書",
  purchase_order: "発注書",
  schedule: "工程表",
  other: "その他",
};

export const DOCUMENT_TYPE_OPTIONS = [
  { value: "blueprint", label: "図面" },
  { value: "specification", label: "仕様書" },
  { value: "purchase_order", label: "発注書" },
  { value: "schedule", label: "工程表" },
  { value: "other", label: "その他" },
];

// ---------------------------------------------------------------------------
// セットアップチェック項目
// ---------------------------------------------------------------------------
export const SETUP_CHECK_ITEMS = [
  { key: "has_blueprint", label: "図面", icon: "FileSpreadsheet" },
  { key: "has_specification", label: "仕様書", icon: "FileText" },
  { key: "has_purchase_order", label: "発注書", icon: "FileCheck" },
  { key: "has_schedule", label: "工程表", icon: "CalendarRange" },
  { key: "is_monitor", label: "モニター施工", icon: "Monitor" },
] as const;

// ---------------------------------------------------------------------------
// 検査フェーズラベル
// ---------------------------------------------------------------------------
export const INSPECTION_PHASE_LABELS: Record<string, string> = {
  acceptance: "受入検査",
  during: "中間検査",
  post: "完了検査",
};

export const INSPECTION_PHASE_OPTIONS = [
  { value: "acceptance", label: "受入検査" },
  { value: "during", label: "中間検査" },
  { value: "post", label: "完了検査" },
];
