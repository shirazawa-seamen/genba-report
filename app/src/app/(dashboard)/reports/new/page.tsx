import dynamic from "next/dynamic";
import { fetchSites, fetchWorkers } from "./actions";

const DailyReportForm = dynamic(
  () => import("@/components/reports/DailyReportForm").then((m) => ({ default: m.DailyReportForm })),
  {
    loading: () => (
      <div className="p-5 space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
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
