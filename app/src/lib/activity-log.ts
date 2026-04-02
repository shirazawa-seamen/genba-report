"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActivityEntityType, ActivityAction } from "@/lib/types";

/**
 * アクティビティログを記録する
 * エラーが発生しても呼び出し元には影響を与えない（fire-and-forget）
 */
export async function logActivity(input: {
  entityType: ActivityEntityType;
  entityId: string;
  siteId?: string | null;
  action: ActivityAction;
  actorId: string;
  detail?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("activity_logs").insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      site_id: input.siteId || null,
      action: input.action,
      actor_id: input.actorId,
      detail: input.detail || null,
    });
  } catch (err) {
    console.error("[logActivity] Failed to log activity:", err);
  }
}

/**
 * エンティティのアクティビティログを取得する
 */
export async function getActivityLogs(input: {
  entityType: ActivityEntityType;
  entityId: string;
  limit?: number;
}): Promise<{
  success: boolean;
  logs?: {
    id: string;
    action: ActivityAction;
    actor_id: string;
    actor_name: string | null;
    detail: Record<string, unknown> | null;
    created_at: string;
  }[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, action, actor_id, detail, created_at")
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 50);

  if (error) {
    return { success: false, error: "ログの取得に失敗しました" };
  }

  // アクター名を一括取得
  const actorIds = [...new Set((data ?? []).map((d) => d.actor_id))];
  const nameMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", actorIds);
    for (const p of profiles ?? []) {
      if (p.full_name) nameMap.set(p.id, p.full_name);
    }
  }

  const logs = (data ?? []).map((d) => ({
    id: d.id,
    action: d.action as ActivityAction,
    actor_id: d.actor_id,
    actor_name: nameMap.get(d.actor_id) ?? null,
    detail: d.detail as Record<string, unknown> | null,
    created_at: d.created_at,
  }));

  return { success: true, logs };
}

/**
 * サイト単位のアクティビティログを取得する
 */
export async function getSiteActivityLogs(input: {
  siteId: string;
  limit?: number;
}): Promise<{
  success: boolean;
  logs?: {
    id: string;
    entity_type: ActivityEntityType;
    entity_id: string;
    action: ActivityAction;
    actor_id: string;
    actor_name: string | null;
    detail: Record<string, unknown> | null;
    created_at: string;
  }[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "認証エラー" };

  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, entity_type, entity_id, action, actor_id, detail, created_at")
    .eq("site_id", input.siteId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 100);

  if (error) {
    return { success: false, error: "ログの取得に失敗しました" };
  }

  const actorIds = [...new Set((data ?? []).map((d) => d.actor_id))];
  const nameMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", actorIds);
    for (const p of profiles ?? []) {
      if (p.full_name) nameMap.set(p.id, p.full_name);
    }
  }

  const logs = (data ?? []).map((d) => ({
    id: d.id,
    entity_type: d.entity_type as ActivityEntityType,
    entity_id: d.entity_id,
    action: d.action as ActivityAction,
    actor_id: d.actor_id,
    actor_name: nameMap.get(d.actor_id) ?? null,
    detail: d.detail as Record<string, unknown> | null,
    created_at: d.created_at,
  }));

  return { success: true, logs };
}
