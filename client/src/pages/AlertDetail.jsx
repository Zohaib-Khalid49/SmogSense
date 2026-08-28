import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  BellOff,
  ChevronLeft,
  Loader2,
  Route as RouteIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { BAND_CONFIG, CONFIDENCE_LABEL, formatUpdatedAt } from '@/lib/hazard'
import { getAlertDetail } from '@/api/mockApi'

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

  return (
    <div className="flex flex-col gap-5">
      {/* Back nav */}
      <Link
        to="/"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to Home
      </Link>

      {/* Alert header */}
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Bell className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-bold">Alert Detail</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatUpdatedAt(alert.triggeredAt)}
        </p>
      </header>

      {/* Why the alert fired */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-5">
          <p className="text-sm font-medium">Why this alert was sent</p>
          <p className="text-sm text-muted-foreground">{alert.reason}</p>
          <Badge variant="secondary" className="self-start">
            {alert.type === 'threshold_change'
              ? 'Band changed'
              : 'Scheduled (7 AM)'}
          </Badge>
        </CardContent>
      </Card>

      {/* Hazard status at time of alert */}
      <div
        className={`overflow-hidden rounded-[var(--radius-card)] shadow-md ring-1 ${cfg.ring}`}
      >
        <div className={`px-6 py-5 text-white ${cfg.bg}`}>
          <p className="text-sm font-medium opacity-90">{alert.location}</p>
          <h2 className="text-3xl font-extrabold tracking-tight">
            {cfg.label}
          </h2>
          <p className="text-sm opacity-90">{cfg.tagline}</p>
        </div>
        <div className="flex flex-col gap-3 bg-card p-5 text-card-foreground">
          <p className="text-sm leading-relaxed">{alert.recommendation}</p>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">PM2.5</span>
              <span className="text-lg font-semibold">
                {alert.pm25}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  µg/m³
                </span>
              </span>
            </div>
            <Badge variant="secondary">
              {CONFIDENCE_LABEL[alert.confidence] ?? 'Model-based estimate'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          onClick={() => setSnoozed(true)}
          disabled={snoozed}
          className="gap-1.5"
        >
          <BellOff className="size-4" />
          {snoozed ? 'Snoozed for today' : 'Snooze alerts for today'}
        </Button>

        <Button asChild className="gap-1.5">
          <Link to="/route">
            <RouteIcon className="size-4" />
            Plan a safer trip
          </Link>
        </Button>
      </div>
    </div>
  )
}
