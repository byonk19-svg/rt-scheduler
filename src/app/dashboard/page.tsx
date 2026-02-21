import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  console.log('DEBUG user.id:', user.id)
  console.log('DEBUG user.email:', user.email)
  console.log('DEBUG profile:', JSON.stringify(profile))
  console.log('DEBUG profileError:', JSON.stringify(profileError))

  if (profileError) {
    console.error('Profile fetch error:', profileError.message, profileError.code)
  }

  const displayName = profile?.full_name ?? user.email ?? 'there'
  const isManager = profile?.role === 'manager'

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Welcome, {displayName}
            </h1>
            {profile ? (
              <p className="text-slate-500 capitalize">
                {profile.role} · {profile.shift_type} shift
              </p>
            ) : (
              <p className="text-sm text-amber-600 mt-1">
                Profile not found — your account may still be setting up.
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
          {isManager && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm md:col-span-3">
              <h2 className="font-semibold text-slate-700">Manage Schedules</h2>
              <p className="text-sm text-slate-400 mt-1">Build and publish 6-week schedule cycles</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}