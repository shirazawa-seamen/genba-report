import { redirect } from "next/navigation";

// /sites/[siteId]/reports は /manager/reports?site=[siteId] に統合
interface PageProps {
  params: Promise<{ siteId: string }>;
}

export default async function SiteReportsPage({ params }: PageProps) {
  const { siteId } = await params;
  redirect(`/manager/reports?site=${siteId}`);
}
