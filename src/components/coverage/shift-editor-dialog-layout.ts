export const shiftEditorDialogLayout = {
  dialogContent: 'max-h-[calc(100vh-2rem)] overflow-y-auto px-0 pb-0 pt-0 sm:max-w-[540px]',
  header: 'gap-1 border-b border-border px-4 pb-3 pt-4',
  title: 'font-heading text-[1.5rem] font-bold tracking-[-0.04em] text-foreground',
  shiftLabel: 'text-sm text-foreground/80',
  activeSummary: 'pt-1 text-sm font-semibold text-[var(--success-text)]',
  body: 'space-y-3.5 px-4 py-3.5',
  section: 'space-y-2',
  rowList: 'space-y-1.5',
  row: 'flex items-center gap-2 rounded-[18px] border px-3 py-2.5 transition-colors',
  avatar:
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-extrabold text-muted-foreground',
  name: 'truncate text-[15px] font-semibold text-foreground',
  meta: 'mt-0.5 flex flex-wrap items-center gap-1 text-[12px] text-muted-foreground',
  leadBadge:
    'rounded-md border border-[var(--info-border)] bg-[var(--info-subtle)] px-1 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--info-text)]',
  action:
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
  alert: 'rounded-xl px-3 py-2 text-[13px]',
} as const
