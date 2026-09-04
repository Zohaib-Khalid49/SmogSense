import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  BellOff,
  Loader2,
  Route as RouteIcon,
  AlertTriangle,
  Gauge,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  BAND_CONFIG,
  BAND_GRADIENT,
  CONFIDENCE_LABEL,
  formatUpdatedAt,
} from '@/lib/hazard'
import { getAlertDetail, getHazardStatus } from '@/api/client'
import {
  getAlertPayload,
  onForegroundMessage,
  storeAlertPayload,
  clearAlertUnread,
} from '@/lib/push'

/**
 * Map a push payload severity/band to the client-side band string.
 */
function bandFromPayload(data) {
  // Backend sends hazard_band in data payload
  if (data.band) return data.band
  if (data.severity === 'danger') return 'hazard'
  if (data.severity === 'warning') return 'hazard'
  if (data.severity === 'caution') return 'caution'
  return 'hazard' // default for alerts
}

/**
 * Build a human-readable reason string from the push payload.
 */
function reasonFromPayload(data) {
  const bandLabel = bandFromPayload(data)
  return `Air quality has worsened to ${bandLabel} level for one or more of your profiles.`
}

export default function AlertDetail() {
  const [alert, setAlert] = useState(null)
  const [snoozed, setSnoozed] = useState(false)
  const [noAlert, setNoAlert] = useState(false)

  const loading = alert === null && !noAlert

  /**
   * Enrich a push payload with live hazard data to build the full alert shape.
   */
  const enrichPayload = useCallback(async (payloadData) => {
    const base = {
      id: payloadData.id || 'push_' + Date.now(),
      reason: reasonFromPayload(payloadData),
      band: bandFromPayload(payloadData),
      triggeredAt: payloadData.timestamp || new Date().toISOString(),
      type: payloadData.type === 'daily_summary' ? 'scheduled' : 'threshold_change',
      // Defaults that will be overwritten by live data
      pm25: payloadData.pm25 ? Number(payloadData.pm25) : null,
      confidence: 'medium',
      recommendation: BAND_CONFIG[bandFromPayload(payloadData)]?.tagline || 'Check current conditions.',
      location: 'Lahore',
    }

    // Try to get fresh hazard data for richer display
    try {
      const liveStatus = await getHazardStatus({})
      if (liveStatus) {
        return {
          ...base,
          band: liveStatus.band || base.band,
          pm25: liveStatus.pm25 ?? base.pm25,
          confidence: liveStatus.confidence ?? base.confidence,
          recommendation: liveStatus.recommendation || base.recommendation,
          location: liveStatus.location || base.location,
        }
      }
    } catch {
      // Live data unavailable — use payload defaults
    }

    return base
  }, [])

  // Load alert data: sessionStorage payload first, then mock API
  useEffect(() => {
    let active = true

    async function loadAlert() {
      // 1. Check for push payload from notification tap (sessionStorage)
      const payload = getAlertPayload()
      if (payload) {
        const enriched = await enrichPayload(payload)
        if (active) setAlert(enriched)
        return
      }

      // 2. Fall back to mock API (or null in live mode)
      const data = await getAlertDetail()
      if (!active) return
      if (data === null) {
        setNoAlert(true)
      } else {
        setAlert(data)
      }
    }

    loadAlert()
    return () => { active = false }
  }, [enrichPayload])

  // Listen for foreground push messages (app is open when push arrives)
  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      const data = payload.data || {}
      if (data.type === 'hazard_alert' || data.type === 'daily_summary') {
        // Store for AlertDetail to pick up, then enrich and display
        storeAlertPayload(data)
        enrichPayload(data).then((enriched) => {
          setAlert(enriched)
          setNoAlert(false)
          // User is already viewing this alert — nothing left unread.
          clearAlertUnread()
        })
      }
    })
    return unsubscribe
  }, [enrichPayload])

  if (loading) {
    return (
      <div className="flex min-h-[60svh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // In live mode, alerts come via push notification payload only
  if (noAlert) {
    return (
      <div className="flex min-h-[55svh] flex-col items-center justify-center gap-5 py-10 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted/70 ring-8 ring-muted/30">
          <BellOff className="size-6 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold">You&apos;re all caught up</h2>
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
            No alerts right now. We&apos;ll send a push notification the moment
            air quality worsens for one of your profiles.
          </p>
        </div>
        <Button asChild className="gap-2 shadow-sm">
          <Link to="/">
            <Gauge className="size-4" />
            Check current air quality
          </Link>
        </Button>
      </div>
    )
  }

  const cfg = BAND_CONFIG[alert.band] ?? BAND_CONFIG.hazard
  const gradient = BAND_GRADIENT[alert.band] ?? BAND_GRADIENT.hazard

  return (
    <div className="flex flex-col gap-5">
      {/* Alert header */}
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-5 text-destructive" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-lg font-bold">Alert</h1>
          <p className="text-xs text-muted-foreground">
            {formatUpdatedAt(alert.triggeredAt)}
          </p>
        </div>
      </header>

      {/* Why the alert fired */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4">
          <p className="text-sm font-medium">Why this alert was sent</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {alert.reason}
          </p>
          <Badge variant="secondary" className="self-start text-[11px]">
            {alert.type === 'threshold_change'
              ? 'Band changed'
              : 'Scheduled (7 AM)'}
          </Badge>
        </CardContent>
      </Card>

      {/* Hazard status at time of alert — matches HazardCard style */}
      <div
        className={cn(
          'overflow-hidden rounded-[var(--radius-card)] shadow-xl ring-1',
          cfg.ring,
        )}
      >
        <div
          className={cn(
            'relative flex flex-col items-center gap-1.5 bg-gradient-to-br px-6 py-8 text-white',
            gradient,
          )}
        >
          <p className="text-sm font-medium opacity-90">{alert.location}</p>
          <h2 className="text-3xl font-extrabold tracking-tight drop-shadow-sm">
            {cfg.label}
          </h2>
          <p className="text-sm opacity-80">{cfg.tagline}</p>
        </div>
        <div className="flex flex-col gap-3 bg-card p-5 text-card-foreground">
          <p className="text-[15px] leading-relaxed">{alert.recommendation}</p>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                PM2.5
              </span>
              <span className="text-xl font-bold tabular-nums">
                {alert.pm25}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  µg/m³
                </span>
              </span>
            </div>
            <Badge variant="secondary" className="text-[11px]">
              {CONFIDENCE_LABEL[alert.confidence] ?? 'Model-based estimate'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2.5">
        <Button
          variant="outline"
          onClick={() => setSnoozed(true)}
          disabled={snoozed}
          className="gap-2 shadow-sm"
        >
          <BellOff className="size-4" />
          {snoozed ? 'Snoozed for today' : 'Snooze alerts for today'}
        </Button>

        <Button asChild className="gap-2 shadow-sm">
          <Link to="/route">
            <RouteIcon className="size-4" />
            Plan a safer trip
          </Link>
        </Button>
      </div>
    </div>
  )
}
