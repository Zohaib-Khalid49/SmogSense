import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/components/AppLayout'
import Home from '@/pages/Home'
import ProfileSetup from '@/pages/ProfileSetup'
import RouteCheck from '@/pages/RouteCheck'
import AlertDetail from '@/pages/AlertDetail'
import Welcome from '@/pages/Welcome'
import { hasOnboarded } from '@/lib/storage'

/**
 * Gate that redirects first-time users to the Welcome screen before
 * they can reach the main app.
 */
function RequireOnboarding({ children }) {
  if (!hasOnboarded()) {
    return <Navigate to="/welcome" replace />
  }
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Onboarding — standalone, no bottom nav, but same chrome as the app */}
        <Route
          path="/welcome"
          element={
            <div className="relative mx-auto flex min-h-svh w-full max-w-md flex-col overflow-hidden bg-background sm:max-w-lg lg:my-6 lg:min-h-0 lg:h-[calc(100svh-3rem)] lg:max-h-[900px] lg:rounded-3xl lg:border lg:border-border lg:shadow-2xl">
              {/* Layered ambient background — gives the onboarding screen depth
                  and warmth instead of a flat gray field. Soft brand-colored
                  blobs, kept low-opacity so content stays legible. */}
              <div
                className="pointer-events-none absolute -top-28 -left-16 size-72 rounded-full opacity-30 blur-3xl"
                style={{
                  background:
                    'radial-gradient(circle, var(--safe) 0%, transparent 70%)',
                }}
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -top-16 -right-20 size-64 rounded-full opacity-25 blur-3xl"
                style={{
                  background:
                    'radial-gradient(circle, var(--caution) 0%, transparent 70%)',
                }}
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute bottom-0 left-1/2 size-80 -translate-x-1/2 translate-y-1/3 rounded-full opacity-20 blur-3xl"
                style={{
                  background:
                    'radial-gradient(circle, var(--primary) 0%, transparent 70%)',
                }}
                aria-hidden="true"
              />
              {/* Top header bar — matches AppLayout */}
              <header className="z-40 flex items-center gap-2 border-b border-border/50 bg-background/80 px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-lg">
                <img src="/favicon.svg" alt="" className="size-7" aria-hidden="true" />
                <span className="text-base font-bold tracking-tight">SmogSense</span>
              </header>
              {/* Scrollable content */}
              <main className="scrollbar-none relative flex flex-1 flex-col overflow-y-auto px-5 pb-6 pt-5">
                <Welcome />
              </main>
            </div>
          }
        />

        {/* Main app — gated behind onboarding */}
        <Route
          element={
            <RequireOnboarding>
              <AppLayout />
            </RequireOnboarding>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/setup" element={<ProfileSetup />} />
          <Route path="/route" element={<RouteCheck />} />
          <Route path="/alert" element={<AlertDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
