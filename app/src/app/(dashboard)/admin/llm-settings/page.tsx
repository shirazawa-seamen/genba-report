import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LlmApiSettingsManager } from "@/components/admin/LlmApiSettingsManager";
import { getSecureSettingMeta } from "@/lib/secureSettings";
import { requireUserContext } from "@/lib/auth/getCurrentUserContext";

export default async function LlmSettingsPage() {
  const { role } = await requireUserContext();
  if (role !== "admin") redirect("/admin");

  const claudeMeta = await getSecureSettingMeta("claude_api_key");

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
            LLM API設定
          </h1>
          <p className="text-[13px] text-gray-400">
            サーバー処理で使う APIキーを暗号化して管理します。
          </p>
        </div>

        <LlmApiSettingsManager initialClaudeMeta={claudeMeta} />
      </div>
    </div>
  );
}
