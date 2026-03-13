import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MaterialCatalogManager } from "./material-catalog-manager";

export default async function MaterialCatalogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "manager"].includes(profile.role)) redirect("/");

  const { data: materials } = await supabase
    .from("material_catalog")
    .select("*")
    .order("category", { ascending: true })
    .order("material_name", { ascending: true });

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .order("name");

  return (
    <div className="flex-1 px-5 py-8 md:px-8 md:py-10 overflow-x-hidden">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#0EA5E9]/60 hover:text-[#0EA5E9] transition-colors mb-6 w-fit min-h-[44px]"
        >
          <ArrowLeft size={14} /> 管理画面
        </Link>

        <div className="mb-8">
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">
            材料カタログ
          </h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            会社全体の材料マスターデータを管理
          </p>
        </div>

        <MaterialCatalogManager
          initialMaterials={(materials ?? []).map((m) => ({
            id: m.id as string,
            materialName: m.material_name as string,
            productNumber: (m.product_number as string) ?? "",
            unit: (m.unit as string) ?? "",
            supplier: (m.supplier as string) ?? "",
            category: (m.category as string) ?? "",
            note: (m.note as string) ?? "",
            companyId: (m.company_id as string) ?? "",
          }))}
          companies={(companies ?? []).map((c) => ({
            id: c.id as string,
            name: c.name as string,
          }))}
        />
      </div>
    </div>
  );
}
