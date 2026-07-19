'use client'

import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function StaffSchedulePrintButton() {
  return (
    <Button size="sm" variant="ghost" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden="true" />
      Print 6-week schedule
    </Button>
  )
}
