import { MoreActionsMenu } from '@/components/more-actions-menu'
import { Button } from '@/components/ui/button'

type ActionBarProps = {
  onAutoDraft: () => void
}

export function ActionBar({ onAutoDraft }: ActionBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" onClick={onAutoDraft} className="min-w-[126px]">
        Auto-draft
      </Button>
      <Button type="button" size="sm" variant="outline">
        Send preliminary
      </Button>
      <Button type="button" size="sm" variant="outline">
        Publish
      </Button>
      <MoreActionsMenu
        label="More"
        triggerClassName="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary/70"
      >
        <button
          type="button"
          className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm hover:bg-muted/60"
        >
          Duplicate cycle
        </button>
        <a
          href="/coverage?view=week"
          className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted/60 hover:no-underline"
        >
          Open live coverage
        </a>
      </MoreActionsMenu>
    </div>
  )
}
