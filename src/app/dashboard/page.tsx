import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

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
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Welcome, {profile.full_name}</h1>
            <p className="text-slate-500 capitalize">
              {profile.role} - {profile.shift_type} shift
            </p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm text-slate-500 underline hover:text-slate-800"
            >
              Sign out
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-700">My Schedule</h2>
            <p className="mt-1 text-sm text-slate-400">View your upcoming shifts</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-700">Availability</h2>
            <p className="mt-1 text-sm text-slate-400">Submit days you cannot work</p>
            <Link href="/availability" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
              Open availability requests
            </Link>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-700">Shift Board</h2>
            <p className="mt-1 text-sm text-slate-400">Swap or pick up shifts</p>
          </div>
        </div>
      </div>
    </main>
  )
}
