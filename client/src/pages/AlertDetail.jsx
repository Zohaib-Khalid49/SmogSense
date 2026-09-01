import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BellOff,
  Loader2,
  Route as RouteIcon,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { BAND_CONFIG, CONFIDENCE_LABEL, formatUpdatedAt } from '@/lib/hazard'
import { getAlertDetail } from '@/api/mockApi'

const BAND_GRADIENT = {
  safe: 'from-green-600 to-emerald-500',
  caution: 'from-amber-500 to-yellow-400',
  hazard: 'from-red-600 to-rose-500',
}

export default function AlertDetail() {
  const [alert, setAlert] = useState(null)
  const [snoozed, setSnoozed] = useState(false)

  const loading = alert === null

  useEffect(() => {
    let active = true
    getAlertDetail().then((data) => {
      if (active) setAlert(data)
    })
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[60svh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
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
