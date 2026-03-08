import { cn } from '@/lib/utils'

/**
 * Base shimmer block. Compose these to build page-level skeletons.
 * Wraps a pulse animation; respects prefers-reduced-motion via CSS.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}

/** A single horizontal line skeleton (text placeholder). */
export function SkeletonLine({ className }: { className?: string }) {
  return <Skeleton className={cn('h-3 w-full', className)} />
}

/** A card-shaped skeleton with configurable inner rows. */
export function SkeletonCard({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5 space-y-3', className)}>
      <Skeleton className="h-4 w-2/5" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine key={i} className={i === rows - 1 ? 'w-3/4' : 'w-full'} />
      ))}
    </div>
  )
}

/** A metric tile skeleton (icon + number + label). */
export function SkeletonMetricTile({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-2 rounded-lg bg-muted p-3', className)}>
      <Skeleton className="h-4 w-4 rounded-full" />
      <Skeleton className="h-5 w-10" />
      <Skeleton className="h-2.5 w-16" />
    </div>
  )
}

/** A list-item row skeleton (avatar + two lines of text). */
export function SkeletonListItem({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border bg-card p-4',
        className
      )}
    >
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-2.5 w-3/5" />
      </div>
    </div>
  )
}
