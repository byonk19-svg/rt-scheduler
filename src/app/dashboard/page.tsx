import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { TeamwiseLogo } from '@/components/teamwise-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type Profile = {
  id: string
  full_name: string
  email: string
  role: 'manager' | 'therapist'
  shift_type: 'day' | 'night'
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const fallbackProfile: Profile = {
    id: user.id,
    full_name: user.user_metadata?.full_name ?? 'New User',
    email: user.email ?? '',
    role: user.user_metadata?.role === 'manager' ? 'manager' : 'therapist',
    shift_type: user.user_metadata?.shift_type === 'night' ? 'night' : 'day',
  }

  const { data: existingProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, shift_type')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Failed to fetch profile on dashboard:', profileError)
  }

  let profile: Profile = fallbackProfile

  if (existingProfile) {
    profile = existingProfile as Profile
  } else {
    const { data: createdProfile, error: upsertError } = await supabase
      .from('profiles')
      .upsert(fallbackProfile, { onConflict: 'id' })
      .select('id, full_name, email, role, shift_type')
      .maybeSingle()

    if (upsertError) {
      console.error('Failed to upsert missing profile on dashboard:', upsertError)
    } else if (createdProfile) {
      profile = createdProfile as Profile
    }
  }

  return (
    <main className="min-h-screen bg-background p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border-2 border-border bg-card p-5 shadow-sm">
          <div>
            <TeamwiseLogo size="small" />
            <h1 className="text-3xl font-bold text-foreground">Welcome, {profile.full_name}</h1>
            <p className="text-muted-foreground capitalize">
              {profile.role} - {profile.shift_type} shift
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile.role === 'manager'
                ? 'Manager tools are available below.'
                : 'Therapist tools are available below.'}
            </p>
          </div>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">Sign out</Button>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {profile.role === 'manager' ? (
            <>
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <h2 className="font-semibold text-foreground">Schedule Management</h2>
                  <p className="text-sm text-muted-foreground">
                    Auto-generate drafts, fill holes with drag-and-drop, and publish schedules.
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/schedule">Open manager schedule tools</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <h2 className="font-semibold text-foreground">Availability Review</h2>
                  <p className="text-sm text-muted-foreground">
                    View all therapist requests and blackout dates.
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/availability">Review availability requests</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <h2 className="font-semibold text-foreground">Shift Board</h2>
                  <p className="text-sm text-muted-foreground">
                    Approve or deny swap and pickup requests.
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/shift-board">Review shift board</Link>
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <h2 className="font-semibold text-foreground">My Schedule</h2>
                  <p className="text-sm text-muted-foreground">View your upcoming shifts.</p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/schedule">Open schedule grid</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <h2 className="font-semibold text-foreground">Availability</h2>
                  <p className="text-sm text-muted-foreground">Submit days you cannot work.</p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/availability">Open availability requests</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <h2 className="font-semibold text-foreground">Shift Board</h2>
                  <p className="text-sm text-muted-foreground">Post swap or pickup requests.</p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/shift-board">Open shift board</Link>
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
