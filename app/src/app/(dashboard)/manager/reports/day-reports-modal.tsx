"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  ExternalLink,
  Users,
  Sparkles,
  Send,
  MessageSquare,
  Edit3,
  Camera,
  Trash2,
  ImagePlus,
  Video,
} from "lucide-react";
import { approveReport, rejectReport, getReportPhotosForIds } from "@/app/(dashboard)/reports/[id]/actions";
import {
  generateClientReportSummary,
  regenerateSummaryWithPrompt,
  saveClientReportSummaryDraft,
  submitClientReportSummary,
  getSummaryPhotos,
  uploadSummaryPhoto,
  deleteSummaryPhoto,
} from "@/app/(dashboard)/sites/[siteId]/reports/actions";
import { PHOTO_TYPE_LABELS } from "@/lib/constants";
import {
  getProcessChecklist,
  toggleChecklistItem,
} from "@/app/(dashboard)/sites/actions";
import type { ProcessChecklistItem } from "@/app/(dashboard)/sites/actions";
import type { SiteReportDay } from "./page";

const APPROVAL_STATUS_CONFIG: Record<string, { label: string; badge: string; Icon: React.ElementType }> = {
  submitted: { label: "承認待ち", badge: "bg-blue-50 text-blue-500", Icon: Clock },
  approved: { label: "承認済み", badge: "bg-emerald-50 text-emerald-500", Icon: CheckCircle2 },
  rejected: { label: "差戻し", badge: "bg-red-50 text-red-500", Icon: XCircle },
};

const SUMMARY_STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  ungenerated: { label: "未作成", badge: "bg-gray-100 text-gray-500" },
  draft: { label: "下書き", badge: "bg-amber-100 text-amber-600" },
  submitted: { label: "提出済み", badge: "bg-emerald-100 text-emerald-600" },
  client_confirmed: { label: "確認済み", badge: "bg-blue-100 text-blue-600" },
  revision_requested: { label: "修正依頼", badge: "bg-red-100 text-red-500" },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

interface ReporterGroup {
  reporterName: string;
  workContent: string;
  issues: string | null;
  arrivalTime: string | null;
  departureTime: string | null;
  createdAt: string;
  reports: SiteReportDay["reports"];
  submittedIds: string[];
}

function groupByReporter(reports: SiteReportDay["reports"]): ReporterGroup[] {
  const map = new Map<string, ReporterGroup>();
  for (const r of reports) {
    const key = r.reporterName;
    if (!map.has(key)) {
      map.set(key, { reporterName: r.reporterName, workContent: r.workContent, issues: r.issues, arrivalTime: r.arrivalTime, departureTime: r.departureTime, createdAt: r.createdAt, reports: [], submittedIds: [] });
    }
    const group = map.get(key)!;
    group.reports.push(r);
    if (r.approvalStatus === "submitted") group.submittedIds.push(r.id);
  }
  return Array.from(map.values());
}

