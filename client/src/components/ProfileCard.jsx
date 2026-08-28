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
 * A single tappable profile option card.
 *
 * @param {Object} props
 * @param {import('@/lib/profiles').ProfileType} props.profile
 * @param {boolean} props.selected
 * @param {() => void} props.onSelect
 */
export default function ProfileCard({ profile, selected, onSelect }) {
  const Icon = ICON_MAP[profile.icon] ?? User

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col items-center gap-2 rounded-[var(--radius-card)] border p-4 text-center transition-all',
        'hover:border-primary/40 hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/30 shadow-sm'
          : 'border-border bg-card',
      )}
      aria-pressed={selected}
    >
      <div
        className={cn(
          'flex size-12 items-center justify-center rounded-full',
          selected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-6" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <span className="text-sm font-semibold leading-tight">{profile.label}</span>
      <span className="text-xs text-muted-foreground">{profile.description}</span>
    </button>
  )
}
