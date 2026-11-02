import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrderDetailLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in-50 duration-150">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-28 rounded-md" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-44 rounded-md" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-32 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      </div>

      {/* Two-Column 50/50 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column Skeleton */}
        <div className="space-y-6">
          {/* Order Items Card */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-4">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-md shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="pt-4 border-t border-border/40 space-y-2.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-12" />
                </div>
                <div className="flex justify-between pt-2 border-t border-border/40">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Verification Card */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-4">
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent className="pt-5 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-3.5 w-44 mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Right Column Skeleton */}
        <div className="space-y-6">
          {/* Customer Details Card */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-4">
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-3.5 w-36" />
            </CardContent>
          </Card>

          {/* Shipping Address Card */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-4">
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent className="pt-5 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3.5 w-56" />
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3.5 w-32" />
            </CardContent>
          </Card>

          {/* Packaging & Box Allocation Card */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-4 flex flex-row items-center justify-between">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-7 w-24 rounded-md" />
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Update Order Status Card */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-4">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
