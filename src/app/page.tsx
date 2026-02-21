import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-2xl space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-slate-800">RT Scheduler</h1>
          <p className="text-slate-500">
            Respiratory therapy scheduling, availability requests, and shift board workflows.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">App is live. Sign in to access your dashboard.</p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/login"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
