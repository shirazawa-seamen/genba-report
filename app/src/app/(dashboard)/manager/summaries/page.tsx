import { redirect } from "next/navigation";

// /manager/summaries は /manager/reports に統合されました
export default function ManagerSummariesPage() {
  redirect("/manager/reports");
}
