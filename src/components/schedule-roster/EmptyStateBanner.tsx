import { Button } from '@/components/ui/button'

type EmptyStateBannerProps = {
  onAutoDraft: () => void
  onOpenFirstDay: () => void
}

export function EmptyStateBanner({ onAutoDraft, onOpenFirstDay }: EmptyStateBannerProps) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-[var(--warning-border)] bg-[var(--warning-subtle)]/55 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
          No shifts assigned yet
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Use Auto-draft to prefill the cycle or open the first day to start assigning coverage one
          cell at a time. Everything on this screen is local mock state for now, so the interaction
          stays deterministic and testable.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={onAutoDraft}>
          Auto-draft
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onOpenFirstDay}>
          Open first day
        </Button>
      </div>
    </section>
  )
}
