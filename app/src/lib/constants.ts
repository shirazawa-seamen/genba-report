// ---------------------------------------------------------------------------
// ユーザーロールラベル
// ---------------------------------------------------------------------------
export const ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  manager: "マネージャー",
  worker_internal: "ワーカー",
  worker_external: "パートナー",
  client: "クライアント",
};

// ---------------------------------------------------------------------------
// 承認ステータスラベル
// ---------------------------------------------------------------------------
export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  submitted: "提出済み",
  approved: "承認済み",
  client_confirmed: "クライアント確認済み",
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
    case "approved":
      return {
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        border: "border-emerald-500/20",
      };
    case "client_confirmed":
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

export interface ProcessTemplateItem {
  phaseKey: "A" | "B" | "C" | "D";
  processCode: string;
  category: string;
  name: string;
  parallelGroup: number | null;
  sortOrder: number;
  parentTemplateId: string | null;
}

export const DEFAULT_PROCESS_TEMPLATES: ProcessTemplateItem[] = [
  { phaseKey: "A", processCode: "A-1", category: "foundation", name: "地盤調査", parallelGroup: null, sortOrder: 1, parentTemplateId: null },
  { phaseKey: "A", processCode: "A-2", category: "foundation", name: "地盤改良", parallelGroup: null, sortOrder: 2, parentTemplateId: null },
  { phaseKey: "A", processCode: "A-3-1", category: "electrical", name: "仮設電気", parallelGroup: 1, sortOrder: 3, parentTemplateId: null },
  { phaseKey: "A", processCode: "A-3-2", category: "plumbing", name: "仮設水道", parallelGroup: 1, sortOrder: 4, parentTemplateId: null },
  { phaseKey: "A", processCode: "A-4", category: "foundation", name: "基礎工事", parallelGroup: null, sortOrder: 5, parentTemplateId: null },
  { phaseKey: "A", processCode: "A-5", category: "foundation", name: "防蟻処理", parallelGroup: null, sortOrder: 6, parentTemplateId: null },
  { phaseKey: "A", processCode: "A-6", category: "framing", name: "土台敷き", parallelGroup: null, sortOrder: 7, parentTemplateId: null },
  { phaseKey: "A", processCode: "A-7", category: "plumbing", name: "先行配管（給排水）", parallelGroup: null, sortOrder: 8, parentTemplateId: null },
  { phaseKey: "A", processCode: "A-8", category: "framing", name: "仮設足場", parallelGroup: null, sortOrder: 9, parentTemplateId: null },
  { phaseKey: "A", processCode: "A-9", category: "framing", name: "建て方・上棟", parallelGroup: null, sortOrder: 10, parentTemplateId: null },
  { phaseKey: "A", processCode: "A-10", category: "framing", name: "屋根下地（ルーフィング）", parallelGroup: null, sortOrder: 11, parentTemplateId: null },
  { phaseKey: "B", processCode: "B-1-1", category: "exterior", name: "屋根仕上げ", parallelGroup: 2, sortOrder: 12, parentTemplateId: null },
  { phaseKey: "B", processCode: "B-1-2", category: "exterior", name: "サッシ取り付け", parallelGroup: 2, sortOrder: 13, parentTemplateId: null },
  { phaseKey: "B", processCode: "B-2", category: "exterior", name: "透湿防水シート", parallelGroup: null, sortOrder: 14, parentTemplateId: null },
  { phaseKey: "B", processCode: "B-3", category: "exterior", name: "バルコニー防水", parallelGroup: null, sortOrder: 15, parentTemplateId: null },
  { phaseKey: "B", processCode: "B-4-1", category: "exterior", name: "外壁施工", parallelGroup: 3, sortOrder: 16, parentTemplateId: null },
  { phaseKey: "B", processCode: "B-4-2", category: "electrical", name: "電気 外回り", parallelGroup: 3, sortOrder: 17, parentTemplateId: null },
  { phaseKey: "B", processCode: "B-5", category: "exterior", name: "コーキング", parallelGroup: null, sortOrder: 18, parentTemplateId: null },
  { phaseKey: "B", processCode: "B-6", category: "exterior", name: "塗装", parallelGroup: null, sortOrder: 19, parentTemplateId: null },
  { phaseKey: "B", processCode: "B-7", category: "exterior", name: "雨トイ", parallelGroup: null, sortOrder: 20, parentTemplateId: null },
  { phaseKey: "B", processCode: "B-8", category: "exterior", name: "外部周りチェック", parallelGroup: null, sortOrder: 21, parentTemplateId: null },
  { phaseKey: "B", processCode: "B-9", category: "exterior", name: "足場バラシ", parallelGroup: null, sortOrder: 22, parentTemplateId: null },
  { phaseKey: "B", processCode: "B-10", category: "exterior", name: "外構", parallelGroup: null, sortOrder: 23, parentTemplateId: null },
  { phaseKey: "C", processCode: "C-1", category: "interior", name: "断熱材施工", parallelGroup: null, sortOrder: 24, parentTemplateId: null },
  { phaseKey: "C", processCode: "C-2-1", category: "electrical", name: "電気配線", parallelGroup: 4, sortOrder: 25, parentTemplateId: null },
  { phaseKey: "C", processCode: "C-2-2", category: "plumbing", name: "水道配管", parallelGroup: 4, sortOrder: 26, parentTemplateId: null },
  { phaseKey: "C", processCode: "C-2-3", category: "plumbing", name: "ガス配管", parallelGroup: 4, sortOrder: 27, parentTemplateId: null },
  { phaseKey: "C", processCode: "C-3", category: "interior", name: "ユニットバス搬入・設置", parallelGroup: null, sortOrder: 28, parentTemplateId: null },
  { phaseKey: "C", processCode: "C-4", category: "interior", name: "天井ボード", parallelGroup: null, sortOrder: 29, parentTemplateId: null },
  { phaseKey: "C", processCode: "C-5", category: "interior", name: "壁ボード", parallelGroup: null, sortOrder: 30, parentTemplateId: null },
  { phaseKey: "C", processCode: "C-6", category: "interior", name: "床下地・フローリング", parallelGroup: null, sortOrder: 31, parentTemplateId: null },
  { phaseKey: "C", processCode: "C-7", category: "interior", name: "内装・クロス", parallelGroup: null, sortOrder: 32, parentTemplateId: null },
  { phaseKey: "C", processCode: "C-8-1", category: "interior", name: "キッチン設置", parallelGroup: 5, sortOrder: 33, parentTemplateId: null },
  { phaseKey: "C", processCode: "C-8-2", category: "interior", name: "トイレ設置", parallelGroup: 5, sortOrder: 34, parentTemplateId: null },
  { phaseKey: "C", processCode: "C-8-3", category: "interior", name: "洗面台設置", parallelGroup: 5, sortOrder: 35, parentTemplateId: null },
  { phaseKey: "C", processCode: "C-9", category: "finishing", name: "建具取り付け", parallelGroup: null, sortOrder: 36, parentTemplateId: null },
  { phaseKey: "C", processCode: "C-10", category: "finishing", name: "巾木・廻り縁", parallelGroup: null, sortOrder: 37, parentTemplateId: null },
  { phaseKey: "C", processCode: "C-11", category: "electrical", name: "電気器具取り付け", parallelGroup: null, sortOrder: 38, parentTemplateId: null },
  { phaseKey: "C", processCode: "C-12", category: "cleanup", name: "ハウスクリーニング", parallelGroup: null, sortOrder: 39, parentTemplateId: null },
  { phaseKey: "D", processCode: "D-1", category: "finishing", name: "完了検査", parallelGroup: null, sortOrder: 40, parentTemplateId: null },
  { phaseKey: "D", processCode: "D-2", category: "finishing", name: "引き渡し", parallelGroup: null, sortOrder: 41, parentTemplateId: null },
];

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
  contract: "契約書",
  site_survey_photo: "現調写真",
  other: "その他",
};

export const DOCUMENT_TYPE_OPTIONS = [
  { value: "blueprint", label: "図面" },
  { value: "specification", label: "仕様書" },
  { value: "purchase_order", label: "発注書" },
  { value: "schedule", label: "工程表" },
  { value: "contract", label: "契約書" },
  { value: "site_survey_photo", label: "現調写真" },
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
  { key: "has_contract", label: "契約書", icon: "FileCheck" },
  { key: "has_site_survey_photo", label: "現調写真", icon: "Camera" },
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
