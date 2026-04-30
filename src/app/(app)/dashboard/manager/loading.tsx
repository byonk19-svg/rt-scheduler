import { Skeleton, SkeletonLine } from '@/components/ui/skeleton'

function MetricTileSkeleton() {
  return (
    <div className="rounded-[24px] border border-border/70 bg-card/95 px-5 py-4 shadow-tw-metric">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <div className="mt-5 space-y-2">
        <Skeleton className="h-10 w-12" />
        <SkeletonLine className="w-24" />
      </div>
    </div>
  )
}

function SurfaceCardSkeleton({ titleClassName, rows }: { titleClassName: string; rows: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card px-5 py-5 shadow-tw-float-tight">
      <Skeleton className={titleClassName} />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border/60 bg-card px-3 py-3">
            <Skeleton className="h-3 w-32" />
            <SkeletonLine className="mt-2 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ManagerDashboardLoading() {
  return (
    <div className="max-w-[1120px] space-y-4 px-5 py-5 xl:px-7">
      <div className="rounded-[26px] border border-border/70 bg-card px-5 py-5 shadow-tw-inbox-hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-32" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-11 w-36 rounded-lg" />
            <Skeleton className="h-11 w-32 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTileSkeleton />
            <MetricTileSkeleton />
            <MetricTileSkeleton />
          </div>

          <div className="rounded-[26px] border border-border/70 bg-card px-5 py-5 shadow-tw-panel">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-5 w-40" />
              </div>
              <Skeleton className="h-10 w-20 rounded-full" />
            </div>
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-border/60 bg-card px-4 py-4">
                <Skeleton className="h-4 w-24" />
                <SkeletonLine className="mt-2 w-32" />
                <Skeleton className="mt-5 h-2 w-full rounded-full" />
              </div>
              <div className="rounded-xl border border-border/60 bg-card px-4 py-4">
                <Skeleton className="h-4 w-24" />
                <SkeletonLine className="mt-2 w-32" />
                <Skeleton className="mt-5 h-2 w-full rounded-full" />
              </div>
            </div>
          </div>

          <SurfaceCardSkeleton titleClassName="h-3 w-28" rows={5} />
          <SurfaceCardSkeleton titleClassName="h-3 w-24" rows={4} />
        </div>

        <div className="space-y-4">
          <SurfaceCardSkeleton titleClassName="h-3 w-24" rows={3} />
          <SurfaceCardSkeleton titleClassName="h-3 w-20" rows={3} />
        </div>
      </div>
    </div>
  )
}
