import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  TrendingUp,
  HardHat,
  Plus,
  ClipboardList,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
interface DailyReportWithSite {
  id: string;
  report_date: string;
  work_process: string;
  progress_rate: number;
  work_content: string;
  created_at: string;
  sites: {
    name: string;
  } | null;
}

interface DailyReport {
  id: string;
  site_name: string;
  report_date: string;
  work_process: string;
  progress_rate: number;
  work_description: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 作業工程ラベルマッピング
// ---------------------------------------------------------------------------
const WORK_PROCESS_LABELS: Record<string, string> = {
  foundation: "基礎工事",
  framing: "躯体工事",
  exterior: "外装工事",
  interior: "内装工事",
  electrical: "電気工事",
  plumbing: "配管工事",
  finishing: "仕上げ工事",
  cleanup: "清掃・片付け",
};

// ---------------------------------------------------------------------------
// 進捗率に応じたカラー
// ---------------------------------------------------------------------------
function getProgressColor(rate: number): string {
  if (rate >= 80) return "from-emerald-600 to-emerald-400";
  if (rate >= 50) return "from-amber-600 to-amber-400";
  return "from-red-600 to-red-400";
}

function getProgressTextColor(rate: number): string {
  if (rate >= 80) return "text-emerald-400";
  if (rate >= 50) return "text-amber-400";
  return "text-red-400";
}

// ---------------------------------------------------------------------------
// 日付フォーマット
// ---------------------------------------------------------------------------
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

// ---------------------------------------------------------------------------
// 報告カードコンポーネント
// ---------------------------------------------------------------------------
function ReportCard({ report }: { report: DailyReport }) {
  const progressRate = report.progress_rate ?? 0;
  const workProcessLabel =
    WORK_PROCESS_LABELS[report.work_process] ?? report.work_process;

  return (
    <Link href={`/reports/${report.id}`} className="group block">
      <div className="relative rounded-2xl border border-gray-800/80 bg-gray-900/80 p-5 shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-200 hover:border-amber-500/40 hover:bg-gray-900 hover:shadow-amber-500/5 hover:shadow-xl active:scale-[0.99]">
        {/* ヘッダー行 */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Building2 size={18} className="text-amber-400" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-100 truncate group-hover:text-amber-100 transition-colors">
                {report.site_name}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <CalendarDays size={12} className="text-gray-500 flex-shrink-0" aria-hidden="true" />
                <span className="text-xs text-gray-500">{formatDate(report.report_date)}</span>
              </div>
            </div>
          </div>
          <ChevronRight
            size={18}
            className="flex-shrink-0 text-gray-600 group-hover:text-amber-500 transition-colors mt-1"
            aria-hidden="true"
          />
        </div>

        {/* 作業工程バッジ */}
        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-300">
            <HardHat size={12} className="text-gray-400" aria-hidden="true" />
            {workProcessLabel}
          </span>
        </div>

        {/* 進捗率 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
              <TrendingUp size={12} aria-hidden="true" />
              進捗率
            </span>
            <span className={`text-sm font-bold ${getProgressTextColor(progressRate)}`}>
              {progressRate}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${getProgressColor(progressRate)} transition-all duration-500`}
              style={{ width: `${progressRate}%` }}
              role="progressbar"
              aria-valuenow={progressRate}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* 作業内容プレビュー */}
        {report.work_description && (
          <p className="mt-4 text-xs text-gray-500 leading-relaxed line-clamp-2 border-t border-gray-800 pt-4">
            {report.work_description}
          </p>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// 空状態コンポーネント
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gray-800/80 border border-gray-700/50">
        <ClipboardList size={40} className="text-gray-600" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-300">報告がまだありません</h3>
        <p className="mt-2 text-sm text-gray-500 max-w-xs leading-relaxed">
          「新規報告」ボタンから最初の現場報告を作成してください
        </p>
      </div>
      <Link
        href="/reports/new"
        className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-gray-900 shadow-lg shadow-amber-500/30 transition-all duration-200 hover:bg-amber-400 hover:shadow-amber-500/40 active:scale-95"
      >
        <Plus size={18} aria-hidden="true" />
        最初の報告を作成
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// メインページ（Server Component）
// ---------------------------------------------------------------------------
export default async function ReportsPage() {
  const supabase = await createClient();

  const { data: reports, error } = await supabase
    .from("daily_reports")
    .select(
      `
      id,
      report_date,
      work_process,
      progress_rate,
      work_content,
      created_at,
      sites (
        name
      )
      `
    )
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false });

  // データを正規化
  const reportList: DailyReport[] = (reports as DailyReportWithSite[] | null)?.map((r) => ({
    id: r.id,
    site_name: r.sites?.name ?? "不明な現場",
    report_date: r.report_date,
    work_process: r.work_process,
    progress_rate: r.progress_rate,
    work_description: r.work_content,
    created_at: r.created_at,
  })) ?? [];

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        {/* ページヘッダー */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 shadow-lg shadow-amber-500/30">
              <HardHat size={24} className="text-gray-900" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-100 tracking-tight">
                報告一覧
              </h1>
              <p className="text-sm text-gray-500">
                {reportList.length > 0
                  ? `${reportList.length} 件の報告`
                  : "現場作業報告システム"}
              </p>
            </div>
          </div>

          {/* 新規報告ボタン */}
          <Link
            href="/reports/new"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-gray-900 shadow-lg shadow-amber-500/30 transition-all duration-200 hover:bg-amber-400 hover:shadow-amber-500/40 active:scale-95 flex-shrink-0"
          >
            <Plus size={18} aria-hidden="true" />
            <span className="hidden sm:inline">新規報告</span>
            <span className="sm:hidden">新規</span>
          </Link>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm text-red-400 font-semibold">
              データの取得に失敗しました。再読み込みしてください。
            </p>
          </div>
        )}

        {/* 報告一覧 or 空状態 */}
        {reportList.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-4">
            {reportList.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}

        {/* フッター */}
        <p className="mt-10 text-center text-xs text-gray-700">
          現場報告システム v1.0
        </p>
      </div>
    </div>
  );
}
