import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getProfileType } from '@/lib/profiles'

/**
 * Displays the list of saved profiles and allows adding/removing.
 * Used by caregivers tracking more than one vulnerable person.
 *
 * @param {Object} props
 * @param {Array<{profileId: string, subDetail: string|null, label: string}>} props.profiles
 * @param {() => void} props.onAdd - triggered when "Add another" is tapped
 * @param {(index: number) => void} props.onRemove - remove a profile by index
 */
export default function ProfileList({ profiles, onAdd, onRemove }) {
  if (profiles.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">
        Profiles added ({profiles.length})
      </p>

      <div className="flex flex-col gap-2">
        {profiles.map((p, i) => {
          const type = getProfileType(p.profileId)
          return (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">
                  {p.label || type?.label || p.profileId}
                </span>
                <span className="text-xs text-muted-foreground">
                  {type?.label}
                  {p.subDetail && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {p.subDetail}
                    </Badge>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Remove profile ${p.label || type?.label}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          )
        })}
      </div>

      {onAdd && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="gap-1.5 self-start"
        >
          <Plus className="size-4" />
          Add another profile
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        Caregivers can track multiple people (e.g., a child and an elderly
        parent) from one device.
      </p>
    </div>
  )
}
