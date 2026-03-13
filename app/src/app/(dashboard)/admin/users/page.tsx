import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserManagement } from "@/components/admin/UserManagement";
import { listCompanies } from "@/lib/companies";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUserContext } from "@/lib/auth/getCurrentUserContext";

export default async function AdminUsersPage() {
  const { role } = await requireUserContext();
  if (role !== "admin" && role !== "manager") redirect("/");
  // Use admin client to fetch profiles (bypasses RLS) and auth users
  let usersWithEmail: {
    id: string;
    role: string;
    is_active: boolean | null;
    email?: string;
    full_name?: string;
    company_id?: string | null;
    company_name?: string | null;
  }[] = [];
  let companies: { id: string; name: string }[] = [];
  let fetchError: string | null = null;

  try {
    const adminClient = createAdminClient();
    companies = await listCompanies();
    const companyMap = new Map(companies.map((company) => [company.id, company.name]));

    // Fetch profiles via admin client (bypasses RLS)
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id, role, is_active, full_name, company_id")
      .order("created_at", { ascending: false });

    if (profilesError) {
      console.error("Profiles fetch error:", profilesError);
      fetchError = `プロフィール取得エラー: ${profilesError.message}`;
    }

    // Get user emails from auth admin API (paginated - get up to 1000)
    const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

    if (authError) {
      console.error("Auth users fetch error:", authError);
    }

    const emailMap = new Map(
      (authUsers?.users ?? []).map((u) => [
        u.id,
        {
          email: u.email,
          full_name:
            u.user_metadata?.full_name ?? u.user_metadata?.name ?? undefined,
        },
      ])
    );

    usersWithEmail = (profiles ?? []).map((p) => {
      const authData = emailMap.get(p.id);
      return {
        id: p.id,
        role: p.role ?? "worker_internal",
        is_active: p.is_active ?? true,
        email: authData?.email,
        full_name: p.full_name || authData?.full_name,
        company_id: p.company_id ?? null,
        company_name: p.company_id ? companyMap.get(p.company_id) ?? null : null,
      };
    });
  } catch (err) {
    console.error("Failed to fetch users:", err);
    fetchError = "ユーザー情報の取得に失敗しました。SUPABASE_SERVICE_ROLE_KEY が正しく設定されているか確認してください。";
  }

  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        {/* Back */}
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#0EA5E9]/60 hover:text-[#0EA5E9] transition-colors mb-6 w-fit min-h-[44px]"
        >
          <ArrowLeft size={14} /> 管理者ダッシュボード
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">
              ユーザー管理
            </h1>
            <p className="text-[13px] text-gray-400">
              {usersWithEmail.length}人のユーザー
            </p>
          </div>
        </div>

        {fetchError && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4">
            <p className="text-[13px] text-red-400">{fetchError}</p>
          </div>
        )}

        <UserManagement users={usersWithEmail} companies={companies} />
      </div>
    </div>
  );
}
