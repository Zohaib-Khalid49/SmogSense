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

/** Unique color accent per profile type for visual variety */
const PROFILE_COLORS = {
  User: { bg: 'bg-blue-500/10', text: 'text-blue-600', activeBg: 'bg-blue-500/15' },
  Baby: { bg: 'bg-pink-500/10', text: 'text-pink-600', activeBg: 'bg-pink-500/15' },
  HeartPulse: { bg: 'bg-purple-500/10', text: 'text-purple-600', activeBg: 'bg-purple-500/15' },
  PersonStanding: { bg: 'bg-rose-500/10', text: 'text-rose-600', activeBg: 'bg-rose-500/15' },
  Wind: { bg: 'bg-teal-500/10', text: 'text-teal-600', activeBg: 'bg-teal-500/15' },
  HardHat: { bg: 'bg-amber-500/10', text: 'text-amber-600', activeBg: 'bg-amber-500/15' },
}

const DEFAULT_COLOR = { bg: 'bg-muted', text: 'text-muted-foreground', activeBg: 'bg-primary/10' }

/**
 * A single tappable profile option card with colored icon.
 */
export default function ProfileCard({ profile, selected, onSelect }) {
  const Icon = ICON_MAP[profile.icon] ?? User
  const colors = PROFILE_COLORS[profile.icon] ?? DEFAULT_COLOR

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group flex flex-col items-center gap-2.5 rounded-2xl border p-5 text-center transition-all duration-200',
        'hover:shadow-md hover:scale-[1.02]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary/50 bg-primary/5 shadow-md ring-2 ring-primary/20'
          : 'border-border bg-card hover:border-primary/30',
      )}
      aria-pressed={selected}
    >
      <div
        className={cn(
          'flex size-14 items-center justify-center rounded-2xl transition-colors',
          selected ? colors.activeBg : colors.bg,
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
