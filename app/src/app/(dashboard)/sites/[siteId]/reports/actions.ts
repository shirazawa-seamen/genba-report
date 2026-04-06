"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSecureSettingValue } from "@/lib/secureSettings";
import { canAccessSite } from "@/lib/siteAccess";
import { notifySummarySubmitted } from "@/lib/email";
import { syncReportPhotoToStorage } from "@/app/(dashboard)/storage/actions";
import { logActivity } from "@/lib/activity-log";

async function requireManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null as Awaited<ReturnType<typeof createClient>> | null, user: null, error: "認証エラー" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return { supabase: null as Awaited<ReturnType<typeof createClient>> | null, user: null, error: "権限がありません" };
  }

  return { supabase, user, error: null as string | null };
}

function buildFallbackSummary(
  siteName: string,
  reportDate: string,
  reports: Array<{
    processName: string;
    progressRate: number;
    workContent: string;
    reporterName: string;
    issues: string | null;
  }>
) {
  const lines = reports.map((report, index) => {
    const issueText = report.issues?.trim() ? ` 注意点: ${report.issues.trim()}` : "";
    return `${index + 1}. ${report.processName} / 進捗 ${report.progressRate}% / 担当 ${report.reporterName} / 作業内容 ${report.workContent.trim()}${issueText}`;
  });

  return [
    `${siteName}の${reportDate}時点の作業報告を整理しました。`,
    "本日の実施内容:",
    ...lines,
    "クライアント向け要約として必要に応じて文言を調整してください。",
  ].join("\n");
}

async function generateSummaryWithClaude(prompt: string) {
  const apiKey = await getSecureSettingValue("claude_api_key");
  if (!apiKey) return null;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return data.content?.find((item) => item.type === "text")?.text?.trim() ?? null;
}

