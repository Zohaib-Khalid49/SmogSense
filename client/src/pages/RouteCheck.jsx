import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function RouteCheck() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Route / Trip Check</h1>
      <p className="text-sm text-muted-foreground">
        Origin/destination input, map, and two-route comparison will live here.
      </p>
      <Button asChild variant="outline">
        <Link to="/">Back to Home</Link>
      </Button>
    </div>
  )
}
