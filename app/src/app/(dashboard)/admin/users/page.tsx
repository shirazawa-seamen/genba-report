import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserManagement } from "@/components/admin/UserManagement";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  // Fetch profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .order("created_at", { ascending: false });

  // Get user emails from admin API
  let usersWithEmail = (profiles ?? []).map((p) => ({
    ...p,
    email: undefined as string | undefined,
    full_name: undefined as string | undefined,
  }));

  try {
    const adminClient = createAdminClient();
    const { data: authUsers } = await adminClient.auth.admin.listUsers();

    if (authUsers?.users) {
      const emailMap = new Map(
        authUsers.users.map((u) => [
          u.id,
          {
            email: u.email,
            full_name:
              u.user_metadata?.full_name ?? u.user_metadata?.name ?? undefined,
          },
        ])
      );

      usersWithEmail = usersWithEmail.map((p) => {
        const authData = emailMap.get(p.id);
        return {
          ...p,
          email: authData?.email,
          full_name: authData?.full_name,
        };
      });
    }
  } catch (err) {
    console.error("Failed to fetch auth users:", err);
  }

  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        {/* Back */}
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#00D9FF]/60 hover:text-[#00D9FF] transition-colors mb-6 w-fit min-h-[44px]"
        >
          <ArrowLeft size={14} /> 管理者ダッシュボード
        </Link>

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00D9FF]">
            <Users size={24} className="text-[#0e0e0e]" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-white/95 tracking-tight">
              ユーザー管理
            </h1>
            <p className="text-[13px] text-white/40">
              {usersWithEmail.length}人のユーザー
            </p>
          </div>
        </div>

        <UserManagement users={usersWithEmail} />
      </div>
    </div>
  );
}
