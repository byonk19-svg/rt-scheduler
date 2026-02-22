import { redirect } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, role, shift_type')
    .eq('id', user.id)
    .maybeSingle()

  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? 'Team member'
  const email = profile?.email ?? user.email ?? 'No email on file'
  const role = profile?.role === 'manager' ? 'manager' : 'therapist'
  const shiftType = profile?.shift_type === 'night' ? 'night' : 'day'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Profile</h1>
        <p className="text-muted-foreground">Your account details and role configuration.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{fullName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium text-foreground">{email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="capitalize">{role}</Badge>
            <Badge variant="outline" className="capitalize">
              {shiftType} shift
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
