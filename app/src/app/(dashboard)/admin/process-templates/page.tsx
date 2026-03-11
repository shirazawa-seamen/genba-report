import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProcessTemplateManager } from "@/components/admin/ProcessTemplateManager";
import { listProcessCategories } from "@/lib/processCategories";
import { listProcessTemplates } from "@/lib/processTemplates";

export default async function ProcessTemplatesPage() {
  const [templates, categories] = await Promise.all([
    listProcessTemplates(),
    listProcessCategories(),
  ]);

  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 overflow-x-hidden">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="mb-6 inline-flex min-h-[44px] items-center gap-1.5 text-[13px] text-[#0EA5E9]/60 transition-colors hover:text-[#0EA5E9]"
        >
          <ArrowLeft size={14} />
          管理者ダッシュボード
        </Link>

        <div className="mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">
              標準工程マスター
            </h1>
            <p className="text-[13px] text-gray-400">
              一般住宅の標準工程を、時系列と並行作業のまとまりで管理します。
            </p>
          </div>
        </div>

        <ProcessTemplateManager
          initialTemplates={templates}
          initialCategories={categories}
        />
      </div>
    </div>
  );
}
