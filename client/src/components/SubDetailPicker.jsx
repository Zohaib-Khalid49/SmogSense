import { cn } from '@/lib/utils'

/**
 * Shows optional sub-detail options for profiles that have them.
 * Only rendered when the selected profile's subDetails is non-null.
 *
 * @param {Object} props
 * @param {import('@/lib/profiles').SubDetail[]} props.options - sub-detail choices
 * @param {string|null} props.selected - currently selected sub-detail id
 * @param {(id: string) => void} props.onSelect
 * @param {string} props.profileLabel - e.g. "Pregnant Woman" for the heading
 */
export default function SubDetailPicker({
  options,
  selected,
  onSelect,
  profileLabel,
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Optional: tell us more about the <strong>{profileLabel}</strong> profile
        for finer-tuned thresholds.
      </p>
      <div className="flex flex-col gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.id)}
            className={cn(
              'rounded-lg border px-4 py-3 text-left text-sm font-medium transition-all',
              'hover:border-primary/40 hover:shadow-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected === opt.id
                ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                : 'border-border bg-card',
            )}
            aria-pressed={selected === opt.id}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        This is optional — you can skip it and refine later.
      </p>
    </div>
  )
}
