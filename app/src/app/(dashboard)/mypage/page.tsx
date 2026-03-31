import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireUserContext } from "@/lib/auth/getCurrentUserContext";
import { PHOTO_TYPE_LABELS, APPROVAL_STATUS_LABELS } from "@/lib/constants";
import { MyPageContent } from "./mypage-content";

export default async function MyPage() {
  const supabase = await createClient();
  const { user, role: userRole } = await requireUserContext();

  // 全ロールがアクセス可能だが、主にワーカー向け
  // クライアントはリダイレクト
  if (userRole === "client") redirect("/client");

  // ユーザー名を取得
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();
  const displayName = profile?.full_name || user.email?.split("@")[0] || "ユーザー";

  // 自分の報告一覧（最新50件）
  const { data: reports } = await supabase
    .from("daily_reports")
    .select(
      "id, report_date, work_process, work_content, progress_rate, approval_status, created_at, site_id, process_id, sites(name), processes(name)"
    )
    .eq("reporter_id", user.id)
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  // 報告をグループ化（同日・同現場）
  type ReportRow = NonNullable<typeof reports>[number];
  const groupKey = (r: ReportRow) => `${r.site_id}_${r.report_date}`;
  const grouped = new Map<string, ReportRow[]>();
  for (const r of reports ?? []) {
    const key = groupKey(r);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  const reportItems = Array.from(grouped.values()).map((siblings) => {
    const first = siblings[0];
    const siteName = ((Array.isArray(first.sites) ? first.sites[0] : first.sites) as { name: string } | null)?.name ?? "不明な現場";
    const processNames = siblings
      .map((r) => ((Array.isArray(r.processes) ? r.processes[0] : r.processes) as { name: string } | null)?.name ?? r.work_process)
      .filter(Boolean);
    const status = first.approval_status ?? "draft";

    return {
      id: first.id,
      siteName,
      processNames: processNames.join("、"),
      reportDate: first.report_date,
      status,
      statusLabel: APPROVAL_STATUS_LABELS[status] ?? status,
      progressRate: Math.round(
        siblings.reduce((sum, r) => sum + (r.progress_rate ?? 0), 0) / siblings.length
      ),
    };
  });

  // 自分の報告の写真（最新100枚）
  const reportIds = (reports ?? []).map((r) => r.id);
  let photoItems: Array<{
    id: string;
    url: string;
    photoType: string;
    photoTypeLabel: string;
    caption: string | null;
    mediaType: string;
    reportDate: string;
    siteName: string;
    reportId: string;
  }> = [];

  if (reportIds.length > 0) {
    const { data: photos } = await supabase
      .from("report_photos")
      .select("id, storage_path, photo_type, caption, media_type, report_id")
      .in("report_id", reportIds)
      .order("created_at", { ascending: false })
      .limit(100);

    // 報告IDから現場名・日付をマッピング
    const reportMap = new Map(
      (reports ?? []).map((r) => [
        r.id,
        {
          reportDate: r.report_date,
          siteName: ((Array.isArray(r.sites) ? r.sites[0] : r.sites) as { name: string } | null)?.name ?? "不明",
        },
      ])
    );

    photoItems = await Promise.all(
      (photos ?? []).map(async (p) => {
        const { data } = await supabase.storage
          .from("report-photos")
          .createSignedUrl(p.storage_path, 3600);
        const reportInfo = reportMap.get(p.report_id);
        return {
          id: p.id,
          url: data?.signedUrl ?? "",
          photoType: p.photo_type ?? "during",
          photoTypeLabel: PHOTO_TYPE_LABELS[p.photo_type ?? ""] ?? "写真",
          caption: p.caption,
          mediaType: p.media_type ?? "photo",
          reportDate: reportInfo?.reportDate ?? "",
          siteName: reportInfo?.siteName ?? "不明",
          reportId: p.report_id,
        };
      })
    );
  }

  // 統計
  const totalReports = reportItems.length;
  const totalPhotos = photoItems.length;
  const draftCount = reportItems.filter((r) => r.status === "draft").length;

  return (
    <MyPageContent
      displayName={displayName}
      totalReports={totalReports}
      totalPhotos={totalPhotos}
      draftCount={draftCount}
      reports={reportItems}
      photos={photoItems}
    />
  );
}