export async function generateClientReportSummary(siteId: string, reportDate: string) {
  const context = await requireManager();
  if (!context.supabase || !context.user) {
    return { success: false, error: context.error };
  }

  // サイトアクセス権チェック
  if (!(await canAccessSite(context.user.id, siteId))) {
    return { success: false, error: "この現場にアクセスする権限がありません" };
  }

  const supabase = context.supabase;
  const { data: site } = await supabase
    .from("sites")
    .select("name")
    .eq("id", siteId)
    .maybeSingle();

  const { data: reports, error } = await supabase
    .from("daily_reports")
    .select("id, progress_rate, work_content, issues, reporter_id, workers, weather, arrival_time, departure_time, processes(name)")
    .eq("site_id", siteId)
    .eq("report_date", reportDate)
    .neq("approval_status", "rejected")
    .order("created_at");

  if (error) {
    return { success: false, error: `報告の取得に失敗しました: ${error.message}` };
  }

  // 1次報告がなくても空テンプレートで2次報告を作成可能
  if (!reports || reports.length === 0) {
    // 既存チェック（upsert の代わりに明示的に確認）
    const { data: existing } = await supabase
      .from("client_report_summaries")
      .select("id")
      .eq("site_id", siteId)
      .eq("report_date", reportDate)
      .maybeSingle();

    if (existing) {
      // 既存があれば更新
      const { error: updateError } = await supabase
        .from("client_report_summaries")
        .update({
          summary_text: "",
          official_progress: [],
          source_report_ids: [],
          generated_by: context.user.id,
          status: "draft",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (updateError) {
        return { success: false, error: `1次報告更新に失敗しました: ${updateError.message}` };
      }
    } else {
      // 新規作成
      const { error: insertError } = await supabase
        .from("client_report_summaries")
        .insert({
          site_id: siteId,
          report_date: reportDate,
          summary_text: "",
          official_progress: [],
          source_report_ids: [],
          generated_by: context.user.id,
          status: "draft",
          updated_at: new Date().toISOString(),
        });
      if (insertError) {
        return { success: false, error: `1次報告作成に失敗しました: ${insertError.message}` };
      }
    }
    revalidatePath(`/sites/${siteId}/reports`);
    revalidatePath("/manager/reports");
    return { success: true };
  }

  const reporterIds = [...new Set(reports.map((report) => report.reporter_id).filter(Boolean))] as string[];
  const { data: reporters } = reporterIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", reporterIds)
    : { data: [] };
  const reporterMap = new Map((reporters ?? []).map((reporter) => [reporter.id, reporter.full_name ?? "不明"]));

  const normalizedReports = reports.map((report) => ({
    processName:
      ((report.processes as unknown as { name?: string } | null)?.name ?? "工程未設定"),
    progressRate: report.progress_rate ?? 0,
    workContent: report.work_content ?? "",
    reporterName: report.reporter_id ? reporterMap.get(report.reporter_id) ?? "不明" : "不明",
    issues: report.issues ?? null,
    weather: (report.weather as string | null) ?? null,
    arrivalTime: (report.arrival_time as string | null) ?? null,
    departureTime: (report.departure_time as string | null) ?? null,
  }));

  // 天気・時間は最初の報告から取得（同日同現場で統一）
  const summaryWeather = normalizedReports.find((r) => r.weather)?.weather ?? null;
  const summaryArrivalTime = normalizedReports.find((r) => r.arrivalTime)?.arrivalTime ?? null;
  const summaryDepartureTime = normalizedReports.find((r) => r.departureTime)?.departureTime ?? null;

  const prompt = [
    "あなたは建設現場の現場監督です。以下の複数の職人報告をもとに、クライアントへ提出する日次報告文を作成してください。",
    "",
    "【重要な文体ルール】",
    "箇条書き、記号（・、●、■、★、※、→など）、番号付きリスト、マークダウン記法は一切使わないでください。",
    "通常の文章として、段落で区切って書いてください。",
    "現場監督が自分の言葉で書いたような、自然で簡潔な報告文にしてください。",
    "AIが生成したとわからないよう、定型的な表現や過度に丁寧な言い回しは避けてください。",
    "",
    "【内容ルール】",
    "事実のみを整理し、重複する内容はまとめてください。",
    "各工程の進捗状況と、注意事項があればそれも含めてください。",
    "冒頭に挨拶文や「お疲れ様です」等は不要です。報告内容から書き始めてください。",
    "",
    `現場: ${site?.name ?? "不明な現場"}`,
    `日付: ${reportDate}`,
    summaryWeather ? `天気: ${summaryWeather}` : "",
    summaryArrivalTime || summaryDepartureTime ? `現場時間: ${summaryArrivalTime ?? "--:--"} 〜 ${summaryDepartureTime ?? "--:--"}` : "",
    "",
    "以下が職人からの報告です:",
    ...normalizedReports.map((report, index) =>
      `${index + 1}. 工程=${report.processName}, 進捗=${report.progressRate}%, 担当=${report.reporterName}, 内容=${report.workContent}${report.issues ? `, 注意事項=${report.issues}` : ""}`
    ),
  ].join("\n");

  let summaryText = buildFallbackSummary(site?.name ?? "不明な現場", reportDate, normalizedReports);
  let llmWarning: string | null = null;
  try {
    const llmSummary = await generateSummaryWithClaude(prompt);
    if (llmSummary) {
      summaryText = llmSummary;
    } else {
      llmWarning = "LLM APIキーが未設定のためテンプレート文を使用しました";
    }
  } catch (llmError) {
    const errDetail = llmError instanceof Error ? llmError.message : String(llmError);
    console.error("[LLM] Failed to generate report summary:", errDetail);
    llmWarning = `AI生成に失敗しました（${errDetail}）。テンプレート文を使用しました`;
  }

  const officialProgress = Array.from(
    reports.reduce((map, report) => {
      const processName =
        ((report.processes as unknown as { name?: string } | null)?.name ?? "工程未設定");
      const current = map.get(processName) ?? [];
      current.push(report.progress_rate ?? 0);
      map.set(processName, current);
      return map;
    }, new Map<string, number[]>())
  ).map(([processName, rates]) => ({
    processId: processName,
    processName,
    progressRate: Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length),
  }));

  const sourceReportIds = reports.map((report) => report.id);

  // 2次報告から作業者を自動引き継ぎ（重複排除）
  const allWorkers = reports.flatMap((report) => (report.workers as string[] | null) ?? []);
  const uniqueWorkers = [...new Set(allWorkers)].filter((w) => w.trim().length > 0);

  // 既存チェック（upsert の代わりに明示的に insert/update）
  const { data: existingSummary } = await supabase
    .from("client_report_summaries")
    .select("id")
    .eq("site_id", siteId)
    .eq("report_date", reportDate)
    .maybeSingle();

  let summaryId: string | null = null;

  if (existingSummary) {
    const { error: updateError } = await supabase
      .from("client_report_summaries")
      .update({
        summary_text: summaryText,
        official_progress: officialProgress,
        source_report_ids: sourceReportIds,
        workers: uniqueWorkers,
        weather: summaryWeather,
        arrival_time: summaryArrivalTime,
        departure_time: summaryDepartureTime,
        generated_by: context.user.id,
        status: "draft",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSummary.id);
    if (updateError) {
      return { success: false, error: `1次報告更新に失敗しました: ${updateError.message}` };
    }
    summaryId = existingSummary.id;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("client_report_summaries")
      .insert({
        site_id: siteId,
        report_date: reportDate,
        summary_text: summaryText,
        official_progress: officialProgress,
        source_report_ids: sourceReportIds,
        workers: uniqueWorkers,
        weather: summaryWeather,
        arrival_time: summaryArrivalTime,
        departure_time: summaryDepartureTime,
        generated_by: context.user.id,
        status: "draft",
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insertError) {
      return { success: false, error: `1次報告作成に失敗しました: ${insertError.message}` };
    }
    summaryId = inserted?.id ?? null;
  }

  // 1次報告の写真を2次報告に自動コピー
  if (summaryId && sourceReportIds.length > 0) {
    try {
      // 既存のコピー済み写真を確認（重複防止）
      const { data: existingPhotos } = await supabase
        .from("summary_photos")
        .select("source_report_id, storage_path")
        .eq("summary_id", summaryId)
        .not("source_report_id", "is", null);

      const existingPaths = new Set(
        (existingPhotos ?? []).map((p) => p.storage_path)
      );

      // 最初の報告IDの写真のみ取得（複数工程で同じ写真が重複するのを防止）
      const firstReportId = sourceReportIds[0];
      const { data: reportPhotos } = await supabase
        .from("report_photos")
        .select("id, report_id, storage_path, photo_type, caption, media_type")
        .eq("report_id", firstReportId)
        .order("created_at");

      if (reportPhotos && reportPhotos.length > 0) {
        const newPhotos = reportPhotos
          .filter((p) => !existingPaths.has(p.storage_path))
          .map((p) => ({
            summary_id: summaryId!,
            storage_path: p.storage_path,
            photo_type: p.photo_type,
            caption: p.caption,
            media_type: p.media_type ?? "photo",
            source_report_id: p.report_id,
          }));

        if (newPhotos.length > 0) {
          await supabase.from("summary_photos").insert(newPhotos);
        }
      }
    } catch (photoError) {
      // 写真コピーに失敗しても1次報告生成自体は成功とする
      console.error("[SummaryPhotos] Failed to copy report photos:", photoError);
    }
  }

  revalidatePath(`/sites/${siteId}/reports`);
  revalidatePath("/manager/reports");
  revalidatePath("/client");
  return { success: true, warning: llmWarning, summaryId, summaryText };
}

// ---------------------------------------------------------------------------
// 既存テキストをプロンプト指示で再生成（TEXT2TEXT）
// ---------------------------------------------------------------------------
export async function regenerateSummaryWithPrompt(input: {
  siteId: string;
  reportDate: string;
  currentText: string;
  userPrompt: string;
}) {
  const context = await requireManager();
  if (!context.supabase || !context.user) {
    return { success: false as const, error: context.error ?? "認証エラー" };
  }
  if (!(await canAccessSite(context.user.id, input.siteId))) {
    return { success: false as const, error: "この現場にアクセスする権限がありません" };
  }

  const supabase = context.supabase;
  const { data: site } = await supabase
    .from("sites")
    .select("name")
    .eq("id", input.siteId)
    .maybeSingle();

  const prompt = [
    "あなたは建設現場の現場監督です。以下のクライアント向け日次報告文を、指示に従って書き直してください。",
    "",
    "【重要な文体ルール】",
    "箇条書き、記号（・、●、■、★、※、→など）、番号付きリスト、マークダウン記法は一切使わないでください。",
    "通常の文章として、段落で区切って書いてください。",
    "現場監督が自分の言葉で書いたような、自然で簡潔な報告文にしてください。",
    "AIが生成したとわからないよう、定型的な表現や過度に丁寧な言い回しは避けてください。",
    "",
    `現場: ${site?.name ?? "不明な現場"}`,
    `日付: ${input.reportDate}`,
    "",
    "【現在の報告文】",
    input.currentText,
    "",
    "【修正指示】",
    input.userPrompt,
    "",
    "修正指示に従って報告文を書き直してください。報告文のみを出力してください。",
  ].join("\n");

  try {
    const result = await generateSummaryWithClaude(prompt);
    if (!result) {
      return { success: false as const, error: "LLM APIキーが設定されていません。管理画面 → セキュア設定で claude_api_key を設定してください。" };
    }
    return { success: true as const, text: result };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[LLM] Regenerate error:", errMsg);
    return { success: false as const, error: `再生成に失敗しました: ${errMsg}` };
  }
}

// ---------------------------------------------------------------------------
// 自由入力で1次報告を新規作成（LLM なし）
// ---------------------------------------------------------------------------
export async function createClientReportSummaryManual(input: {
  siteId: string;
  reportDate: string;
  summaryText: string;
  officialProgress: Array<{ processId: string; processName: string; progressRate: number }>;
}) {
  const context = await requireManager();
  if (!context.supabase || !context.user) {
    return { success: false as const, error: context.error ?? "認証エラー", summaryId: null as string | null };
  }
  if (!(await canAccessSite(context.user.id, input.siteId))) {
    return { success: false as const, error: "この現場にアクセスする権限がありません", summaryId: null as string | null };
  }

  const supabase = context.supabase;

  // 対象日の報告IDを取得
  const { data: reports } = await supabase
    .from("daily_reports")
    .select("id")
    .eq("site_id", input.siteId)
    .eq("report_date", input.reportDate)
    .neq("approval_status", "rejected");

  const sourceReportIds = (reports ?? []).map((r) => r.id);

  const { data, error: upsertError } = await supabase
    .from("client_report_summaries")
    .upsert({
      site_id: input.siteId,
      report_date: input.reportDate,
      summary_text: input.summaryText.trim(),
      official_progress: input.officialProgress,
      source_report_ids: sourceReportIds,
      generated_by: context.user.id,
      status: "draft",
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (upsertError) {
    return { success: false as const, error: `保存に失敗しました: ${upsertError.message}`, summaryId: null as string | null };
  }

  revalidatePath(`/sites/${input.siteId}/reports`);
  revalidatePath("/manager/reports");
  revalidatePath("/client");
  return { success: true as const, error: null, summaryId: data?.id ?? null };
}

export async function saveClientReportSummaryDraft(input: {
  summaryId: string;
  siteId: string;
  summaryText: string;
  officialProgress: Array<{ processId: string; processName: string; progressRate: number }>;
  workers?: string[];
  weather?: string;
  arrivalTime?: string;
  departureTime?: string;
}) {
  const context = await requireManager();
  if (!context.supabase || !context.user) {
    return { success: false, error: context.error };
  }

  // サイトアクセス権チェック
  if (!(await canAccessSite(context.user.id, input.siteId))) {
    return { success: false, error: "この現場にアクセスする権限がありません" };
  }

  const invalidProgress = input.officialProgress.find(
    (item) => Number.isNaN(item.progressRate) || item.progressRate < 0 || item.progressRate > 100
  );
  if (invalidProgress) {
    return { success: false, error: `公式進捗が不正です: ${invalidProgress.processName}` };
  }

  const updateData: Record<string, unknown> = {
    summary_text: input.summaryText.trim(),
    official_progress: input.officialProgress,
    updated_at: new Date().toISOString(),
    status: "draft",
  };
  if (input.workers !== undefined) updateData.workers = input.workers;
  if (input.weather !== undefined) updateData.weather = input.weather;
  if (input.arrivalTime !== undefined) updateData.arrival_time = input.arrivalTime;
  if (input.departureTime !== undefined) updateData.departure_time = input.departureTime;

  const { error } = await context.supabase
    .from("client_report_summaries")
    .update(updateData)
    .eq("id", input.summaryId);

  if (error) {
    return { success: false, error: `下書き保存に失敗しました: ${error.message}` };
  }

  revalidatePath(`/sites/${input.siteId}/reports`);
  revalidatePath("/client");
  return { success: true };
}

export async function submitClientReportSummary(summaryId: string, siteId: string) {
  const context = await requireManager();
  if (!context.supabase || !context.user) {
    return { success: false, error: context.error };
  }

  // サイトアクセス権チェック
  if (!(await canAccessSite(context.user.id, siteId))) {
    return { success: false, error: "この現場にアクセスする権限がありません" };
  }

  const { data: summary, error: summaryError } = await context.supabase
    .from("client_report_summaries")
    .select("official_progress")
    .eq("id", summaryId)
    .maybeSingle();

  if (summaryError) {
    return { success: false, error: `提出前確認に失敗しました: ${summaryError.message}` };
  }

  const officialProgress = Array.isArray(summary?.official_progress)
    ? (summary.official_progress as Array<{ processId?: string; processName?: string; progressRate?: number }>)
    : [];

  const { data: siteProcesses } = await context.supabase
    .from("processes")
    .select("id, name")
    .eq("site_id", siteId);
  const processMap = new Map((siteProcesses ?? []).map((process) => [process.name, process.id]));

  for (const item of officialProgress) {
    const processId = item.processName ? processMap.get(item.processName) : null;
    if (!processId) continue;
    const rate = Math.max(0, Math.min(100, Number(item.progressRate) || 0));
    const status = rate >= 100 ? "completed" : "in_progress";
    await context.supabase
      .from("processes")
      .update({ progress_rate: rate, status })
      .eq("id", processId);
  }

  const { error } = await context.supabase
    .from("client_report_summaries")
    .update({
      status: "submitted",
      submitted_by: context.user.id,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", summaryId);

  if (error) {
    return { success: false, error: `提出に失敗しました: ${error.message}` };
  }

  // クライアントがこの現場を閲覧できるか確認（company_id の紐付けチェック）
  let warning: string | null = null;
  const { data: siteData } = await context.supabase
    .from("sites")
    .select("company_id")
    .eq("id", siteId)
    .maybeSingle();

  if (!siteData?.company_id) {
    // site_members にクライアントロールのユーザーがいるか確認
    const { data: clientMembers } = await context.supabase
      .from("site_members")
      .select("user_id, profiles(role)")
      .eq("site_id", siteId);
    const hasClientMember = (clientMembers ?? []).some(
      (m) => (m.profiles as unknown as { role?: string } | null)?.role === "client"
    );
    if (!hasClientMember) {
      warning = "この現場にクライアントが紐付けられていません。クライアントが1次報告を閲覧できるよう、現場にクライアントを招待するか、会社を設定してください。";
    }
  }

  revalidatePath(`/sites/${siteId}/reports`);
  revalidatePath("/client");

  // クライアントへメール通知（1次報告提出時）
  try {
    const { data: siteInfo } = await context.supabase
      .from("sites")
      .select("name, company_id")
      .eq("id", siteId)
      .maybeSingle();

    const { data: summaryInfo } = await context.supabase
      .from("client_report_summaries")
      .select("report_date")
      .eq("id", summaryId)
      .maybeSingle();

    if (siteInfo && summaryInfo) {
      const adminClient = createAdminClient();

      // このサイトにアクセスできるクライアントを特定
      const { data: clientMembers } = await context.supabase
        .from("site_members")
        .select("user_id, profiles(role)")
        .eq("site_id", siteId);
      const clientMemberIds = (clientMembers ?? [])
        .filter((m) => (m.profiles as unknown as { role?: string } | null)?.role === "client")
        .map((m) => m.user_id);

      // company_id 経由のクライアントも含める
      let companyClientIds: string[] = [];
      if (siteInfo.company_id) {
        const { data: companyClients } = await adminClient
          .from("profiles")
          .select("id")
          .eq("role", "client")
          .eq("company_id", siteInfo.company_id);
        companyClientIds = (companyClients ?? []).map((c) => c.id);
      }

      const allClientIds = [...new Set([...clientMemberIds, ...companyClientIds])];
      if (allClientIds.length > 0) {
        const { data: authUsers } = await adminClient.auth.admin.listUsers();
        const clientIdSet = new Set(allClientIds);
        const clientEmails = (authUsers?.users ?? [])
          .filter((u) => clientIdSet.has(u.id) && u.email)
          .map((u) => u.email!);

        notifySummarySubmitted({
          siteName: siteInfo.name,
          reportDate: summaryInfo.report_date,
          clientEmails,
        }).catch((err) => console.error("[Email] Summary notification error:", err));
      }
    }
  } catch (err) {
    console.error("[Email] Failed to send summary notification:", err);
  }

  // ログ記録
  logActivity({
    entityType: "client_report_summary",
    entityId: summaryId,
    siteId,
    action: "submitted",
    actorId: context.user.id,
  });

  return { success: true, warning };
}

// ---------------------------------------------------------------------------
// 2次報告に写真・動画をアップロード
// ---------------------------------------------------------------------------
export async function uploadSummaryPhoto(formData: FormData) {
  const context = await requireManager();
  if (!context.supabase || !context.user) {
    return { success: false as const, error: context.error ?? "認証エラー" };
  }

  const summaryId = formData.get("summaryId") as string;
  const siteId = formData.get("siteId") as string;
  const file = formData.get("file") as File | null;
  const caption = (formData.get("caption") as string) || null;

  if (!summaryId || !siteId || !file) {
    return { success: false as const, error: "必須パラメータが不足しています" };
  }

  if (!(await canAccessSite(context.user.id, siteId))) {
    return { success: false as const, error: "この現場にアクセスする権限がありません" };
  }

  const isVideo = file.type.startsWith("video/");
  const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { success: false as const, error: `ファイルサイズが大きすぎます（上限: ${isVideo ? "50MB" : "10MB"}）` };
  }

  const ext = file.name.split(".").pop() ?? (isVideo ? "mp4" : "jpg");
  const storagePath = `summaries/${summaryId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await context.supabase.storage
    .from("report-photos")
    .upload(storagePath, file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    return { success: false as const, error: `アップロードに失敗しました: ${uploadError.message}` };
  }

  const { error: dbError } = await context.supabase.from("summary_photos").insert({
    summary_id: summaryId,
    storage_path: storagePath,
    caption,
    media_type: isVideo ? "video" : "photo",
  });

  if (dbError) {
    // DBエラー時はストレージからも削除
    await context.supabase.storage.from("report-photos").remove([storagePath]);
    return { success: false as const, error: `写真情報の保存に失敗しました: ${dbError.message}` };
  }

  // ストレージフォルダに自動反映（非同期、失敗しても報告アップロード自体は成功）
  syncReportPhotoToStorage({
    siteId,
    userId: context.user.id,
    storagePath,
    fileName: file.name,
    fileSize: file.size,
  }).catch((err) => console.error("[StorageSync] Error:", err));

  revalidatePath(`/sites/${siteId}/reports`);
  revalidatePath("/manager/reports");
  return { success: true as const };
}

// ---------------------------------------------------------------------------
// 2次報告の写真を削除
// ---------------------------------------------------------------------------
export async function deleteSummaryPhoto(photoId: string, siteId: string) {
  const context = await requireManager();
  if (!context.supabase || !context.user) {
    return { success: false, error: context.error };
  }

  if (!(await canAccessSite(context.user.id, siteId))) {
    return { success: false, error: "この現場にアクセスする権限がありません" };
  }

  const { data: photo } = await context.supabase
    .from("summary_photos")
    .select("storage_path, source_report_id")
    .eq("id", photoId)
    .maybeSingle();

  if (!photo) {
    return { success: false, error: "写真が見つかりません" };
  }

  // 1次報告からコピーされた写真はDB参照のみ削除（ストレージの実体は残す）
  // 2次報告で直接アップロードされた写真はストレージからも削除
  if (!photo.source_report_id && photo.storage_path.startsWith("summaries/")) {
    await context.supabase.storage.from("report-photos").remove([photo.storage_path]);
  }

  const { error } = await context.supabase
    .from("summary_photos")
    .delete()
    .eq("id", photoId);

  if (error) {
    return { success: false, error: `削除に失敗しました: ${error.message}` };
  }

  revalidatePath(`/sites/${siteId}/reports`);
  revalidatePath("/manager/reports");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 2次報告の写真一覧を取得（signed URL付き）
// ---------------------------------------------------------------------------
export async function getSummaryPhotos(summaryId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: photos } = await supabase
    .from("summary_photos")
    .select("id, storage_path, caption, media_type, source_report_id")
    .eq("summary_id", summaryId)
    .order("created_at");

  if (!photos || photos.length === 0) return [];

  const result = await Promise.all(
    photos.map(async (p) => {
      const { data } = await supabase.storage
        .from("report-photos")
        .createSignedUrl(p.storage_path, 3600);
      return {
        id: p.id,
        url: data?.signedUrl ?? "",
        caption: p.caption,
        mediaType: p.media_type ?? "photo",
        isFromReport: !!p.source_report_id,
        storagePath: p.storage_path,
      };
    })
  );

  return result;
}

export async function confirmClientReportSummary(summaryId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "認証エラー" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "client") {
    return { success: false, error: "権限がありません" };
  }

  // 1次報告のサイトにクライアントがアクセス権を持っているか確認
  const { data: summaryData } = await supabase
    .from("client_report_summaries")
    .select("site_id")
    .eq("id", summaryId)
    .maybeSingle();

  if (!summaryData?.site_id) {
    return { success: false, error: "1次報告が見つかりません" };
  }

  if (!(await canAccessSite(user.id, summaryData.site_id))) {
    return { success: false, error: "この現場にアクセスする権限がありません" };
  }

  const { error } = await supabase
    .from("client_report_summaries")
    .update({
      status: "client_confirmed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", summaryId);

  if (error) {
    return { success: false, error: `確認に失敗しました: ${error.message}` };
  }

  // ログ記録
  logActivity({
    entityType: "client_report_summary",
    entityId: summaryId,
    siteId: summaryData.site_id,
    action: "client_confirmed",
    actorId: user.id,
  });

  revalidatePath("/client");
  revalidatePath("/");
  revalidatePath("/manager/reports");
  return { success: true };
}

export async function rejectReportsFromSummary(
  summaryId: string,
  siteId: string,
  reason: string
) {
  const context = await requireManager();
  if (!context.supabase || !context.user) {
    return { success: false, error: context.error };
  }

  // サイトアクセス権チェック
  if (!(await canAccessSite(context.user.id, siteId))) {
    return { success: false, error: "この現場にアクセスする権限がありません" };
  }

  // 1次報告から元の報告IDを取得
  const { data: summary, error: summaryError } = await context.supabase
    .from("client_report_summaries")
    .select("source_report_ids, report_date")
    .eq("id", summaryId)
    .maybeSingle();

  if (summaryError || !summary) {
    return { success: false, error: "1次報告情報の取得に失敗しました" };
  }

  const sourceReportIds = Array.isArray(summary.source_report_ids)
    ? (summary.source_report_ids as string[])
    : [];

  if (sourceReportIds.length === 0) {
    return { success: false, error: "差し戻し対象の報告が見つかりません" };
  }

  // 元の報告を差し戻し
  const { error: rejectError } = await context.supabase
    .from("daily_reports")
    .update({
      approval_status: "rejected",
      rejection_comment: reason,
    })
    .in("id", sourceReportIds);

  if (rejectError) {
    return { success: false, error: `報告の差し戻しに失敗しました: ${rejectError.message}` };
  }

  // 1次報告を rejected に変更
  await context.supabase
    .from("client_report_summaries")
    .update({
      status: "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", summaryId);

  // ログ記録
  logActivity({
    entityType: "client_report_summary",
    entityId: summaryId,
    siteId,
    action: "rejected",
    actorId: context.user.id,
    detail: { reason, source_report_ids: sourceReportIds },
  });

  revalidatePath(`/sites/${siteId}/reports`);
  revalidatePath("/reports");
  revalidatePath("/");
  return { success: true };
}

// ---------------------------------------------------------------------------
// クライアントからの修正依頼
// ---------------------------------------------------------------------------
export async function requestRevisionClientReportSummary(
  summaryId: string,
  comment: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "認証エラー" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "client") {
    return { success: false, error: "権限がありません" };
  }

  // 1次報告のサイトにクライアントがアクセス権を持っているか確認
  const { data: summaryData } = await supabase
    .from("client_report_summaries")
    .select("site_id, status")
    .eq("id", summaryId)
    .maybeSingle();

  if (!summaryData?.site_id) {
    return { success: false, error: "1次報告が見つかりません" };
  }

  if (summaryData.status !== "submitted" && summaryData.status !== "client_confirmed") {
    return { success: false, error: "修正依頼できる状態ではありません" };
  }

  if (!(await canAccessSite(user.id, summaryData.site_id))) {
    return { success: false, error: "この現場にアクセスする権限がありません" };
  }

  const { error } = await supabase
    .from("client_report_summaries")
    .update({
      status: "revision_requested",
      revision_comment: comment || null,
      revision_requested_by: user.id,
      revision_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", summaryId);

  if (error) {
    return { success: false, error: `修正依頼に失敗しました: ${error.message}` };
  }

  // ログ記録
  logActivity({
    entityType: "client_report_summary",
    entityId: summaryId,
    siteId: summaryData.site_id,
    action: "revision_requested",
    actorId: user.id,
    detail: comment ? { comment } : null,
  });

  revalidatePath("/client");
  revalidatePath("/manager/reports");
  revalidatePath("/");
  return { success: true };
}
