import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-800">RT Scheduler</h1>
          <p className="text-slate-500">Respiratory Therapy Scheduling Platform</p>
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="w-full inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Create Account
          </Link>
        </div>
      </div>
    </main>
  )
}