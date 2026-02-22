import type { ReactNode } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type EmptyStateProps = {
  title: string
  description: string
  actions?: ReactNode
  className?: string
}

export function EmptyState({ title, description, actions, className }: EmptyStateProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {actions && <CardContent>{actions}</CardContent>}
    </Card>
  )
}
