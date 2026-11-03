import { Skeleton } from "@/components/ui/skeleton";

export default function OrderShippingLabelLoading() {
  return (
    <div className="min-h-screen bg-slate-100/70 p-4 sm:p-8 flex flex-col items-center animate-in fade-in-50 duration-150">
      <div className="w-full max-w-[105mm] sm:max-w-xl mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      <div
        className="bg-white border-2 border-slate-300 rounded-none p-4 space-y-4"
        style={{ width: "100mm", minHeight: "150mm" }}
      >
        <Skeleton className="h-12 w-full bg-slate-200" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}

