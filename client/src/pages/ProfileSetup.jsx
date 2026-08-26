import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function ProfileSetup() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Profile Setup</h1>
      <p className="text-sm text-muted-foreground">
        "Who is this for?" 6-option selector will live here.
      </p>
      <Button asChild>
        <Link to="/">Continue to Home</Link>
      </Button>
    </div>
  )
}
