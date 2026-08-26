import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function AlertDetail() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Alert Detail</h1>
      <p className="text-sm text-muted-foreground">
        Why the alert fired, current reading, hazard band, and action will live
        here.
      </p>
      <Button asChild variant="outline">
        <Link to="/">Back to Home</Link>
      </Button>
    </div>
  )
}
