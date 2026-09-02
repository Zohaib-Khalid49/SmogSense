import { useState, useEffect, useRef } from 'react'
import { Bell, BellOff, X, Loader2, CheckCircle2, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  isPushSupported,
  isPermissionGranted,
  isPushDismissed,
  dismissPush,
  resetPushDismissed,
  requestPermission,
  getFcmToken,
  onFcmTokenRefresh,
  registerAllProfiles,
} from '@/lib/push'

/**
 * Notification permission banner.
 * Always visible when push is supported and profiles exist.
 * Shows different states: prompt, enabled, disabled.
 *
 * @param {Object} props
 * @param {Array} props.profiles - user's profiles (for device registration)
 * @param {string} [props.className]
 */
export default function NotificationPermission({ profiles = [], className }) {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const cancelRef = useRef(false)

  // Check on mount
  useEffect(() => {
    let mounted = true

    async function checkVisibility() {
      const supported = await isPushSupported()
      if (!supported) {
        console.log('[NotificationPermission] Hidden: push not supported')
        return
      }

      if (profiles.length === 0) {
        console.log('[NotificationPermission] Hidden: no profiles')
        return
      }

      const granted = isPermissionGranted()
      const dismissed = isPushDismissed()
      setPermissionGranted(granted)
      setIsDismissed(dismissed)

      console.log('[NotificationPermission] Showing, granted:', granted, 'dismissed:', dismissed)
      if (mounted) setVisible(true)
    }

    console.log('[NotificationPermission] Checking visibility, profiles:', profiles.length)
    checkVisibility()
    return () => { mounted = false }
  }, [profiles.length])

  async function handleEnable() {
    setLoading(true)
    setErrorMsg(null)
    cancelRef.current = false

    try {
      console.log('[push] Requesting permission...')
      const granted = await requestPermission()
      if (!granted) {
        console.log('[push] Permission denied')
        setErrorMsg('Permission denied. Please allow notifications in browser settings.')
        setLoading(false)
        return
      }
      console.log('[push] Permission granted')

      if (cancelRef.current) {
        setLoading(false)
        return
      }

      console.log('[push] Getting FCM token...')
      let swRegistration = null
      if ('serviceWorker' in navigator) {
        try {
          swRegistration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) => setTimeout(() => reject(new Error('SW not ready')), 5000)),
          ])
        } catch {
          console.warn('[push] SW not ready, continuing without it')
        }
      }

      const token = await getFcmToken(swRegistration)
      console.log('[push] FCM token received:', token ? 'yes' : 'no')

      if (cancelRef.current) {
        setLoading(false)
        return
      }

      if (!token) {
        setErrorMsg('Could not get push token. Check Firebase config.')
        setLoading(false)
        return
      }

      console.log('[push] Registering profiles:', profiles.length)
      const { success, failed } = await registerAllProfiles(profiles, token)
      console.log(`[push] Registered ${success} profiles (${failed} failed)`)

      if (failed > 0 && success === 0) {
        setErrorMsg('Could not register profiles with backend.')
        setLoading(false)
        return
      }

      onFcmTokenRefresh(async (newToken) => {
        await registerAllProfiles(profiles, newToken)
      })

      setPermissionGranted(true)
      setIsDismissed(false)
      resetPushDismissed()
      console.log('[push] Setup complete!')
    } catch (err) {
      console.error('[push] Setup failed:', err)
      setErrorMsg(`Setup failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    cancelRef.current = true
    setLoading(false)
  }

  function handleDisable() {
    dismissPush()
    setIsDismissed(true)
    setPermissionGranted(false)
  }

  function handleClose() {
    setVisible(false)
  }

  if (!visible) return null

  // Compact view when dismissed
  if (isDismissed && !permissionGranted) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm',
          className,
        )}
        role="region"
        aria-label="Notification settings"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-full bg-muted">
            <BellOff className="size-3.5 text-muted-foreground" />
          </div>
          <span className="text-sm text-muted-foreground">Notifications disabled</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setIsDismissed(false)
            resetPushDismissed()
          }}
          className="gap-1.5"
        >
          <Settings className="size-3.5" />
          Enable
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm',
        className,
      )}
      role="region"
      aria-label="Notification permission"
    >
      {/* Close button */}
      <button
        type="button"
        onClick={handleClose}
        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>

      {/* Icon + heading */}
      <div className="flex items-center gap-2.5">
        <div className={cn(
          'flex size-9 items-center justify-center rounded-full',
          permissionGranted ? 'bg-green-500/10' : 'bg-primary/10'
        )}>
          {permissionGranted ? (
            <CheckCircle2 className="size-4 text-green-600" />
          ) : (
            <Bell className="size-4 text-primary" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">
            {permissionGranted ? 'Notifications enabled' : 'Get air quality alerts'}
          </span>
          <span className="text-xs text-muted-foreground">
            {permissionGranted
              ? 'You\'ll receive push notifications for air quality changes'
              : 'Push notifications when air quality worsens for your profiles'}
          </span>
        </div>
      </div>

      {/* Error message */}
      {errorMsg && (
        <p className="text-xs text-destructive">{errorMsg}</p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {loading ? (
          <>
            <Button size="sm" disabled className="gap-1.5">
              <Loader2 className="size-3.5 animate-spin" />
              Setting up…
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              className="gap-1.5"
            >
              Cancel
            </Button>
          </>
        ) : permissionGranted ? (
          <Button
            size="sm"
            variant="outline"
            onClick={handleDisable}
            className="gap-1.5"
          >
            <BellOff className="size-3.5" />
            Disable notifications
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              onClick={handleEnable}
              className="gap-1.5 shadow-sm"
            >
              <Bell className="size-3.5" />
              Enable notifications
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDisable}
              className="gap-1.5 text-muted-foreground"
            >
              <BellOff className="size-3.5" />
              No thanks
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
