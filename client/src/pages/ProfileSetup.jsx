import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Check, Loader2, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import ProfileCard from '@/components/ProfileCard'
import SubDetailPicker from '@/components/SubDetailPicker'
import ProfileList from '@/components/ProfileList'
import { PROFILE_TYPES, getProfileType, MAX_PROFILES, validateAge } from '@/lib/profiles'
import { loadProfiles, saveProfiles } from '@/lib/storage'
import { createProfile, listProfiles } from '@/api/client'
import { getUserId } from '@/lib/identity'

/**
 * Steps:
 * 1. "select"    — pick one of the 6 profile types
 * 2. "subdetail" — if the chosen type has subDetails, show them (optional)
 * 3. "label"     — optional nickname for the profile
 * 4. "done"      — profile added, show list + option to add more or continue
 */

const VALID_CATEGORIES = new Set([
  'adult',
  'child',
  'elderly',
  'pregnant',
  'respiratory',
  'outdoor_worker',
])

/**
 * Extract the true profile category from a profile object, regardless of
 * whether it's a backend profile (profileCategory) or a mock/localStorage
 * one (profileId = category or "category_timestamp").
 */
function profileCategoryOf(p) {
  if (p?.profileCategory && VALID_CATEGORIES.has(p.profileCategory)) {
    return p.profileCategory
  }
  const id = p?.profileId || ''
  if (VALID_CATEGORIES.has(id)) return id
  // Mock id format "category_timestamp" — strip the timestamp suffix
  const prefix = id.split('_').slice(0, -1).join('_')
  if (VALID_CATEGORIES.has(prefix)) return prefix
  // "outdoor_worker" has an underscore; handle the "outdoor_worker_123" case
  if (id.startsWith('outdoor_worker')) return 'outdoor_worker'
  return id
}

