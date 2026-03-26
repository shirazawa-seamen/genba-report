import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[50vh]">
      <Loader2 size={32} className="animate-spin text-[#0EA5E9]" />
    </div>
  );
}
