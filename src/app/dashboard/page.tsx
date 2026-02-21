import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type Profile = {
  full_name: string | null
  role: string | null
  shift_type: string | null
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, role, shift_type')
    .eq('id', user.id)
    .maybeSingle<Profile>()

  let resolvedProfile = profile

  // If no profile row exists yet, create one from auth metadata.
  if (!resolvedProfile) {
    const profileToCreate = {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Therapist',
      role: user.user_metadata?.role ?? 'therapist',
      shift_type: user.user_metadata?.shift_type ?? 'day',
    }

    const { data: insertedProfile } = await supabase
      .from('profiles')
      .upsert(profileToCreate, { onConflict: 'id' })
      .select('full_name, role, shift_type')
      .maybeSingle<Profile>()

    resolvedProfile = insertedProfile
  }

  // Fallback keeps dashboard usable even if profile query is blocked by RLS.
  const displayName =
    resolvedProfile?.full_name ??
    user.user_metadata?.full_name ??
    user.email?.split('@')[0] ??
    'Therapist'

  const displayRole = resolvedProfile?.role ?? user.user_metadata?.role ?? 'therapist'
  const displayShiftType = resolvedProfile?.shift_type ?? user.user_metadata?.shift_type ?? 'day'

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Welcome, {displayName} 👋</h1>
            <p className="text-slate-500 capitalize">
              {displayRole} · {displayShiftType} shift
            </p>
            {profileError && (
              <p className="text-xs text-amber-600 mt-2">
                Profile sync issue detected. Showing account metadata while you finish database
                policies.
              </p>
            )}
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm text-slate-500 hover:text-slate-800 underline"
            >
              Sign out
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-700">My Schedule</h2>
            <p className="text-sm text-slate-400 mt-1">View your upcoming shifts</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-700">Availability</h2>
            <p className="text-sm text-slate-400 mt-1">Submit days you can&apos;t work</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-700">Shift Board</h2>
            <p className="text-sm text-slate-400 mt-1">Swap or pick up shifts</p>
          </div>
        </div>
      </div>
    </main>
  )
}
