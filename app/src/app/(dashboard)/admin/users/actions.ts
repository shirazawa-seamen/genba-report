"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// Helper to verify the current user is admin
async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Forbidden");
  return user;
}

export async function inviteUser(formData: FormData) {
  await verifyAdmin();

  const email = formData.get("email") as string;
  const role = formData.get("role") as string;
  const fullName = formData.get("full_name") as string;

  if (!email || !role) {
    return { success: false, error: "メールアドレスとロールは必須です" };
  }

  const validRoles = ["admin", "worker_internal", "worker_external", "orderer"];
  if (!validRoles.includes(role)) {
    return { success: false, error: "無効なロールです" };
  }

  try {
    const adminClient = createAdminClient();

    // Create user with Supabase Auth Admin API
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName || email.split("@")[0] },
      });

    if (createError) {
      if (createError.message.includes("already been registered")) {
        return { success: false, error: "このメールアドレスは既に登録されています" };
      }
      return { success: false, error: createError.message };
    }

    if (newUser?.user) {
      // Update profile role
      await adminClient
        .from("profiles")
        .upsert({
          id: newUser.user.id,
          role,
          is_active: true,
        });
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    console.error("Invite user error:", err);
    return { success: false, error: "ユーザーの招待に失敗しました" };
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  await verifyAdmin();

  const validRoles = ["admin", "worker_internal", "worker_external", "orderer"];
  if (!validRoles.includes(newRole)) {
    return { success: false, error: "無効なロールです" };
  }

  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    console.error("Update role error:", err);
    return { success: false, error: "ロールの更新に失敗しました" };
  }
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  await verifyAdmin();

  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("profiles")
      .update({ is_active: isActive })
      .eq("id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    console.error("Toggle active error:", err);
    return { success: false, error: "ステータスの更新に失敗しました" };
  }
}
