import { useEffect, useRef, useState } from 'react'
import { Navigation, Loader2, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { searchPlaces } from '@/lib/geocode'

/**
 * Location search with Nominatim autocomplete.
 *
 * The user types, sees a dropdown of matching Lahore places, and must
 * SELECT one — which sets the coordinates via onSelect. Typing a random
 * string that matches nothing gives no selectable result, so no invalid
 * coordinates can be submitted.
 *
 * @param {Object} props
 * @param {string} props.placeholder
 * @param {(place: { label: string, lat: number, lng: number }) => void} props.onSelect
 * @param {{ label: string } | null} [props.selected] - currently selected place (for display)
 */
export default function LocationSearch({ placeholder, onSelect, selected }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const abortRef = useRef(null)
  const containerRef = useRef(null)

  // Debounced search as the user types
  useEffect(() => {
    if (query.trim().length < 3) {
      // Clear results after the current render, not synchronously in the effect
      const clear = setTimeout(() => setResults([]), 0)
      return () => clearTimeout(clear)
    }

    const timer = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      try {
        const places = await searchPlaces(query, controller.signal)
        setResults(places)
        setOpen(true)
      } catch {
        // aborted or failed — ignore
      } finally {
        setLoading(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handlePick(place) {
    onSelect(place)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <Navigation className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={selected ? selected.label : placeholder}
        className={cn(
          'w-full rounded-xl border border-input bg-card py-3 pl-10 pr-10 text-sm shadow-sm',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          selected && !query && 'placeholder:text-foreground placeholder:font-medium',
        )}
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}

      {/* Suggestions dropdown */}
      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {results.map((place, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => handlePick(place)}
                className="flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted"
              >
                <MapPin className="mt-0.5 size-3.5 flex-shrink-0 text-muted-foreground" />
                <span>{place.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* No results hint */}
      {open && !loading && query.trim().length >= 3 && results.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-lg">
          No places found in Lahore. Try a different search.
        </div>
      )}
    </div>
  )
}
