import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { fetchSites, fetchWorkers } from "./actions";

const DailyReportForm = dynamic(
  () => import("@/components/reports/DailyReportForm").then((m) => ({ default: m.DailyReportForm })),
  {
    loading: () => (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <Loader2 size={32} className="animate-spin text-[#0EA5E9]" />
      </div>
    ),
  }
);

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId } = await searchParams;
  const [initialSites, initialWorkers] = await Promise.all([
    fetchSites(),
    fetchWorkers(),
  ]);

  return (
    <DailyReportForm
      initialSiteId={siteId}
      initialSites={initialSites}
      initialWorkers={initialWorkers}
    />
  );
}