export function DayReportsModal({ day, onClose }: { day: SiteReportDay; onClose: () => void }) {
  const router = useRouter();
  const [rejectingGroup, setRejectingGroup] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 1次報告状態
  const [summaryId, setSummaryId] = useState<string | null>(day.summary?.id ?? null);
  const [summaryText, setSummaryText] = useState(day.summary?.summaryText ?? "");
  const [summaryStatus, setSummaryStatus] = useState(day.summary?.status ?? "ungenerated");
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [showRegenPrompt, setShowRegenPrompt] = useState(false);
  const [regenPrompt, setRegenPrompt] = useState("");

  // 1次報告写真状態
  const [photos, setPhotos] = useState<Array<{ id: string; url: string; caption: string | null; mediaType: string; isFromReport: boolean }>>([]);
  const [photosLoaded, setPhotosLoaded] = useState(false);

  // チェックリスト状態（工程別）
  const [checklistCache, setChecklistCache] = useState<Record<string, ProcessChecklistItem[]>>({});
  const [checklistLoaded, setChecklistLoaded] = useState(false);

  // 2次報告写真状態
  type ReportPhoto = { id: string; reportId: string; url: string; caption: string | null; mediaType: string; photoType: string | null };
  const [reportPhotos, setReportPhotos] = useState<ReportPhoto[]>([]);
  const [reportPhotosLoaded, setReportPhotosLoaded] = useState(false);

  useEffect(() => {
    setSummaryId(day.summary?.id ?? null);
    setSummaryText(day.summary?.summaryText ?? "");
    setSummaryStatus(day.summary?.status ?? "ungenerated");
    setPhotosLoaded(false);
    setReportPhotosLoaded(false);
  }, [day]);

  // チェックリストを読み込み（全工程）
  useEffect(() => {
    if (checklistLoaded) return;
    const processIds = [...new Set(day.reports.map((r) => r.processId).filter(Boolean))] as string[];
    if (processIds.length === 0) { setChecklistLoaded(true); return; }
    Promise.all(processIds.map(async (pid) => {
      const result = await getProcessChecklist(pid);
      return { pid, items: result.success && result.items ? result.items : [] };
    })).then((results) => {
      const cache: Record<string, ProcessChecklistItem[]> = {};
      for (const r of results) { if (r.items.length > 0) cache[r.pid] = r.items; }
      setChecklistCache(cache);
      setChecklistLoaded(true);
    });
  }, [checklistLoaded, day.reports]);

  const handleChecklistToggle = (item: ProcessChecklistItem, processId: string) => {
    const newCompleted = !item.isCompleted;
    setChecklistCache((prev) => ({
      ...prev,
      [processId]: (prev[processId] ?? []).map((ci) => ci.id === item.id ? { ...ci, isCompleted: newCompleted } : ci),
    }));
    startTransition(async () => {
      const result = await toggleChecklistItem(item.id, newCompleted);
      if (!result.success) {
        setChecklistCache((prev) => ({
          ...prev,
          [processId]: (prev[processId] ?? []).map((ci) => ci.id === item.id ? { ...ci, isCompleted: !newCompleted } : ci),
        }));
        setMessage("チェック更新に失敗しました");
      }
    });
  };

  // 2次報告の写真を読み込み
  useEffect(() => {
    if (reportPhotosLoaded) return;
    const allReportIds = day.reports.map((r) => r.id);
    if (allReportIds.length === 0) { setReportPhotosLoaded(true); return; }
    getReportPhotosForIds(allReportIds).then((data) => {
      setReportPhotos(data);
      setReportPhotosLoaded(true);
    });
  }, [day.reports, reportPhotosLoaded]);

  // 写真の読み込み
  useEffect(() => {
    if (!summaryId || photosLoaded) return;
    getSummaryPhotos(summaryId).then((data) => {
      setPhotos(data);
      setPhotosLoaded(true);
    });
  }, [summaryId, photosLoaded]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !summaryId) return;
    const file = e.target.files[0];
    if (!file) return;
    setMessage(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("summaryId", summaryId);
      formData.append("siteId", day.siteId);
      formData.append("caption", "");
      const result = await uploadSummaryPhoto(formData);
      if (!result.success) {
        setMessage(result.error || "写真アップロードに失敗しました");
        return;
      }
      setPhotosLoaded(false); // 再読み込み
      setMessage("写真を追加しました");
    });
    e.target.value = "";
  };

  const handlePhotoDelete = (photoId: string) => {
    if (!day.siteId) return;
    setMessage(null);
    startTransition(async () => {
      const result = await deleteSummaryPhoto(photoId, day.siteId);
      if (!result.success) {
        setMessage(result.error || "写真削除に失敗しました");
        return;
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setMessage("写真を削除しました");
    });
  };

  const groups = groupByReporter(day.reports);

  // ── 承認 ──
  const handleBatchApprove = (ids: string[]) => {
    setMessage(null);
    startTransition(async () => {
      let ok = 0; let err: string | null = null;
      for (const id of ids) { const r = await approveReport(id); r.success ? ok++ : (err = r.error ?? "失敗"); }
      setMessage(err ? `${ok}件承認、エラー: ${err}` : `${ok}件すべて承認しました`);
    });
  };

  const handleBatchReject = (ids: string[]) => {
    if (!rejectReason.trim()) return;
    setMessage(null);
    startTransition(async () => {
      let ok = 0; let err: string | null = null;
      for (const id of ids) { const r = await rejectReport(id, rejectReason.trim()); r.success ? ok++ : (err = r.error ?? "失敗"); }
      setMessage(err ? `${ok}件差戻し、エラー: ${err}` : `${ok}件すべて差し戻しました`);
      setRejectingGroup(null); setRejectReason("");
    });
  };

  const handleApproveAll = () => {
    const ids = day.reports.filter((r) => r.approvalStatus === "submitted").map((r) => r.id);
    if (ids.length > 0) handleBatchApprove(ids);
  };

  // ── サマリー ──
  const handleGenerateSummary = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await generateClientReportSummary(day.siteId, day.reportDate);
      if (!result.success) { setMessage(result.error || "生成に失敗しました"); return; }
      const r = result as { warning?: string | null; summaryId?: string | null; summaryText?: string | null };
      if (r.summaryId) {
        setSummaryId(r.summaryId);
        setSummaryText(r.summaryText ?? "");
        setSummaryStatus("draft");
        setPhotosLoaded(false); // 写真再読み込み
      }
      setMessage(r.warning ? `1次報告を生成しました（${r.warning}）` : "1次報告を生成しました");
      router.refresh();
    });
  };

  const handleRegenerateSummary = () => {
    if (!regenPrompt.trim()) return;
    setMessage(null);
    startTransition(async () => {
      const result = await regenerateSummaryWithPrompt({
        siteId: day.siteId, reportDate: day.reportDate,
        currentText: summaryText, userPrompt: regenPrompt.trim(),
      });
      if (!result.success) { setMessage(result.error || "再生成に失敗しました"); return; }
      setSummaryText(result.text ?? "");
      setShowRegenPrompt(false); setRegenPrompt("");
      setMessage("再生成しました（まだ保存されていません）");
      setIsEditingSummary(true);
    });
  };

  const handleSubmitSummary = () => {
    if (!summaryId) return;
    setMessage(null);
    startTransition(async () => {
      // まずテキストを保存
      const saveResult = await saveClientReportSummaryDraft({
        summaryId,
        siteId: day.siteId,
        summaryText,
        officialProgress: day.summary?.officialProgress ?? [],
      });
      if (!saveResult.success) { setMessage(saveResult.error || "保存に失敗しました"); return; }

      // 提出
      const result = await submitClientReportSummary(summaryId, day.siteId);
      if (!result.success) { setMessage(result.error || "提出に失敗しました"); return; }
      setSummaryStatus("submitted");
      setIsEditingSummary(false);
      setMessage("クライアントに提出しました");
      router.refresh();
    });
  };

  const summaryExists = !!summaryId;
  const summaryConfig = SUMMARY_STATUS_CONFIG[summaryStatus] ?? SUMMARY_STATUS_CONFIG.ungenerated;
  const canEdit = summaryStatus === "draft" || summaryStatus === "revision_requested";
  const canSubmit = (summaryStatus === "draft" || summaryStatus === "revision_requested") && summaryText.trim().length > 0;
  const submittedGroupCount = groups.filter((g) => g.submittedIds.length > 0).length;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/40 p-4 pt-[5vh] overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl mb-10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-[16px] font-bold text-gray-900">{day.siteName}</h2>
            <p className="text-[12px] text-gray-400">{formatDate(day.reportDate)}</p>
          </div>
          <button type="button" onClick={onClose} className="flex items-center justify-center w-9 h-9 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className="mx-5 mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-600">
            {message}
          </div>
        )}

        <div className="max-h-[75vh] overflow-y-auto">
          {/* ━━━ 2次報告（承認） ━━━ */}
          <div className="p-5 pb-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-gray-700 flex items-center gap-1.5">
                <FileText size={14} className="text-gray-400" />
                2次報告（{groups.length}件）
              </h3>
              {submittedGroupCount > 0 && (
                <button type="button" onClick={handleApproveAll} disabled={isPending}
                  className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-emerald-500 px-3 text-[11px] font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                  <CheckCircle2 size={11} /> すべて承認
                </button>
              )}
            </div>

            <div className="space-y-3">
              {groups.map((group, gi) => {
                const groupKey = `${group.reporterName}_${gi}`;
                const groupStatus = group.reports.every((r) => r.approvalStatus === "approved") ? "approved"
                  : group.reports.every((r) => r.approvalStatus === "rejected") ? "rejected"
                  : group.submittedIds.length > 0 ? "submitted" : "approved";
                const sc = APPROVAL_STATUS_CONFIG[groupStatus] ?? APPROVAL_STATUS_CONFIG.submitted;
                const SI = sc.Icon;

                return (
                  <div key={groupKey} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Users size={12} className="text-gray-400 shrink-0" />
                        <span className="text-[12px] font-semibold text-gray-800 truncate">{group.reporterName}</span>
                        <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${sc.badge}`}>
                          <SI size={9} />{sc.label}
                        </span>
                        <span className="text-[9px] text-gray-300 shrink-0">
                          {new Date(group.createdAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <Link href={`/reports/${group.reports[0].id}`} target="_blank"
                        className="inline-flex items-center gap-0.5 text-[10px] text-[#0EA5E9]/60 hover:text-[#0EA5E9] transition-colors shrink-0">
                        <ExternalLink size={10} /> 詳細
                      </Link>
                    </div>
                    <div className="px-3 py-2.5">
                      {/* 工程＋チェックリスト */}
                      <div className="space-y-2 mb-2">
                        {group.reports.map((r) => {
                          const items = r.processId ? checklistCache[r.processId] ?? [] : [];
                          return (
                            <div key={r.id}>
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                                {r.processName} <span className="text-[#0EA5E9] font-medium">{r.progressRate}%</span>
                              </span>
                              {items.length > 0 && (
                                <div className="ml-2 mt-1 space-y-1">
                                  {items.map((item) => (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onClick={() => r.processId && handleChecklistToggle(item, r.processId)}
                                      disabled={isPending}
                                      className="flex items-center gap-1.5 w-full text-left"
                                    >
                                      <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                        item.isCompleted ? "border-emerald-400 bg-emerald-400 text-white" : "border-gray-300 bg-white hover:border-[#0EA5E9]"
                                      }`}>
                                        {item.isCompleted && <CheckCircle2 size={10} />}
                                      </div>
                                      <span className={`text-[10px] ${item.isCompleted ? "text-gray-300 line-through" : "text-gray-600"}`}>
                                        {item.name}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {/* 報告内容（同一報告者の全報告を表示） */}
                      {(() => {
                        const uniqueContents = new Map<string, { workContent: string; issues: string | null; arrivalTime: string | null; departureTime: string | null; createdAt: string; approvalStatus: string; processNames: string[] }>();
                        for (const r of group.reports) {
                          const contentKey = `${r.workContent}_${r.issues ?? ""}_${r.arrivalTime ?? ""}`;
                          if (!uniqueContents.has(contentKey)) {
                            uniqueContents.set(contentKey, { workContent: r.workContent, issues: r.issues, arrivalTime: r.arrivalTime, departureTime: r.departureTime, createdAt: r.createdAt, approvalStatus: r.approvalStatus, processNames: [] });
                          }
                          uniqueContents.get(contentKey)!.processNames.push(r.processName);
                        }
                        return Array.from(uniqueContents.values()).map((content, ci) => {
                          const isRejected = content.approvalStatus === "rejected";
                          const statusSc = APPROVAL_STATUS_CONFIG[content.approvalStatus] ?? APPROVAL_STATUS_CONFIG.submitted;
                          const StatusIc = statusSc.Icon;
                          return (
                            <div key={ci} className={`rounded-lg border p-2.5 mb-2 last:mb-0 ${isRejected ? "border-red-200 bg-red-50/30" : "border-gray-100 bg-gray-50/30"}`}>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${statusSc.badge}`}>
                                  <StatusIc size={9} />{statusSc.label}
                                </span>
                                <span className="text-[9px] text-gray-300">
                                  提出: {new Date(content.createdAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              {(content.arrivalTime || content.departureTime) && (
                                <p className="text-[10px] text-gray-400 mb-1">
                                  🕐 {content.arrivalTime ?? "--:--"} 〜 {content.departureTime ?? "--:--"}
                                </p>
                              )}
                              <p className="text-[11px] text-gray-500 leading-relaxed whitespace-pre-wrap">
                                {content.workContent || "（作業内容なし）"}
                              </p>
                              {content.issues && (
                                <div className="rounded-lg bg-red-50 border border-red-100 px-2 py-1.5 mt-1">
                                  <p className="text-[10px] text-red-400 font-medium mb-0.5">報告記入欄</p>
                                  <p className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap">{content.issues}</p>
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                      {/* 2次報告の添付写真 */}
                      {reportPhotosLoaded && (() => {
                        // 同じ写真が工程ごとに重複するため、最初の報告IDの写真のみ表示
                        const firstReportId = group.reports[0]?.id;
                        const groupPhotos = reportPhotos.filter((p) => p.reportId === firstReportId);
                        if (groupPhotos.length === 0) return null;
                        return (
                          <div className="grid grid-cols-4 gap-1 mb-2">
                            {groupPhotos.map((photo) => (
                              <div key={photo.id} className="relative rounded-md overflow-hidden aspect-square bg-gray-200">
                                {photo.mediaType === "video" ? (
                                  <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                    <Video size={14} className="text-white/60" />
                                  </div>
                                ) : (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={photo.url} alt={photo.caption || ""} className="w-full h-full object-cover" />
                                )}
                                {photo.photoType && (
                                  <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] px-1 py-0.5 text-center">
                                    {PHOTO_TYPE_LABELS[photo.photoType] ?? photo.photoType}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      {group.submittedIds.length > 0 && (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleBatchApprove(group.submittedIds)} disabled={isPending}
                            className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-emerald-500 px-2.5 text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                            <CheckCircle2 size={11} /> 承認
                          </button>
                          {rejectingGroup === groupKey ? (
                            <div className="flex-1 flex gap-1.5">
                              <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="差し戻し理由..." className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] focus:border-red-300 focus:outline-none" />
                              <button type="button" onClick={() => handleBatchReject(group.submittedIds)} disabled={isPending || !rejectReason.trim()}
                                className="inline-flex min-h-[28px] items-center rounded-lg bg-red-500 px-2.5 text-[11px] font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors">差戻し</button>
                              <button type="button" onClick={() => { setRejectingGroup(null); setRejectReason(""); }}
                                className="inline-flex min-h-[28px] items-center rounded-lg border border-gray-200 px-1.5 text-gray-500 hover:bg-gray-100 transition-colors"><X size={11} /></button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setRejectingGroup(groupKey)} disabled={isPending}
                              className="inline-flex min-h-[28px] items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 text-[11px] font-medium text-red-500 hover:bg-red-100 disabled:opacity-50 transition-colors">
                              <XCircle size={11} /> 差戻し
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ━━━ 1次報告（サマリー） ━━━ */}
          <div className="px-5 pb-5 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3 mt-3">
              <h3 className="text-[13px] font-bold text-gray-700 flex items-center gap-1.5">
                <Send size={14} className="text-[#0EA5E9]" />
                1次報告
              </h3>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${summaryConfig.badge}`}>
                {summaryConfig.label}
              </span>
            </div>

            {!summaryExists ? (
              /* 未作成 → 生成ボタン */
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
                <p className="text-[12px] text-gray-400 mb-3">まだ1次報告が作成されていません</p>
                <button type="button" onClick={handleGenerateSummary} disabled={isPending}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#0EA5E9] px-4 text-[12px] font-bold text-white hover:bg-[#0284C7] disabled:opacity-50 transition-colors">
                  <Sparkles size={13} /> {isPending ? "生成中..." : "AI生成"}
                </button>
              </div>
            ) : (
              /* 既存サマリー → 編集・提出 */
              <div className="space-y-3">
                {/* テキスト */}
                {isEditingSummary ? (
                  <textarea
                    value={summaryText}
                    onChange={(e) => setSummaryText(e.target.value)}
                    rows={6}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[12px] leading-6 text-gray-700 focus:border-[#0EA5E9]/50 focus:outline-none resize-none"
                  />
                ) : (
                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => canEdit && setIsEditingSummary(true)}>
                    <p className="text-[12px] text-gray-600 leading-6 whitespace-pre-wrap">
                      {summaryText || "（内容なし）"}
                    </p>
                    {canEdit && (
                      <p className="text-[10px] text-gray-300 mt-2 flex items-center gap-1"><Edit3 size={10} />クリックして編集</p>
                    )}
                  </div>
                )}

                {/* 進捗率（読み取り専用） */}
                {day.summary?.officialProgress && day.summary.officialProgress.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {day.summary.officialProgress.map((p, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md bg-cyan-50 px-2 py-1 text-[10px] text-cyan-700">
                        {p.processName} <span className="font-semibold">{p.progressRate}%</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* 写真 */}
                {photosLoaded && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium text-gray-400 flex items-center gap-1">
                        <Camera size={11} /> 写真・動画（{photos.length}件）
                      </span>
                      {canEdit && (
                        <label className="inline-flex items-center gap-1 text-[11px] text-[#0EA5E9] font-medium cursor-pointer hover:underline">
                          <ImagePlus size={11} /> 追加
                          <input type="file" accept="image/*,video/*" onChange={handlePhotoUpload} className="hidden" />
                        </label>
                      )}
                    </div>
                    {photos.length > 0 ? (
                      <div className="grid grid-cols-4 gap-1.5">
                        {photos.map((photo) => (
                          <div key={photo.id} className="relative group rounded-lg overflow-hidden aspect-square bg-gray-200">
                            {photo.mediaType === "video" ? (
                              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                <Video size={16} className="text-white/60" />
                              </div>
                            ) : (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={photo.url} alt={photo.caption || ""} className="w-full h-full object-cover" />
                            )}
                            {photo.isFromReport && (
                              <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/40 text-white px-1 rounded">2次</span>
                            )}
                            {canEdit && (
                              <button type="button" onClick={() => handlePhotoDelete(photo.id)} disabled={isPending}
                                className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500">
                                <Trash2 size={9} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-300 text-center py-2">写真はまだありません</p>
                    )}
                  </div>
                )}

                {/* アクションボタン */}
                <div className="flex flex-wrap gap-2">
                  {canSubmit && (
                    <button type="button" onClick={handleSubmitSummary} disabled={isPending}
                      className="inline-flex min-h-[32px] items-center gap-1.5 rounded-xl bg-[#0EA5E9] px-4 text-[12px] font-bold text-white hover:bg-[#0284C7] disabled:opacity-50 transition-colors">
                      <Send size={12} /> {isPending ? "提出中..." : "クライアントに提出"}
                    </button>
                  )}
                  {canEdit && !showRegenPrompt && (
                    <button type="button" onClick={() => setShowRegenPrompt(true)}
                      className="inline-flex min-h-[32px] items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-[12px] font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                      <Sparkles size={12} /> AI再生成
                    </button>
                  )}
                </div>

                {/* AI再生成プロンプト */}
                {showRegenPrompt && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                    <textarea value={regenPrompt} onChange={(e) => setRegenPrompt(e.target.value)} rows={2}
                      placeholder="修正指示を入力（例：もっと簡潔に、注意事項を強調して）"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] text-gray-700 focus:border-[#0EA5E9]/50 focus:outline-none resize-none" />
                    <div className="flex gap-2">
                      <button type="button" onClick={handleRegenerateSummary} disabled={isPending || !regenPrompt.trim()}
                        className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-[#0EA5E9] px-3 text-[11px] font-bold text-white hover:bg-[#0284C7] disabled:opacity-50 transition-colors">
                        <Sparkles size={11} /> {isPending ? "生成中..." : "生成"}
                      </button>
                      <button type="button" onClick={() => { setShowRegenPrompt(false); setRegenPrompt(""); }}
                        className="inline-flex min-h-[28px] items-center rounded-lg border border-gray-200 px-2 text-[11px] text-gray-500 hover:bg-gray-100 transition-colors">キャンセル</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-3 flex justify-end">
          <button type="button" onClick={onClose}
            className="inline-flex min-h-[36px] items-center rounded-xl border border-gray-200 bg-white px-4 text-[12px] font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
