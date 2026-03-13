import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CompanyManager } from "@/components/admin/CompanyManager";
import { listCompanies } from "@/lib/companies";
import { requireUserContext } from "@/lib/auth/getCurrentUserContext";

export default async function CompaniesPage() {
  const { role } = await requireUserContext();
  if (role !== "admin" && role !== "manager") redirect("/");

  const companies = await listCompanies();

  return (
    <div className="flex-1 overflow-x-hidden px-5 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/admin"
          className="mb-6 inline-flex min-h-[44px] items-center gap-1.5 text-[13px] text-[#0EA5E9]/60 transition-colors hover:text-[#0EA5E9]"
        >
          <ArrowLeft size={14} />
          管理者ダッシュボード
        </Link>

        <div className="mb-6">
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">
            会社マスター
          </h1>
          <p className="text-[13px] text-gray-400">
            ユーザーと現場で使う会社名を管理します。
          </p>
        </div>

        <CompanyManager initialCompanies={companies} />
      </div>
    </div>
  );
}
