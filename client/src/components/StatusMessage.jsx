import {
  WifiOff,
  CloudOff,
  MapPinOff,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Reusable status message component for error, empty, and info states.
 * Used across screens whenever the backend returns an error or no data.
 *
 * @param {Object} props
 * @param {'error'|'noData'|'location'|'info'|'warning'} [props.type='error']
 * @param {string} props.message - the user-facing message
 * @param {string} [props.hint] - optional secondary text
 * @param {() => void} [props.onRetry] - if provided, shows a retry button
 * @param {string} [props.className]
 */

const ICON_MAP = {
  error: WifiOff,
  noData: CloudOff,
  location: MapPinOff,
  info: AlertCircle,
  warning: AlertTriangle,
}

const BG_MAP = {
  error: 'bg-destructive/5 border-destructive/20',
  noData: 'bg-muted/50 border-border',
  location: 'bg-caution/5 border-caution/20',
  info: 'bg-primary/5 border-primary/20',
  warning: 'bg-caution/5 border-caution/20',
}

const ICON_COLOR_MAP = {
  error: 'text-destructive',
  noData: 'text-muted-foreground',
  location: 'text-caution',
  info: 'text-primary',
  warning: 'text-caution',
}

export default function StatusMessage({
  type = 'error',
  message,
  hint,
  onRetry,
  className,
}) {
  const Icon = ICON_MAP[type] ?? AlertCircle

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-[var(--radius-card)] border px-6 py-8 text-center',
        BG_MAP[type] ?? BG_MAP.error,
        className,
      )}
      role="status"
    >
      <div
        className={cn(
          'flex size-12 items-center justify-center rounded-full bg-background',
          ICON_COLOR_MAP[type],
        )}
      >
        <Icon className="size-6" strokeWidth={1.8} />
      </div>

      <p className="text-sm font-medium">{message}</p>

      {hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}

      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-1 gap-1.5"
        >
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      )}
    </div>
  )
}
