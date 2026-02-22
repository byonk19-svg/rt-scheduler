import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-8">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-800">RT Scheduler</h1>
        <p className="text-slate-500">Respiratory Therapy Scheduling Platform</p>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <p className="text-sm text-slate-600">✅ App is running. You can sign in or create an account.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Create Account
            </Link>
          </div>

          <Link href="/dashboard" className="block text-sm text-blue-600 hover:underline">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
