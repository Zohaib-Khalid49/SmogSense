import { Outlet } from 'react-router-dom'

/**
 * Mobile-first shell. Centers content in a phone-width column so the PWA
 * looks right on phones and stays readable on desktop.
 */
export default function AppLayout() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col bg-background">
      <main className="flex-1 p-5">
        <Outlet />
      </main>
    </div>
  )
}
