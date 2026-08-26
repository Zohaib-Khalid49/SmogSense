function App() {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold text-[var(--color-ink)]">
        SmogSense theme check
      </h1>

      {/* Hazard band color test */}
      <div className="flex w-full flex-col gap-3">
        <div className="rounded-[var(--radius-card)] bg-safe p-5 text-center font-semibold text-white shadow-md">
          Safe
        </div>
        <div className="rounded-[var(--radius-card)] bg-caution p-5 text-center font-semibold text-white shadow-md">
          Caution
        </div>
        <div className="rounded-[var(--radius-card)] bg-hazard p-5 text-center font-semibold text-white shadow-md">
          Hazardous
        </div>
      </div>

      <p className="text-sm text-[var(--color-muted)]">
        If these three bands are green, amber, and red with the Inter font, the
        theme is wired up correctly.
      </p>
    </div>
  )
}

export default App
