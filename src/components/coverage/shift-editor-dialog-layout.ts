export const shiftEditorDialogLayout = {
  dialogContent:
    'flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden px-0 pb-0 pt-0 sm:max-w-[560px]',
  header: 'sticky top-0 z-10 gap-1.5 border-b border-border bg-background px-4 pb-2.5 pt-3',
  title: 'font-heading text-[1.25rem] font-bold tracking-[-0.04em] text-foreground',
  shiftLabel: 'text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground',
  activeSummary: 'text-[12px] font-semibold text-[var(--success-text)]',
  body: 'flex-1 space-y-3 overflow-y-auto px-4 py-3',
  section: 'space-y-1.5',
  rowList: 'space-y-1',
  row: 'flex items-center gap-2 rounded-[16px] border px-3 py-2 transition-colors',
  avatar:
    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-extrabold text-muted-foreground',
  name: 'truncate text-[14px] font-semibold text-foreground',
  meta: 'mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground',
  leadBadge:
    'rounded-full border border-[var(--info-border)] bg-[var(--info-subtle)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--info-text)]',
  action:
    'inline-flex h-9 min-w-[82px] shrink-0 items-center justify-center rounded-full border px-3 text-[11px] font-semibold transition-colors',
  alert: 'rounded-xl px-3 py-2 text-[12px]',
} as const
