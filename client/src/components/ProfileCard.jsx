import {
  User,
  Baby,
  HeartPulse,
  PersonStanding,
  Wind,
  HardHat,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** Map profile icon name (string) → actual Lucide component */
const ICON_MAP = {
  User,
  Baby,
  HeartPulse,
  PersonStanding,
  Wind,
  HardHat,
}

/**
 * Per-profile icon accents.
 *
 * A category picker reads best when each option is visually distinct, so each
 * profile keeps its own icon tint. But rather than an arbitrary rainbow, these
 * are chosen as one cohesive, muted family (soft, low-saturation tones that sit
 * calmly next to each other and beside the app's slate chrome). The hazard
 * palette (--safe / --caution / --hazard) is deliberately NOT used here so
 * green/amber/red stay reserved for air-quality meaning, not decoration.
 */
const PROFILE_COLORS = {
  User: { bg: 'bg-sky-500/10', text: 'text-sky-700', activeBg: 'bg-sky-500/15' },
  Baby: { bg: 'bg-indigo-500/10', text: 'text-indigo-700', activeBg: 'bg-indigo-500/15' },
  HeartPulse: { bg: 'bg-violet-500/10', text: 'text-violet-700', activeBg: 'bg-violet-500/15' },
  PersonStanding: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-700', activeBg: 'bg-fuchsia-500/15' },
  Wind: { bg: 'bg-cyan-500/10', text: 'text-cyan-700', activeBg: 'bg-cyan-500/15' },
  HardHat: { bg: 'bg-slate-500/10', text: 'text-slate-700', activeBg: 'bg-slate-500/15' },
}

const DEFAULT_COLOR = {
  bg: 'bg-primary/10',
  text: 'text-primary',
  activeBg: 'bg-primary/15',
}

/**
 * A single tappable profile option card with colored icon.
 *
 * @param {Object} props
 * @param {import('@/lib/profiles').ProfileType} props.profile
 * @param {boolean} props.selected
 * @param {() => void} props.onSelect
 * @param {boolean} [props.disabled] - already added (one-per-category rule)
 */
export default function ProfileCard({ profile, selected, onSelect, disabled }) {
  const Icon = ICON_MAP[profile.icon] ?? User
  const colors = PROFILE_COLORS[profile.icon] ?? DEFAULT_COLOR

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'group relative flex flex-col items-center gap-2.5 rounded-2xl border p-5 text-center transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        disabled
          ? 'cursor-not-allowed border-border bg-muted/40 opacity-55'
          : 'hover:shadow-md hover:scale-[1.02]',
        !disabled && selected
          ? 'border-primary/50 bg-primary/5 shadow-md ring-2 ring-primary/20'
          : !disabled && 'border-border bg-card hover:border-primary/30',
      )}
      aria-pressed={selected}
      aria-disabled={disabled}
    >
      {disabled && (
        <span className="absolute right-2 top-2 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">
          Added
        </span>
      )}
      <div
        className={cn(
          'flex size-14 items-center justify-center rounded-2xl transition-colors',
          selected && !disabled ? colors.activeBg : colors.bg,
        )}
      >
        <Icon
          className={cn('size-7', colors.text)}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold leading-tight">
          {profile.label}
        </span>
        <span className="text-[11px] leading-snug text-muted-foreground">
          {profile.description}
        </span>
      </div>
    </button>
  )
}
