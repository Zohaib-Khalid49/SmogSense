import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import ProfileCard from '@/components/ProfileCard'
import SubDetailPicker from '@/components/SubDetailPicker'
import ProfileList from '@/components/ProfileList'
import { PROFILE_TYPES, getProfileType, MAX_PROFILES } from '@/lib/profiles'
import { loadProfiles, saveProfiles } from '@/lib/storage'
import { createProfile } from '@/api/client'
import { getUserId } from '@/lib/identity'

/**
 * Steps:
 * 1. "select"    — pick one of the 6 profile types
 * 2. "subdetail" — if the chosen type has subDetails, show them (optional)
 * 3. "label"     — optional nickname for the profile
 * 4. "done"      — profile added, show list + option to add more or continue
 */

export default function ProfileSetup() {
  const navigate = useNavigate()

  const [step, setStep] = useState('select')
  const [selectedId, setSelectedId] = useState(null)
  const [subDetail, setSubDetail] = useState(null)
  const [label, setLabel] = useState('')
  const [profiles, setProfiles] = useState(() => loadProfiles())

  const selectedType = getProfileType(selectedId)
  const hasSubDetails = selectedType?.subDetails != null
  const canAddMore = profiles.length < MAX_PROFILES

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

  function addProfile() {
    const profileLabel = label.trim() || selectedType?.label || ''
    const newProfile = {
      profileId: selectedId,
      subDetail,
      label: profileLabel,
    }
    // Save to localStorage (always — for offline + fast reads)
    const updated = [...profiles, newProfile]
    setProfiles(updated)
    saveProfiles(updated)

    // Also call the API client (in live mode this hits the backend)
    createProfile({
      userId: getUserId(),
      name: profileLabel,
      category: selectedId,
      subDetail,
    }).catch(() => {
      // Silently fail — localStorage is the source of truth for now
    })

    resetForm()
    setStep('done')
  }

  function resetForm() {
    setSelectedId(null)
    setSubDetail(null)
    setLabel('')
  }

  function handleAddAnother() {
    resetForm()
    setStep('select')
  }

  function handleRemoveProfile(index) {
    const updated = profiles.filter((_, i) => i !== index)
    setProfiles(updated)
    saveProfiles(updated)
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
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">Who is this for?</h1>
          <p className="text-sm text-muted-foreground">
            Select a profile so SmogSense can personalize thresholds and
            recommendations for you.
          </p>
        </div>
        {/* Step progress dots */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i <= stepIndex
                  ? 'w-8 bg-primary'
                  : 'w-4 bg-border',
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
                onSelect={() => handleSelectProfile(p.id)}
              />
            ))}
          </div>

          <Button
            onClick={handleNext}
            disabled={!selectedId}
            className="gap-1.5"
          >
            Continue
            <ChevronRight className="size-4" />
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
          <div className="flex flex-col gap-2">
            <label
              htmlFor="profile-label"
              className="text-sm font-medium"
            >
              Give this profile a name{' '}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              id="profile-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={selectedType?.label || 'e.g. Mom, Ahmed'}
              className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              Useful if you're tracking more than one person.
            </p>
          </div>

          <Button onClick={handleNext} className="gap-1.5">
            <Check className="size-4" />
            Save profile
          </Button>
        </>
      )}

      {/* Step: done — show list, add another, or continue to Home */}
      {step === 'done' && (
        <>
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
      {step !== 'done' && profiles.length > 0 && (
        <div className="mt-2 border-t border-border pt-4">
          <ProfileList
            profiles={profiles}
            onAdd={canAddMore ? handleAddAnother : undefined}
            onRemove={handleRemoveProfile}
          />
        </div>
      )}
    </div>
  )
}
