"use server";

import { createClient } from "@/lib/supabase/server";
import { getSecureSettingValue } from "@/lib/secureSettings";

export async function getWorkerTodayInfo(userId: string) {
  const supabase = await createClient();

  // 今日のアサイン現場を取得（今日の日付が現場の期間内のもののみ）
  const today = new Date().toISOString().slice(0, 10);

  const { data: memberSites } = await supabase
    .from("site_members")
    .select("site_id, sites(id, name, address, status, start_date, end_date)")
    .eq("user_id", userId);

  const activeSites = (memberSites ?? [])
    .map((m) => m.sites as unknown as { id: string; name: string; address: string | null; status: string; start_date: string | null; end_date: string | null } | null)
    .filter((s): s is { id: string; name: string; address: string | null; status: string; start_date: string | null; end_date: string | null } =>
      s !== null &&
      s.status === "active" &&
      (!s.start_date || s.start_date <= today) &&
      (!s.end_date || s.end_date >= today)
    );

  // 最近の自分の日報を取得
  const { data: recentReports } = await supabase
    .from("daily_reports")
    .select("work_content, issues, report_date, processes(name)")
    .eq("reporter_id", userId)
    .order("report_date", { ascending: false })
    .limit(5);

  return {
    todaySites: activeSites,
    recentReports: (recentReports ?? []).map((r) => ({
      reportDate: r.report_date as string,
      workContent: (r.work_content as string) ?? "",
      issues: (r.issues as string) ?? "",
      processName: (r.processes as unknown as { name?: string } | null)?.name ?? "",
    })),
  };
}

export async function generateWorkerAdvice(userId: string): Promise<string | null> {
  const apiKey = await getSecureSettingValue("claude_api_key");
  if (!apiKey) return null;

  const { recentReports } = await getWorkerTodayInfo(userId);
  if (recentReports.length === 0) return null;

  const reportsText = recentReports
    .map((r, i) => `${i + 1}. ${r.reportDate} ${r.processName}: ${r.workContent}${r.issues ? ` (注意: ${r.issues})` : ""}`)
    .join("\n");

  const prompt = [
    "あなたは建設現場の安全管理アシスタントです。",
    "以下は職人の最近の作業報告です。この内容を踏まえて、今日の作業で気をつけるべきことを一言（50文字以内）でアドバイスしてください。",
    "フレンドリーで励ましになるトーンで。",
    "",
    reportsText,
  ].join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    return data.content?.find((item) => item.type === "text")?.text?.trim() ?? null;
  } catch {
    return null;
  }
}
