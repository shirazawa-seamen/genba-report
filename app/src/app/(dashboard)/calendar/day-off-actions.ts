"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// 指定月の全スタッフ休み一覧を取得
// ---------------------------------------------------------------------------
export async function getDaysOff(year: number, month: number): Promise<{
  success: boolean;
  daysOff?: {
    id: string;
    user_id: string;
    user_name: string;
    date: string;
    reason: string | null;
  }[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("staff_days_off")
    .select("id, user_id, date, reason")
    .gte("date", startDate)
    .lt("date", endDate)
    .order("date");

  if (error) {
    return { success: false, error: "休み情報の取得に失敗しました" };
  }

  // ユーザー名を一括取得
  const userIds = [...new Set((data ?? []).map((d) => d.user_id))];
  const nameMap = new Map<string, string>();
  if (userIds.length > 0) {
    const adminClient = createAdminClient();
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      if (p.full_name) nameMap.set(p.id, p.full_name);
    }
  }

  const daysOff = (data ?? []).map((d) => ({
    id: d.id,
    user_id: d.user_id,
    user_name: nameMap.get(d.user_id) ?? "不明",
    date: d.date,
    reason: d.reason,
  }));

  return { success: true, daysOff };
}

// ---------------------------------------------------------------------------
// 休み登録
// ---------------------------------------------------------------------------
export async function registerDayOff(input: {
  userId: string;
  date: string;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  // 権限チェック: 本人 or admin/manager
  if (input.userId !== user.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || !["admin", "manager"].includes(profile.role)) {
      return { success: false, error: "権限がありません" };
    }
  }

  const { error } = await supabase
    .from("staff_days_off")
    .upsert({
      user_id: input.userId,
      date: input.date,
      reason: input.reason?.trim() || null,
      registered_by: user.id,
    }, { onConflict: "user_id,date" });

  if (error) {
    return { success: false, error: `登録に失敗しました: ${error.message}` };
  }

  revalidatePath("/calendar");
  revalidatePath("/mypage");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 休み取消
// ---------------------------------------------------------------------------
export async function removeDayOff(input: {
  userId: string;
  date: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  // 権限チェック: 本人 or admin/manager
  if (input.userId !== user.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || !["admin", "manager"].includes(profile.role)) {
      return { success: false, error: "権限がありません" };
    }
  }

  const { error } = await supabase
    .from("staff_days_off")
    .delete()
    .eq("user_id", input.userId)
    .eq("date", input.date);

  if (error) {
    return { success: false, error: `取消に失敗しました: ${error.message}` };
  }

  revalidatePath("/calendar");
  revalidatePath("/mypage");
  return { success: true };
}

// ---------------------------------------------------------------------------
// スタッフ一覧取得（休み登録モーダル用）
// ---------------------------------------------------------------------------
export async function getStaffList(): Promise<{
  success: boolean;
  staff?: { id: string; name: string; role: string }[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["admin", "manager", "worker_internal", "worker_external"])
    .order("full_name");

  if (error) {
    return { success: false, error: "スタッフ一覧の取得に失敗しました" };
  }

  const staff = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name ?? "名前未設定",
    role: p.role,
  }));

  return { success: true, staff };
}
