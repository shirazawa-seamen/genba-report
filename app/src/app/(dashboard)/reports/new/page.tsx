import { DailyReportForm } from "@/components/reports/DailyReportForm";

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId } = await searchParams;
  return <DailyReportForm initialSiteId={siteId} />;
}
