import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Home / Hazard Status</h1>
      <p className="text-sm text-muted-foreground">
        The hazard card will live here (the #1 attack point).
      </p>
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link to="/route">Plan a trip</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/alert">Alert detail</Link>
        </Button>
      </div>
    </div>
  )
}
