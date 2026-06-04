export default function DashboardPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-brand-700 tracking-tight">
          Leadgen LT
        </h1>
        <p className="mt-2 text-lg text-gray-500">
          Lithuanian B2B Lead Generation System
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        <StatCard label="Companies synced" value="—" />
        <StatCard label="Leads enriched" value="—" />
        <StatCard label="Emails sent" value="—" />
      </div>

      <p className="mt-6 text-sm text-gray-400">
        Dashboard under construction — Phase 1
      </p>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center">
      <div className="text-3xl font-semibold text-brand-600">{value}</div>
      <div className="mt-1 text-sm text-gray-500">{label}</div>
    </div>
  );
}
