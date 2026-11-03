import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminCouponsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-10 w-full sm:max-w-sm rounded-md" />
        </CardContent>
      </Card>

      {/* Coupons Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-28 rounded-md" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
