import type { ReactNode } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type EmptyStateProps = {
  title: string
  description: string
  illustration?: ReactNode
  actions?: ReactNode
  className?: string
}

export function EmptyState({ title, description, illustration, actions, className }: EmptyStateProps) {
  return (
    <Card className={className}>
      <CardHeader>
        {illustration && <div className="mb-2">{illustration}</div>}
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {actions && <CardContent>{actions}</CardContent>}
    </Card>
  )
}
