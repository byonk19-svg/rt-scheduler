'use client'

type PrintMenuItemProps = {
  label?: string
}

export function PrintMenuItem({ label = 'Print' }: PrintMenuItemProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="block h-11 w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary"
    >
      {label}
    </button>
  )
}