export default function ProfileSetup() {
  const navigate = useNavigate()

  const [step, setStep] = useState('select')
  const [selectedId, setSelectedId] = useState(null)
  const [subDetail, setSubDetail] = useState(null)
  const [label, setLabel] = useState('')
  const [age, setAge] = useState('')
  const [profiles, setProfiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  const selectedType = getProfileType(selectedId)
  const hasSubDetails = selectedType?.subDetails != null
  const canAddMore = profiles.length < MAX_PROFILES

  // Age must fit the selected profile type (e.g. no age-1 "Adult")
  const ageError = validateAge(selectedId, age)

  // One-per-category rule: categories already added can't be added again.
  // Backend profiles carry the true category in `profileCategory`.
  // Mock/localStorage profiles store the category in `profileId`
  // (either the bare category or "category_timestamp").
  const usedCategories = new Set(
    profiles.map((p) => profileCategoryOf(p)),
  )

  // Track online/offline status
  useEffect(() => {
    function handleOnline() { setIsOnline(true) }
    function handleOffline() { setIsOnline(false) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Load existing profiles from backend (or localStorage fallback)
  useEffect(() => {
    let cancelled = false
    async function fetchProfiles() {
      let loaded
      try {
        const userId = getUserId()
        const backendProfiles = await listProfiles(userId)
        loaded = backendProfiles.length > 0 ? backendProfiles : loadProfiles()
      } catch {
        loaded = loadProfiles()
      }
      if (cancelled) return
      setProfiles(loaded)
    }
    fetchProfiles()
    return () => { cancelled = true }
  }, [])

  // --- Handlers ---

  function handleSelectProfile(id) {
    setSelectedId(id)
  }

  function handleNext() {
    if (step === 'select') {
      if (hasSubDetails) {
        setStep('subdetail')
      } else {
        setStep('label')
      }
    } else if (step === 'subdetail') {
      setStep('label')
    } else if (step === 'label') {
      addProfile()
    }
  }

  function handleSkipSubDetail() {
    setSubDetail(null)
    setStep('label')
  }

  async function addProfile() {
    // Enforce the profile cap (defense in depth — not just the hidden button)
    if (profiles.length >= MAX_PROFILES) {
      setError(`You can add at most ${MAX_PROFILES} profiles.`)
      setStep('done')
      return
    }

    // Prevent duplicate category (one-per-category rule)
    const already = new Set(profiles.map((p) => profileCategoryOf(p)))
    if (already.has(selectedId)) {
      setError('You already have a profile for this category.')
      setStep('done')
      return
    }

    // Block profile creation when offline
    if (!isOnline) {
      setError('Profile editing requires an internet connection.')
      return
    }

    // Block if the age contradicts the selected profile type
    if (validateAge(selectedId, age)) {
      return
    }

    const profileLabel = label.trim() || selectedType?.label || ''
    const ageNum = age.trim() === '' ? undefined : Number(age)

    // Build the new profile object for localStorage
    const localStorageProfile = {
      profileId: selectedId,
      subDetail,
      label: profileLabel,
      age: ageNum ?? null,
    }

    setSaving(true)
    setError(null)

    try {
      // Call the API (in live mode this hits the backend)
      const created = await createProfile({
        userId: getUserId(),
        name: profileLabel,
        age: ageNum,
        category: selectedId,
        subDetail,
      })

      // If backend returned a profile, use its data (has real profileId)
      const profileToAdd = created ?? localStorageProfile
      const updated = [...profiles, profileToAdd]
      setProfiles(updated)
      saveProfiles(updated) // Keep localStorage in sync

      resetForm()
      setStep('done')
    } catch {
      // On failure, still save to localStorage as fallback
      const updated = [...profiles, localStorageProfile]
      setProfiles(updated)
      saveProfiles(updated)
      setError('Could not sync with server. Profile saved locally.')
      resetForm()
      setStep('done')
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setSelectedId(null)
    setSubDetail(null)
    setLabel('')
    setAge('')
  }

  function handleAddAnother() {
    resetForm()
    setStep('select')
  }

  function handleRemoveProfile(index) {
    const profile = profiles[index]
    const updated = profiles.filter((_, i) => i !== index)
    setProfiles(updated)
    saveProfiles(updated)

    // Permanently delete the backend profile (live mode).
    // Backend profileIds are 24-char Mongo ObjectIds; mock ids look like "child_123".
    const isBackendId = /^[a-f\d]{24}$/i.test(profile?.profileId || '')
    if (isBackendId) {
      import('@/api/client').then(({ deleteProfile }) => {
        deleteProfile(profile.profileId).catch(() => {})
      })
    }

    if (updated.length === 0) {
      setStep('select')
    }
  }

  function handleFinish() {
    navigate('/')
  }

  // --- Step indicator ---
  const STEPS = ['select', 'subdetail', 'label', 'done']
  const stepIndex = STEPS.indexOf(step)

  // --- Render ---

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold">
            {step === 'done' ? 'Your profiles' : 'Who is this for?'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === 'select' && 'Choose who to personalize air quality alerts for.'}
            {step === 'subdetail' && 'Add an optional detail for finer alerts.'}
            {step === 'label' && 'A name and age help tailor recommendations.'}
            {step === 'done' && 'Manage the people you track — up to 4.'}
          </p>
        </div>
        {/* Step progress dots */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i <= stepIndex ? 'w-8 bg-primary' : 'w-4 bg-border',
              )}
            />
          ))}
        </div>
      </header>

      {/* Step: select profile type */}
      {step === 'select' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {PROFILE_TYPES.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                selected={selectedId === p.id}
                disabled={usedCategories.has(p.id)}
                onSelect={() => handleSelectProfile(p.id)}
              />
            ))}
          </div>

          {/* Cap reached — inline message instead of allowing Continue */}
          {!canAddMore && (
            <p className="rounded-lg bg-destructive/5 px-3 py-2 text-center text-sm font-medium text-destructive">
              You can add up to {MAX_PROFILES} profiles. Delete one below to add
              another.
            </p>
          )}

          <Button
            onClick={handleNext}
            disabled={!selectedId || !isOnline || !canAddMore}
            className="gap-1.5"
          >
            {!isOnline && <WifiOff className="size-4" />}
            {isOnline ? 'Continue' : 'Offline — cannot add profiles'}
            {isOnline && <ChevronRight className="size-4" />}
          </Button>
        </>
      )}

      {/* Step: sub-detail (optional) */}
      {step === 'subdetail' && selectedType && (
        <>
          <SubDetailPicker
            options={selectedType.subDetails}
            selected={subDetail}
            onSelect={setSubDetail}
            profileLabel={selectedType.label}
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSkipSubDetail}
              className="flex-1"
            >
              Skip
            </Button>
            <Button
              onClick={handleNext}
              disabled={!subDetail}
              className="flex-1 gap-1.5"
            >
              Continue
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </>
      )}

      {/* Step: optional label */}
      {step === 'label' && (
        <>
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium">
              Tell us about this {selectedType?.label?.toLowerCase() || 'person'}
            </p>

            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="profile-label" className="text-sm">
                Name <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="profile-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={selectedType?.label || 'e.g. Mom, Ahmed'}
                className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Age */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="profile-age" className="text-sm">
                Age <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="profile-age"
                type="number"
                inputMode="numeric"
                min="0"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 8"
                aria-invalid={ageError ? true : undefined}
                className={cn(
                  'rounded-lg border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2',
                  ageError
                    ? 'border-destructive focus-visible:ring-destructive'
                    : 'border-input focus-visible:ring-ring',
                )}
              />
              {ageError ? (
                <p className="text-xs text-destructive">{ageError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Helps fine-tune health thresholds for this person.
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={handleNext}
            className="gap-1.5"
            disabled={saving || !!ageError}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Save profile
          </Button>
        </>
      )}

      {/* Step: done — show list, add another, or continue to Home */}
      {step === 'done' && (
        <>
          {error && (
            <div className="rounded-lg border border-caution/30 bg-caution/10 px-4 py-3 text-sm text-caution">
              {error}
            </div>
          )}
          <ProfileList
            profiles={profiles}
            onAdd={canAddMore ? handleAddAnother : undefined}
            onRemove={handleRemoveProfile}
          />

          {!canAddMore && (
            <p className="text-xs text-muted-foreground">
              Maximum of {MAX_PROFILES} profiles reached.
            </p>
          )}

          <Button onClick={handleFinish} size="lg" className="gap-1.5">
            <Check className="size-4" />
            Continue to SmogSense
          </Button>
        </>
      )}

      {/* Show existing profiles below the form if user is adding another */}
      {/* Existing profiles list with delete (non-done steps) —
          no "add another" button here since this IS the add screen */}
      {step !== 'done' && profiles.length > 0 && (
        <div className="mt-2 border-t border-border pt-4">
          <ProfileList
            profiles={profiles}
            onAdd={undefined}
            onRemove={handleRemoveProfile}
          />
        </div>
      )}
    </div>
  )
}
