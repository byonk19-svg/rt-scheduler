function DashboardCardSkeleton() {
  return <div className="h-28 rounded-[24px] border border-border/70 bg-card/70" />
}

export default function ManagerDashboardLoading() {
  return (
    <div className="max-w-[1120px] space-y-4 px-5 py-5 xl:px-7">
      <div className="h-36 rounded-[26px] border border-border/70 bg-card/80" />
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <DashboardCardSkeleton />
            <DashboardCardSkeleton />
            <DashboardCardSkeleton />
          </div>
          <div className="h-72 rounded-[26px] border border-border/70 bg-card/80" />
          <div className="h-64 rounded-[26px] border border-border/70 bg-card/80" />
        </div>
        <div className="space-y-4">
          <div className="h-56 rounded-[26px] border border-border/70 bg-card/80" />
          <div className="h-44 rounded-[26px] border border-border/70 bg-card/80" />
        </div>
      </div>
    </div>
  )
}
