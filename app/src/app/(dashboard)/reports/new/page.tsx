import { DailyReportForm } from "@/components/reports/DailyReportForm";
import { fetchSites, fetchWorkers } from "./actions";

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
