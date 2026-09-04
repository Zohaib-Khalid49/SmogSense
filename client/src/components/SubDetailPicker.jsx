import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Shows optional sub-detail options for profiles that have them.
 * When "Other" is selected, shows a free-text input so the user can describe
 * their specific condition.
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
  // "Other" is selected whether the value is the bare 'other' or the
  // "other:<free text>" form produced once the user starts typing.
  const isOtherSelected =
    selected === 'other' ||
    (typeof selected === 'string' && selected.startsWith('other:'))

  // Seed the free-text box from an existing "other:<text>" selection so the
  // value survives re-mounts (e.g. navigating back to this step).
  const [otherText, setOtherText] = useState(() =>
    typeof selected === 'string' && selected.startsWith('other:')
      ? selected.slice('other:'.length)
      : '',
  )

  function handleSelect(id) {
    onSelect(id)
  }

  function handleOtherText(e) {
    setOtherText(e.target.value)
    // Store as "other:description" so the backend/storage gets both
    onSelect(e.target.value.trim() ? `other:${e.target.value.trim()}` : 'other')
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Optional: tell us more about the <strong>{profileLabel}</strong> profile
        for finer-tuned thresholds.
      </p>
      <div className="flex flex-col gap-2">
        {options.map((opt) => (
          <div key={opt.id} className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleSelect(opt.id)}
              className={cn(
                'rounded-lg border px-4 py-3 text-left text-sm font-medium transition-all',
                'hover:border-primary/40 hover:shadow-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected === opt.id || (opt.id === 'other' && isOtherSelected)
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                  : 'border-border bg-card',
              )}
              aria-pressed={
                selected === opt.id || (opt.id === 'other' && isOtherSelected)
              }
            >
              {opt.label}
            </button>

            {/* Free-text input when "Other" is selected */}
            {opt.id === 'other' && isOtherSelected && (
              <input
                type="text"
                value={otherText}
                onChange={handleOtherText}
                placeholder="Please specify your condition"
                className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoFocus
              />
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        This is optional — you can skip it and refine later.
      </p>
    </div>
  )
}
