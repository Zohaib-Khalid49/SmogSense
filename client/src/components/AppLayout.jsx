import { Outlet } from 'react-router-dom'
import BottomNav from '@/components/BottomNav'
import OfflineBanner from '@/components/OfflineBanner'

/**
 * Mobile-first app shell.
 * - Header: fixed top
 * - Main: scrollable content area
 * - BottomNav: fixed bottom (never scrolls)
 */
export default function AppLayout() {
  return (
    <div
      id="app-shell"
      className="relative mx-auto flex h-svh w-full max-w-md flex-col overflow-hidden bg-background sm:max-w-lg lg:my-6 lg:h-[calc(100svh-3rem)] lg:max-h-[900px] lg:rounded-3xl lg:border lg:border-border lg:shadow-2xl"
    >
      {/* Offline indicator banner — shown at the very top */}
      <OfflineBanner />

      {/* Subtle gradient blob behind content for depth */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-80 rounded-full opacity-20 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, var(--safe) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* Top header bar — fixed */}
      <header className="z-40 flex items-center gap-2 border-b border-border/50 bg-background/80 px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-lg">
        <img src="/favicon.svg" alt="" className="size-7" aria-hidden="true" />
        <span className="text-base font-bold tracking-tight">SmogSense</span>
      </header>

      {/* Page content — this is the only part that scrolls */}
      <main className="scrollbar-none relative flex-1 overflow-y-auto px-5 pb-4 pt-5">
        <Outlet />
      </main>

      {/* Bottom navigation — fixed, never scrolls */}
      <BottomNav />
    </div>
  )
}
