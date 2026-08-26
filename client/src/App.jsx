import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function App() {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">SmogSense component check</h1>

      {/* Hazard band color test */}
      <div className="flex w-full flex-col gap-3">
        <div className="rounded-[var(--radius-card)] bg-safe p-5 text-center font-semibold text-white shadow-md">
          Safe
        </div>
        <div className="rounded-[var(--radius-card)] bg-caution p-5 text-center font-semibold text-white shadow-md">
          Caution
        </div>
        <div className="rounded-[var(--radius-card)] bg-hazard p-5 text-center font-semibold text-white shadow-md">
          Hazardous
        </div>
      </div>

      {/* shadcn/ui component test */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>shadcn/ui works</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            Card, Button, and Badge below should look polished and match the
            theme.
          </p>
          <div className="flex items-center gap-2">
            <Button>Primary</Button>
            <Button variant="outline">Outline</Button>
            <Badge>Confidence: High</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default App
