export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-8">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-800">RT Scheduler</h1>
        <p className="text-slate-500">Respiratory Therapy Scheduling Platform</p>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            ✅ App is running. Database connection will be verified in Step 2.
          </p>
        </div>
      </div>
    </main>
  )
}